-- ことのあめ: みんなの雨. Learners who switch it on let their corrected sentences rain on other learners of the same
-- language, in clusters by pattern like the library's. Only the corrected text goes out, never who wrote it, and only
-- sentences the correction judged safe to share (no personal details, nothing hurtful). Learners never read these tables
-- directly: the server reads them with the service role and strips the author, so nobody can list anyone's sentences.

alter table public.pl_settings add column if not exists share_rain boolean not null default false;
-- When the learner last saw that their sentences had reached someone ("だれかに届きました").
alter table public.pl_settings add column if not exists reached_seen_at timestamptz;

-- One row per corrected sentence and pattern it uses: a sentence with two patterns can rain in both.
create table if not exists public.pl_shared (
  id uuid primary key default gen_random_uuid(),
  correction_id uuid not null references public.pl_corrections on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  target_lang text not null check (target_lang in ('ja', 'en', 'ko', 'zh')),
  native_lang text not null check (native_lang in ('ja', 'en', 'ko', 'zh')),
  text text not null check (char_length(text) between 1 and 300),
  gloss text not null default '',
  pattern_id text not null references public.pl_patterns on delete cascade,
  start_index int not null,
  end_index int not null,
  status text not null default 'live' check (status in ('live', 'hidden')),
  created_at timestamptz not null default now(),
  unique (correction_id, pattern_id)
);
create index if not exists pl_shared_pattern_idx on public.pl_shared (target_lang, pattern_id, status);
create index if not exists pl_shared_user_idx on public.pl_shared (user_id);
alter table public.pl_shared enable row level security;

-- Which shared sentences a learner has bathed in, so new ones come first.
create table if not exists public.pl_shared_seen (
  user_id uuid not null references auth.users on delete cascade,
  shared_id uuid not null references public.pl_shared on delete cascade,
  last_at timestamptz not null default now(),
  primary key (user_id, shared_id)
);
alter table public.pl_shared_seen enable row level security;

-- 「これ言いたかった」: one per learner and sentence. Never counted on screen; the author only hears that it reached someone.
create table if not exists public.pl_shared_hearts (
  shared_id uuid not null references public.pl_shared on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shared_id, user_id)
);
create index if not exists pl_shared_hearts_time_idx on public.pl_shared_hearts (created_at);
alter table public.pl_shared_hearts enable row level security;

-- A report hides the sentence at once; a person looks at it later.
create table if not exists public.pl_shared_reports (
  shared_id uuid not null references public.pl_shared on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shared_id, user_id)
);
alter table public.pl_shared_reports enable row level security;

-- Live shared sentences per pattern in one language, not counting a learner's own.
create or replace function public.pl_shared_counts(target text, viewer uuid)
returns table (pattern_id text, n bigint)
language sql stable
set search_path = public
as $$
  select s.pattern_id, count(*)
  from pl_shared s
  where s.target_lang = target and s.status = 'live' and s.user_id <> viewer
  group by s.pattern_id;
$$;
revoke all on function public.pl_shared_counts(text, uuid) from public, anon, authenticated;
grant execute on function public.pl_shared_counts(text, uuid) to service_role;
