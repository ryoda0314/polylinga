-- ことのあめ: 管理 › 利用状況 (/admin) and 利用者 (/admin/users). How many learners there are and how much of each part
-- they use, for the admin only: everything here is called with the service role (src/lib/admin-usage.ts).
-- A learner is an account with ことのあめ settings (made on /start); the shared project's other accounts are not counted.
-- Days are in Japan, like the daily limits. A day is active when it has a finished rain, a sentence said, a correction or
-- a memo word: opening the app without doing any of these leaves no trace.

-- Accounts left out of the numbers (the admin's own, test accounts), marked on /admin/users/[id].
create table if not exists public.pl_admin_excluded (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.pl_admin_excluded enable row level security; -- no policies: service role only

-- Every learner's active days, one row per learner and day.
create or replace function public.pl_admin_active_days()
returns table (user_id uuid, day date)
language sql stable
set search_path = public
as $$
  select user_id, day from pl_rain_days
  union
  select user_id, (created_at at time zone 'Asia/Tokyo')::date from pl_sayings
  union
  select user_id, (created_at at time zone 'Asia/Tokyo')::date from pl_corrections
  union
  select user_id, (created_at at time zone 'Asia/Tokyo')::date from pl_words;
$$;

-- One row per learner (or only `only_user`): who, since when, and how much of each part they have used.
-- Rains are counted as 自分 counts them (pl_exposures); みんなの雨 only has its day record.
create or replace function public.pl_admin_learners(only_user uuid default null)
returns table (
  user_id uuid,
  username text,
  email text,
  provider text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  native_lang text,
  target_lang text,
  tutorial_seen boolean,
  rain_cue boolean,
  share_rain boolean,
  excluded boolean,
  active_days int,
  first_active date,
  last_active date,
  rains int,
  minna_rains int,
  patterns int,
  sayings int,
  corrections int,
  explained int,
  words int,
  shared int,
  hearts int
)
language sql stable security definer
set search_path = public
as $$
  select
    s.user_id,
    nullif(btrim(u.raw_user_meta_data ->> 'username'), ''),
    u.email::text,
    coalesce(u.raw_app_meta_data ->> 'provider', ''),
    u.created_at,
    u.last_sign_in_at,
    s.native_lang,
    s.target_lang,
    s.tutorial_seen_at is not null,
    coalesce(btrim(s.rain_cue), '') <> '',
    s.share_rain,
    x.user_id is not null,
    coalesce(d.days, 0),
    d.first_day,
    d.last_day,
    coalesce(e.rains, 0),
    coalesce(m.rains, 0),
    coalesce(e.patterns, 0),
    coalesce(y.n, 0),
    coalesce(c.n, 0),
    coalesce(c.explained, 0),
    coalesce(w.n, 0),
    coalesce(sh.n, 0),
    coalesce(h.n, 0)
  from pl_settings s
  join auth.users u on u.id = s.user_id
  left join pl_admin_excluded x on x.user_id = s.user_id
  left join (
    select a.user_id, count(*)::int as days, min(a.day) as first_day, max(a.day) as last_day
    from pl_admin_active_days() a
    group by a.user_id
  ) d on d.user_id = s.user_id
  left join (
    select user_id, sum(times)::int as rains, count(*)::int as patterns
    from pl_exposures
    where times > 0
    group by user_id
  ) e on e.user_id = s.user_id
  left join (
    select user_id, sum(times)::int as rains from pl_rain_days where source = 'minna' group by user_id
  ) m on m.user_id = s.user_id
  left join (select user_id, count(*)::int as n from pl_sayings group by user_id) y on y.user_id = s.user_id
  left join (
    select user_id, count(*)::int as n, count(*) filter (where result ? 'breakdown')::int as explained
    from pl_corrections
    group by user_id
  ) c on c.user_id = s.user_id
  left join (select user_id, count(*)::int as n from pl_words group by user_id) w on w.user_id = s.user_id
  left join (
    select user_id, count(distinct correction_id)::int as n from pl_shared group by user_id
  ) sh on sh.user_id = s.user_id
  left join (select user_id, count(*)::int as n from pl_shared_hearts group by user_id) h on h.user_id = s.user_id
  where only_user is null or s.user_id = only_user;
$$;

-- The last `span_days` days, today included, one row each: accounts made that day, learners active that day (and how
-- many of them for the first time), and what was done. The metered calls (pl_global_usage) are the whole service's,
-- excluded accounts included.
create or replace function public.pl_admin_days(span_days int, with_excluded boolean default false)
returns table (
  day date,
  joined int,
  active int,
  first_time int,
  rains int,
  sayings int,
  corrections int,
  words int,
  ai_corrections int,
  tts int,
  emails int
)
language sql stable security definer
set search_path = public
as $$
  with learners as (
    select s.user_id, u.created_at
    from pl_settings s
    join auth.users u on u.id = s.user_id
    where with_excluded or not exists (select 1 from pl_admin_excluded x where x.user_id = s.user_id)
  ),
  span as (
    select t.today - i as day
    from (select (now() at time zone 'Asia/Tokyo')::date as today) t,
      generate_series(0, least(greatest(span_days, 1), 366) - 1) as i
  ),
  active_rows as (
    select a.user_id, a.day, a.day = min(a.day) over (partition by a.user_id) as is_first
    from pl_admin_active_days() a
    join learners l on l.user_id = a.user_id
  ),
  joined_d as (
    select (created_at at time zone 'Asia/Tokyo')::date as day, count(*)::int as n from learners group by 1
  ),
  active_d as (
    select day, count(*)::int as n, count(*) filter (where is_first)::int as first_time from active_rows group by day
  ),
  rain_d as (
    select r.day, sum(r.times)::int as n
    from pl_rain_days r
    join learners l on l.user_id = r.user_id
    group by r.day
  ),
  said_d as (
    select (y.created_at at time zone 'Asia/Tokyo')::date as day, count(*)::int as n
    from pl_sayings y
    join learners l on l.user_id = y.user_id
    group by 1
  ),
  corr_d as (
    select (c.created_at at time zone 'Asia/Tokyo')::date as day, count(*)::int as n
    from pl_corrections c
    join learners l on l.user_id = c.user_id
    group by 1
  ),
  word_d as (
    select (w.created_at at time zone 'Asia/Tokyo')::date as day, count(*)::int as n
    from pl_words w
    join learners l on l.user_id = w.user_id
    group by 1
  )
  select
    span.day,
    coalesce(j.n, 0),
    coalesce(a.n, 0),
    coalesce(a.first_time, 0),
    coalesce(r.n, 0),
    coalesce(y.n, 0),
    coalesce(c.n, 0),
    coalesce(w.n, 0),
    coalesce(g.corrections, 0),
    coalesce(g.tts, 0),
    coalesce(g.emails, 0)
  from span
  left join joined_d j on j.day = span.day
  left join active_d a on a.day = span.day
  left join rain_d r on r.day = span.day
  left join said_d y on y.day = span.day
  left join corr_d c on c.day = span.day
  left join word_d w on w.day = span.day
  left join pl_global_usage g on g.day = span.day
  order by span.day;
$$;

-- One learner's active days, newest first: rains (and the patterns met for the first time), みんなの雨, sentences said,
-- corrections and memo words.
create or replace function public.pl_admin_learner_days(learner uuid)
returns table (
  day date,
  rains int,
  minna_rains int,
  new_patterns int,
  sayings int,
  corrections int,
  words int
)
language sql stable security definer
set search_path = public
as $$
  with r as (
    select day,
      coalesce(sum(times) filter (where source = 'library'), 0)::int as rains,
      coalesce(sum(times) filter (where source = 'minna'), 0)::int as minna,
      count(*) filter (where first and source = 'library')::int as new_patterns
    from pl_rain_days
    where user_id = learner
    group by day
  ),
  y as (
    select (created_at at time zone 'Asia/Tokyo')::date as day, count(*)::int as n
    from pl_sayings where user_id = learner group by 1
  ),
  c as (
    select (created_at at time zone 'Asia/Tokyo')::date as day, count(*)::int as n
    from pl_corrections where user_id = learner group by 1
  ),
  w as (
    select (created_at at time zone 'Asia/Tokyo')::date as day, count(*)::int as n
    from pl_words where user_id = learner group by 1
  ),
  d as (select day from r union select day from y union select day from c union select day from w)
  select d.day, coalesce(r.rains, 0), coalesce(r.minna, 0), coalesce(r.new_patterns, 0), coalesce(y.n, 0),
    coalesce(c.n, 0), coalesce(w.n, 0)
  from d
  left join r on r.day = d.day
  left join y on y.day = d.day
  left join c on c.day = d.day
  left join w on w.day = d.day
  order by d.day desc;
$$;

revoke all on function public.pl_admin_active_days() from public, anon, authenticated;
revoke all on function public.pl_admin_learners(uuid) from public, anon, authenticated;
revoke all on function public.pl_admin_days(int, boolean) from public, anon, authenticated;
revoke all on function public.pl_admin_learner_days(uuid) from public, anon, authenticated;
grant execute on function public.pl_admin_learners(uuid) to service_role;
grant execute on function public.pl_admin_days(int, boolean) to service_role;
grant execute on function public.pl_admin_learner_days(uuid) to service_role;
