-- PolyLinga v2: correction-centred loop, reviewed pattern library, server-only metering, own audio bucket.

-- ---------------------------------------------------------------------------
-- Metering: only the server (service role) may count or give back usage.
-- v1 let any signed-in user call pl_refund from the browser and reset their own limit.
-- ---------------------------------------------------------------------------
drop function if exists public.pl_consume(text, int);
drop function if exists public.pl_refund(text);

-- Whole-service ceiling per day, so mass sign-ups cannot run up the AI bill.
create table if not exists public.pl_global_usage (
  day date primary key,
  corrections int not null default 0,
  tts int not null default 0
);
alter table public.pl_global_usage enable row level security; -- no policies: service role only

-- Returns uses left today for the user, -1 when the user is over their limit, -2 when the service is.
create or replace function public.pl_consume_for(uid uuid, kind text, user_limit int, global_limit int)
returns int
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Tokyo')::date;
  used int;
  global_used int;
begin
  if kind not in ('corrections', 'tts') then
    raise exception 'unknown kind %', kind;
  end if;

  insert into pl_daily_usage (user_id, day) values (uid, today) on conflict do nothing;
  insert into pl_global_usage (day) values (today) on conflict do nothing;

  if kind = 'corrections' then
    update pl_global_usage set corrections = corrections + 1
      where day = today and corrections < global_limit returning corrections into global_used;
  else
    update pl_global_usage set tts = tts + 1
      where day = today and tts < global_limit returning tts into global_used;
  end if;
  if global_used is null then
    return -2;
  end if;

  if kind = 'corrections' then
    update pl_daily_usage set corrections = corrections + 1
      where user_id = uid and day = today and corrections < user_limit returning corrections into used;
  else
    update pl_daily_usage set tts = tts + 1
      where user_id = uid and day = today and tts < user_limit returning tts into used;
  end if;

  if used is null then
    if kind = 'corrections' then
      update pl_global_usage set corrections = corrections - 1 where day = today;
    else
      update pl_global_usage set tts = tts - 1 where day = today;
    end if;
    return -1;
  end if;
  return user_limit - used;
end;
$$;

create or replace function public.pl_refund_for(uid uuid, kind text)
returns void
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if kind = 'corrections' then
    update pl_daily_usage set corrections = greatest(corrections - 1, 0) where user_id = uid and day = today;
    update pl_global_usage set corrections = greatest(corrections - 1, 0) where day = today;
  elsif kind = 'tts' then
    update pl_daily_usage set tts = greatest(tts - 1, 0) where user_id = uid and day = today;
    update pl_global_usage set tts = greatest(tts - 1, 0) where day = today;
  end if;
end;
$$;

revoke all on function public.pl_consume_for(uuid, text, int, int) from public, anon, authenticated;
revoke all on function public.pl_refund_for(uuid, text) from public, anon, authenticated;
grant execute on function public.pl_consume_for(uuid, text, int, int) to service_role;
grant execute on function public.pl_refund_for(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Pattern library: functions (働き) group one pattern per language and their example sets.
-- AI drafts arrive as 'draft' and are only shown to learners once a person approves them.
-- ---------------------------------------------------------------------------
create table if not exists public.pl_functions (
  id text primary key,                 -- e.g. 'invite'
  position int not null default 0,
  label jsonb not null,                -- {"ja": "誘う", "en": "Inviting", ...}
  created_at timestamptz not null default now()
);
alter table public.pl_functions enable row level security;
create policy "pl_functions read" on public.pl_functions for select using (true);

alter table public.pl_patterns
  add column if not exists function_id text references public.pl_functions on delete set null,
  add column if not exists status text not null default 'approved',
  add column if not exists source text not null default 'hand';
alter table public.pl_patterns drop constraint if exists pl_patterns_status_check;
alter table public.pl_patterns add constraint pl_patterns_status_check check (status in ('draft', 'approved', 'rejected'));

alter table public.pl_sentences
  add column if not exists status text not null default 'approved',
  add column if not exists source text not null default 'hand';
alter table public.pl_sentences drop constraint if exists pl_sentences_status_check;
alter table public.pl_sentences add constraint pl_sentences_status_check check (status in ('draft', 'approved', 'rejected'));
create index if not exists pl_sentences_topic_idx on public.pl_sentences (topic, status);

-- Learners see approved content only.
drop policy if exists "pl_patterns read" on public.pl_patterns;
create policy "pl_patterns read" on public.pl_patterns for select using (status = 'approved');
drop policy if exists "pl_sentences read" on public.pl_sentences;
create policy "pl_sentences read" on public.pl_sentences for select using (status = 'approved');
drop policy if exists "pl_sentence_patterns read" on public.pl_sentence_patterns;
create policy "pl_sentence_patterns read" on public.pl_sentence_patterns for select using (
  exists (select 1 from public.pl_sentences s where s.id = sentence_id and s.status = 'approved')
);
drop policy if exists "pl_sentence_embeddings read" on public.pl_sentence_embeddings;
create policy "pl_sentence_embeddings read" on public.pl_sentence_embeddings for select using (
  exists (select 1 from public.pl_sentences s where s.id = sentence_id and s.status = 'approved')
);

create or replace function public.pl_match_sentences(
  query_embedding extensions.vector(1536),
  query_lang text,
  match_count int default 8
)
returns table (sentence_id uuid, similarity float)
language sql stable
set search_path = public, extensions
as $$
  select e.sentence_id, 1 - (e.embedding <=> query_embedding) as similarity
  from public.pl_sentence_embeddings e
  join public.pl_sentences s on s.id = e.sentence_id and s.status = 'approved'
  where e.lang = query_lang
  order by e.embedding <=> query_embedding
  limit least(match_count, 20);
$$;

-- ---------------------------------------------------------------------------
-- Sayings: one row per "言いたいこと". Corrections hang off it, so the page survives a reload
-- and the learner keeps a history of what they wanted to say and how it came out.
-- ---------------------------------------------------------------------------
create table if not exists public.pl_sayings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  native_lang text not null check (native_lang in ('ja', 'en', 'ko', 'zh')),
  target_lang text not null check (target_lang in ('ja', 'en', 'ko', 'zh')),
  intent text not null check (char_length(intent) between 1 and 200),
  matches jsonb not null default '[]', -- [{"sentence_id": "...", "similarity": 0.61}] from the corpus search
  created_at timestamptz not null default now()
);
create index if not exists pl_sayings_user_idx on public.pl_sayings (user_id, created_at desc);
alter table public.pl_sayings enable row level security;
create policy "pl_sayings own" on public.pl_sayings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.pl_corrections
  add column if not exists saying_id uuid references public.pl_sayings on delete cascade;
create index if not exists pl_corrections_saying_idx on public.pl_corrections (saying_id, created_at desc);
-- Corrections are written by the server only: their text is what /api/tts will read aloud.
drop policy if exists "pl_corrections own insert" on public.pl_corrections;

alter table public.pl_memos
  add column if not exists correction_id uuid references public.pl_corrections on delete set null;

-- ---------------------------------------------------------------------------
-- Audio: a bucket of our own. The old app's weekly job deletes everything in tts-audio older than 30 days.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pl-audio', 'pl-audio', true, 2097152, array['audio/wav'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
