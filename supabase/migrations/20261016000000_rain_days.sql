-- 自分: a day-by-day record of the rain, so the learner can look back on what they bathed in and when.
-- One row per learner, day (in Japan, like the daily limits), pattern and source; it is only ever shown to them.

create table if not exists public.pl_rain_days (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  lang text not null check (lang in ('ja', 'en', 'ko', 'zh')),
  pattern_id text not null references public.pl_patterns on delete cascade,
  source text not null default 'library' check (source in ('library', 'minna')),
  times int not null default 1,
  first boolean not null default false,  -- the day the learner first bathed in this pattern
  last_at timestamptz not null default now(),
  primary key (user_id, day, pattern_id, source)
);
create index if not exists pl_rain_days_user_idx on public.pl_rain_days (user_id, lang, day desc);
alter table public.pl_rain_days enable row level security;
drop policy if exists "pl_rain_days own" on public.pl_rain_days;
create policy "pl_rain_days own" on public.pl_rain_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Count one finished rain for the signed-in learner. The pattern's language comes from the pattern itself.
create or replace function public.pl_log_rain(p_pattern text, p_source text, p_first boolean)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.pl_rain_days as d (user_id, day, lang, pattern_id, source, times, first, last_at)
  select auth.uid(), (now() at time zone 'Asia/Tokyo')::date, p.lang, p.id, p_source, 1, p_first, now()
  from public.pl_patterns p
  where p.id = p_pattern and auth.uid() is not null
  on conflict (user_id, day, pattern_id, source)
  do update set times = d.times + 1, first = d.first or excluded.first, last_at = excluded.last_at;
$$;
revoke all on function public.pl_log_rain(text, text, boolean) from public, anon;
grant execute on function public.pl_log_rain(text, text, boolean) to authenticated;

-- What can be recovered from before: the last day each pattern was bathed in. A pattern met only once was met for the
-- first time that day; earlier meetings of the others are not known, so they show up on their last day only.
insert into public.pl_rain_days (user_id, day, lang, pattern_id, source, times, first, last_at)
select e.user_id, (e.last_at at time zone 'Asia/Tokyo')::date, p.lang, e.pattern_id, 'library', 1, e.times = 1, e.last_at
from public.pl_exposures e
join public.pl_patterns p on p.id = e.pattern_id
where e.last_at is not null and e.times > 0
on conflict do nothing;
