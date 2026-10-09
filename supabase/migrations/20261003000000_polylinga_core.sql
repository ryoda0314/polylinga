-- PolyLinga (rebuild) core schema.
-- Lives alongside the old poly-lang tables in the same project; everything new is prefixed pl_.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Content: one row = the same sentence in ja / en / ko / zh
-- ---------------------------------------------------------------------------
create table if not exists public.pl_sentences (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,            -- stable id used by the seed script
  topic text,
  ja text not null,
  en text not null,
  ko text not null,
  zh text not null,
  created_at timestamptz not null default now()
);

-- A "かたち" belongs to one language (e.g. ko: 動詞 + (으)ㄹ래?)
create table if not exists public.pl_patterns (
  id text primary key,                 -- e.g. 'ko-eullae'
  lang text not null check (lang in ('ja', 'en', 'ko', 'zh')),
  form text not null,                  -- shown as the pattern headline
  meaning jsonb not null,              -- {"ja": "...", "en": "...", "ko": "...", "zh": "..."}
  examples text,                       -- e.g. '가다 → 갈래 · 먹다 → 먹을래'
  created_at timestamptz not null default now()
);

-- Where a pattern appears inside one language version of a sentence
create table if not exists public.pl_sentence_patterns (
  sentence_id uuid not null references public.pl_sentences on delete cascade,
  pattern_id text not null references public.pl_patterns on delete cascade,
  lang text not null check (lang in ('ja', 'en', 'ko', 'zh')),
  start_index int not null,            -- UTF-16 offsets into the sentence text
  end_index int not null,
  primary key (sentence_id, pattern_id, lang)
);
create index if not exists pl_sentence_patterns_pattern_idx on public.pl_sentence_patterns (pattern_id, lang);

-- Search: one embedding per language version
create table if not exists public.pl_sentence_embeddings (
  sentence_id uuid not null references public.pl_sentences on delete cascade,
  lang text not null check (lang in ('ja', 'en', 'ko', 'zh')),
  embedding extensions.vector(1536) not null,
  primary key (sentence_id, lang)
);
create index if not exists pl_sentence_embeddings_hnsw
  on public.pl_sentence_embeddings using hnsw (embedding extensions.vector_cosine_ops);

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
  where e.lang = query_lang
  order by e.embedding <=> query_embedding
  limit least(match_count, 20);
$$;

-- ---------------------------------------------------------------------------
-- Per-user data
-- ---------------------------------------------------------------------------
create table if not exists public.pl_settings (
  user_id uuid primary key references auth.users on delete cascade,
  native_lang text not null default 'ja' check (native_lang in ('ja', 'en', 'ko', 'zh')),
  target_lang text not null default 'ko' check (target_lang in ('ja', 'en', 'ko', 'zh')),
  accent text not null default 'pen' check (accent in ('pen', 'ink', 'pine', 'brick')),
  speech_rate real not null default 1.0 check (speech_rate between 0.5 and 1.5),
  updated_at timestamptz not null default now(),
  check (native_lang <> target_lang)
);

create table if not exists public.pl_memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  lang text not null check (lang in ('ja', 'en', 'ko', 'zh')),
  pattern_id text references public.pl_patterns on delete set null,
  sentence_id uuid references public.pl_sentences on delete set null,
  text text not null,                  -- what to show (the pattern form, or the learner's corrected sentence)
  note text,                           -- meaning in the learner's language
  stage int not null default 0 check (stage between 0 and 6),
  due_at timestamptz not null default now(),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists pl_memos_due_idx on public.pl_memos (user_id, due_at);

create table if not exists public.pl_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  native_lang text not null,
  target_lang text not null,
  intent text,
  input text not null,
  corrected text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists pl_corrections_user_idx on public.pl_corrections (user_id, created_at desc);

create table if not exists public.pl_daily_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  corrections int not null default 0,
  tts int not null default 0,
  primary key (user_id, day)
);

-- Atomically count one use of a metered feature. Returns the uses left today, or -1 when over the limit.
create or replace function public.pl_consume(kind text, daily_limit int)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Tokyo')::date;
  used int;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if kind not in ('corrections', 'tts') then
    raise exception 'unknown kind %', kind;
  end if;

  insert into pl_daily_usage (user_id, day) values (uid, today)
  on conflict (user_id, day) do nothing;

  if kind = 'corrections' then
    update pl_daily_usage set corrections = corrections + 1
      where user_id = uid and day = today and corrections < daily_limit
      returning corrections into used;
  else
    update pl_daily_usage set tts = tts + 1
      where user_id = uid and day = today and tts < daily_limit
      returning tts into used;
  end if;

  if used is null then
    return -1;
  end if;
  return daily_limit - used;
end;
$$;

-- Give back one use when the metered call itself failed.
create or replace function public.pl_refund(kind text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if kind = 'corrections' then
    update pl_daily_usage set corrections = greatest(corrections - 1, 0)
      where user_id = auth.uid() and day = today;
  elsif kind = 'tts' then
    update pl_daily_usage set tts = greatest(tts - 1, 0)
      where user_id = auth.uid() and day = today;
  end if;
end;
$$;

revoke all on function public.pl_consume(text, int) from public, anon;
revoke all on function public.pl_refund(text) from public, anon;
grant execute on function public.pl_consume(text, int) to authenticated;
grant execute on function public.pl_refund(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.pl_sentences enable row level security;
alter table public.pl_patterns enable row level security;
alter table public.pl_sentence_patterns enable row level security;
alter table public.pl_sentence_embeddings enable row level security;
alter table public.pl_settings enable row level security;
alter table public.pl_memos enable row level security;
alter table public.pl_corrections enable row level security;
alter table public.pl_daily_usage enable row level security;

-- Content is readable by everyone; only the service role writes it.
create policy "pl_sentences read" on public.pl_sentences for select using (true);
create policy "pl_patterns read" on public.pl_patterns for select using (true);
create policy "pl_sentence_patterns read" on public.pl_sentence_patterns for select using (true);
create policy "pl_sentence_embeddings read" on public.pl_sentence_embeddings for select using (true);

create policy "pl_settings own" on public.pl_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pl_memos own" on public.pl_memos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pl_corrections own read" on public.pl_corrections
  for select using (auth.uid() = user_id);
create policy "pl_corrections own insert" on public.pl_corrections
  for insert with check (auth.uid() = user_id);
-- Usage rows are written only through pl_consume / pl_refund.
create policy "pl_daily_usage own read" on public.pl_daily_usage
  for select using (auth.uid() = user_id);
