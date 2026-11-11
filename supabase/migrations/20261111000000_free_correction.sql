-- 自由に添削: a sentence the learner wrote, corrected as it is. It needs neither a Japanese intent nor a pattern, so a
-- saying no longer has to start from one of them (pl_sayings_has_start was made for 書いてみる and これで言ってみる).
alter table public.pl_sayings drop constraint if exists pl_sayings_has_start;

-- How the learner wants it to sound (軽く誘う感じ, 目上の人に丁寧に), added with ＋ if they like. Kept with the saying,
-- so every correction of it (もう一度書く too) follows it.
alter table public.pl_sayings add column if not exists nuance text
  check (nuance is null or char_length(nuance) between 1 and 200);
