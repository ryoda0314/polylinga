-- PolyLinga v3: the example-sentence shower.
-- Learners bathe in clusters of sentences that share a pattern, notice the common part themselves,
-- type unknown words into their memo, and meet patterns and words again inside the shower (no quizzes).

-- Words the learner typed into their memo. Typing the same word again is fine: it counts as another meeting.
create table if not exists public.pl_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  lang text not null check (lang in ('ja', 'en', 'ko', 'zh')),
  text text not null check (char_length(text) between 1 and 40),
  note text check (note is null or char_length(note) <= 120),
  memo_count int not null default 1,       -- how many times they typed it in
  encounters int not null default 1,       -- meetings: the first one plus each shower sentence it shows up in
  uses int not null default 0,             -- times it appeared in the learner's own corrected sentences
  understood boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, lang, text)
);
alter table public.pl_words enable row level security;
create policy "pl_words own" on public.pl_words
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Which patterns the learner has bathed in, and when the shower should bring each back.
create table if not exists public.pl_exposures (
  user_id uuid not null references auth.users on delete cascade,
  pattern_id text not null references public.pl_patterns on delete cascade,
  times int not null default 0,
  last_at timestamptz,
  next_at timestamptz,
  primary key (user_id, pattern_id)
);
create index if not exists pl_exposures_next_idx on public.pl_exposures (user_id, next_at);
alter table public.pl_exposures enable row level security;
create policy "pl_exposures own" on public.pl_exposures
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Sentences the learner has seen, so new clusters prefer sentences they have not met yet.
create table if not exists public.pl_seen (
  user_id uuid not null references auth.users on delete cascade,
  sentence_id uuid not null references public.pl_sentences on delete cascade,
  times int not null default 0,
  last_at timestamptz not null default now(),
  primary key (user_id, sentence_id)
);
alter table public.pl_seen enable row level security;
create policy "pl_seen own" on public.pl_seen
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- "これで言ってみる" from the shower: a saying can start from a pattern instead of a written intent.
alter table public.pl_sayings alter column intent drop not null;
alter table public.pl_sayings drop constraint if exists pl_sayings_intent_check;
alter table public.pl_sayings add constraint pl_sayings_intent_check
  check (intent is null or char_length(intent) between 1 and 200);
alter table public.pl_sayings
  add column if not exists pattern_id text references public.pl_patterns on delete set null;
alter table public.pl_sayings drop constraint if exists pl_sayings_has_start;
alter table public.pl_sayings add constraint pl_sayings_has_start check (intent is not null or pattern_id is not null);
