-- The learner's plan for when they bathe in the rain ("電車に乗ったら"): an everyday moment the rain follows, so it can
-- become a habit without streaks or reminders. Asked once after their first rain; changeable in settings.
alter table public.pl_settings
  add column if not exists rain_cue text check (rain_cue is null or char_length(rain_cue) between 1 and 30),
  add column if not exists rain_cue_asked boolean not null default false;
