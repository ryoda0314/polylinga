-- The hands-on tutorial (/tutorial): shown once to a new learner after they choose a language, and on request after.
alter table public.pl_settings add column if not exists tutorial_seen_at timestamptz;
