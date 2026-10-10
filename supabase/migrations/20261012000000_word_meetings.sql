-- When a memo word last turned up in the rain or in the learner's own corrected sentence.
-- last_seen_at also moves when the word is typed in again, so it cannot tell a meeting from a typing.
alter table public.pl_words add column if not exists last_met_at timestamptz;
