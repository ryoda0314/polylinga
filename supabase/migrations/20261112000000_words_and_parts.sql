-- 語のまとまり, and what grows on it: the word sheet's chips, memo words met in other inflections, the answer once a
-- learner could not guess a word, and ことばの雨 (a rain of sentences that share a word instead of a way of saying).

-- Each library sentence split, per language, into the pieces a learner picks out (scripts/prepare-parts.mjs → Claude →
-- scripts/apply-parts.mjs). base: the dictionary form, by which a word is found in other sentences. kind 'function': a
-- particle, an ending or a small grammar word, hard to guess by comparing sentences. meaning and gloss are per
-- learner language (meaning: {"ja": "食べる"}, gloss: {"ja": [start, end]} in that language's translation).
create table if not exists public.pl_sentence_parts (
  sentence_id uuid not null references public.pl_sentences on delete cascade,
  lang text not null check (lang in ('ja', 'en', 'ko', 'zh')),
  idx smallint not null,
  start_index int not null,
  end_index int not null check (end_index > start_index),
  base text not null check (char_length(base) between 1 and 60),
  kind text not null default 'word' check (kind in ('word', 'function')),
  meaning jsonb not null default '{}',
  gloss jsonb not null default '{}',
  primary key (sentence_id, lang, idx)
);
create index if not exists pl_sentence_parts_base_idx on public.pl_sentence_parts (lang, base);
alter table public.pl_sentence_parts enable row level security;
drop policy if exists "pl_sentence_parts read" on public.pl_sentence_parts;
create policy "pl_sentence_parts read" on public.pl_sentence_parts for select using (
  exists (select 1 from public.pl_sentences s where s.id = sentence_id and s.status = 'approved')
);

-- A memo word picked from a sentence keeps that piece's dictionary form, so it is met again in other inflections
-- (먹을래 → 먹다 → 먹었어). note is now the learner's guess at its meaning. stuck_at: they marked that they could not
-- guess it (cleared once they write a guess); answered_at: they chose to see its meaning (答え合わせ).
alter table public.pl_words add column if not exists base text;
alter table public.pl_words add column if not exists stuck_at timestamptz;
alter table public.pl_words add column if not exists answered_at timestamptz;
create index if not exists pl_words_base_idx on public.pl_words (user_id, lang, base);

-- ことばの雨: which words the learner has bathed in, and when each comes back (as pl_exposures does for ways of saying).
create table if not exists public.pl_word_exposures (
  user_id uuid not null references auth.users on delete cascade,
  lang text not null check (lang in ('ja', 'en', 'ko', 'zh')),
  base text not null,
  times int not null default 0,
  last_at timestamptz,
  next_at timestamptz,
  return_after int,
  primary key (user_id, lang, base)
);
alter table public.pl_word_exposures enable row level security;
drop policy if exists "pl_word_exposures own" on public.pl_word_exposures;
create policy "pl_word_exposures own" on public.pl_word_exposures
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The day's record of ことばの雨 for 自分, as pl_rain_days is for ways of saying (Japan time, like the limits).
create table if not exists public.pl_word_rain_days (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  lang text not null check (lang in ('ja', 'en', 'ko', 'zh')),
  base text not null,
  times int not null default 1,
  first boolean not null default false,
  last_at timestamptz not null default now(),
  primary key (user_id, day, lang, base)
);
alter table public.pl_word_rain_days enable row level security;
drop policy if exists "pl_word_rain_days own" on public.pl_word_rain_days;
create policy "pl_word_rain_days own" on public.pl_word_rain_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.pl_log_word_rain(p_lang text, p_base text, p_first boolean)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.pl_word_rain_days as d (user_id, day, lang, base, times, first, last_at)
  select auth.uid(), (now() at time zone 'Asia/Tokyo')::date, p_lang, p_base, 1, p_first, now()
  where auth.uid() is not null
  on conflict (user_id, day, lang, base)
  do update set times = d.times + 1, first = d.first or excluded.first, last_at = excluded.last_at;
$$;
revoke all on function public.pl_log_word_rain(text, text, boolean) from public, anon;
grant execute on function public.pl_log_word_rain(text, text, boolean) to authenticated;

-- A sentence said after ことばの雨 keeps the word it was said with, as one said after a way of saying keeps pattern_id.
alter table public.pl_sayings add column if not exists word text;
