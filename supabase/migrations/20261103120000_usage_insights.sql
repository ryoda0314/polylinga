-- ことのあめ: 使われ方の数を、アプリづくりに生かせる形に分ける。
-- 1. 姉妹アプリの数（pl_app_hours）に、ログインしているかどうか（はい・いいえだけ）と端末の種類（ios：iPhone・iPad、
--    android、pc：パソコン、other）を足す。どちらも人やアカウントとは結びつかない。送るのは各アプリの countUsage。
--    ことのね の端末の種類は、ことのね の kn_hours.platform（../hanjaatume/supabase/usage.sql）から読む（まだ無ければ不明）。
-- 2. 管理（/admin/apps/[id]）：ゲストとログイン、端末の種類、ホーム画面から、どこまで進んだか、曜日と時間。
-- 3. 管理（/admin, /admin/patterns）：ことのあめ の曜日と時間、戻ってきたか、かたちごとの使われ方。
-- 読むのは service role だけ。

alter table public.pl_app_hours add column if not exists signed_in boolean not null default false;
alter table public.pl_app_hours add column if not exists platform text
  check (platform in ('ios', 'android', 'pc', 'other'));

-- Replaced in one go, so a call with the first four names keeps working (the new two have defaults) and there is
-- never a second function of the same name for the API to choose between.
drop function if exists public.pl_app_ping(text, uuid, text, boolean);
create or replace function public.pl_app_ping(
  p_app text,
  p_device uuid,
  p_kind text,
  p_standalone boolean,
  p_signed_in boolean default false,
  p_platform text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  this_hour timestamp := date_trunc('hour', now() at time zone 'Asia/Tokyo');
  kind_of text := case when p_platform in ('ios', 'android', 'pc', 'other') then p_platform end;
begin
  if p_device is null
     or p_app not in ('kotonoha', 'kotonooto', 'kotonome', 'kotonoeda', 'kotonokage', 'kotonomi')
     or p_kind not in ('open', 'learn', 'say') then
    return;
  end if;
  if not exists (select 1 from pl_app_hours where app = p_app and device = p_device and hour = this_hour)
     and (select count(*) from pl_app_hours where app = p_app and hour = this_hour) >= 20000 then
    return;
  end if;
  insert into pl_app_hours as h (app, device, hour, opens, learns, says, standalone, signed_in, platform)
  values (
    p_app,
    p_device,
    this_hour,
    (p_kind = 'open')::int,
    (p_kind = 'learn')::int,
    (p_kind = 'say')::int,
    coalesce(p_standalone, false),
    coalesce(p_signed_in, false),
    kind_of
  )
  on conflict (app, device, hour) do update set
    opens = least(h.opens + excluded.opens, 500),
    learns = least(h.learns + excluded.learns, 500),
    says = least(h.says + excluded.says, 500),
    standalone = h.standalone or excluded.standalone,
    signed_in = h.signed_in or excluded.signed_in,
    platform = coalesce(excluded.platform, h.platform);
end;
$$;

revoke all on function public.pl_app_ping(text, uuid, text, boolean, boolean, text) from public;
grant execute on function public.pl_app_ping(text, uuid, text, boolean, boolean, text) to anon, authenticated;

-- The admin functions change shape: made again.
drop function if exists public.pl_admin_apps();
drop function if exists public.pl_admin_app_days(text, int);
drop function if exists public.pl_admin_app_cohorts(text, int);
drop function if exists public.pl_admin_app_hours();

-- Every app's hours in one shape. `hourly` is false for ことのね's kn_days (a whole day counted at its midnight), which
-- says nothing about the time of day. ことのね has no accounts, so it is never signed in; its platform is read as
-- json so this works whether or not its kn_hours has the column yet.
create function public.pl_admin_app_hours()
returns table (
  app text, device uuid, hour timestamp, opens int, learns int, says int, standalone boolean,
  signed_in boolean, platform text, hourly boolean
)
language sql stable
set search_path = public
as $$
  select app, device, hour, opens, learns, says, standalone, signed_in, platform, true from pl_app_hours
  union all
  select 'kotonone', k.device, k.hour, k.opens, k.collects, k.reads, k.standalone, false,
    to_jsonb(k) ->> 'platform', true
  from kn_hours k
  union all
  select 'kotonone', device, day::timestamp, opens, collects, reads, standalone, false, null, false from kn_days;
$$;

create function public.pl_admin_apps()
returns table (
  app text,
  devices int,
  today int,
  week int,
  month int,
  new_week int,
  from_home_week int,
  signed_week int,
  opens_week int,
  learns_week int,
  says_week int,
  first_day date,
  last_day date
)
language sql stable security definer
set search_path = public
as $$
  with h as (
    select app, device, hour::date as day, opens, learns, says, standalone, signed_in from pl_admin_app_hours()
  ),
  t as (select (now() at time zone 'Asia/Tokyo')::date as today),
  firsts as (select app, device, min(day) as first_day from h group by app, device)
  select
    h.app,
    count(distinct h.device)::int,
    (count(distinct h.device) filter (where h.day = t.today))::int,
    (count(distinct h.device) filter (where h.day > t.today - 7))::int,
    (count(distinct h.device) filter (where h.day > t.today - 30))::int,
    (select count(*) from firsts f where f.app = h.app and f.first_day > t.today - 7)::int,
    (count(distinct h.device) filter (where h.day > t.today - 7 and h.standalone))::int,
    (count(distinct h.device) filter (where h.day > t.today - 7 and h.signed_in))::int,
    coalesce(sum(h.opens) filter (where h.day > t.today - 7), 0)::int,
    coalesce(sum(h.learns) filter (where h.day > t.today - 7), 0)::int,
    coalesce(sum(h.says) filter (where h.day > t.today - 7), 0)::int,
    min(h.day),
    max(h.day)
  from h
  cross join t
  group by h.app, t.today;
$$;

create function public.pl_admin_app_days(p_app text, span_days int)
returns table (
  day date, devices int, new_devices int, from_home int, signed_in int, opens int, learns int, says int
)
language sql stable security definer
set search_path = public
as $$
  with per_day as (
    select device, hour::date as day, bool_or(standalone) as standalone, bool_or(signed_in) as signed_in,
      sum(opens) as opens, sum(learns) as learns, sum(says) as says
    from pl_admin_app_hours()
    where app = p_app
    group by device, hour::date
  ),
  firsts as (select device, min(day) as first_day from per_day group by device),
  span as (
    select t.today - i as day
    from (select (now() at time zone 'Asia/Tokyo')::date as today) t,
      generate_series(0, least(greatest(span_days, 1), 366) - 1) as i
  ),
  agg as (
    select p.day,
      count(*)::int as devices,
      (count(*) filter (where p.day = f.first_day))::int as new_devices,
      (count(*) filter (where p.standalone))::int as from_home,
      (count(*) filter (where p.signed_in))::int as signed_in,
      sum(p.opens)::int as opens,
      sum(p.learns)::int as learns,
      sum(p.says)::int as says
    from per_day p
    join firsts f on f.device = p.device
    group by p.day
  )
  select span.day, coalesce(a.devices, 0), coalesce(a.new_devices, 0), coalesce(a.from_home, 0),
    coalesce(a.signed_in, 0), coalesce(a.opens, 0), coalesce(a.learns, 0), coalesce(a.says, 0)
  from span
  left join agg a on a.day = span.day
  order by span.day;
$$;

create function public.pl_admin_app_cohorts(p_app text, span_days int)
returns table (first_day date, devices int, back_next int, back_week int, back_any int)
language sql stable security definer
set search_path = public
as $$
  with active as (
    select distinct device, hour::date as day from pl_admin_app_hours() where app = p_app
  ),
  firsts as (select device, min(day) as first_day from active group by device),
  t as (select (now() at time zone 'Asia/Tokyo')::date as today)
  select
    f.first_day,
    count(distinct f.device)::int,
    case when f.first_day + 1 <= t.today
      then (count(distinct a.device) filter (where a.day = f.first_day + 1))::int end,
    case when f.first_day + 7 <= t.today
      then (count(distinct a.device) filter (where a.day <= f.first_day + 7))::int end,
    count(distinct a.device)::int
  from firsts f
  cross join t
  left join active a on a.device = f.device and a.day > f.first_day
  where f.first_day > t.today - least(greatest(span_days, 1), 366)
  group by f.first_day, t.today
  order by f.first_day desc;
$$;

-- Who the devices of the last `span_days` days were, each counted once per kind:
--   login: signed (signed in at some time) / guest;  platform: ios / android / pc / other / unknown (its latest);
--   home: home (opened from the home screen at some time) / browser;
--   reach: opened (all) / learned / said / two_days / three_days (active on that many days).
create or replace function public.pl_admin_app_profile(p_app text, span_days int)
returns table (kind text, key text, devices int)
language sql stable security definer
set search_path = public
as $$
  with h as (
    select * from pl_admin_app_hours()
    where app = p_app
      and hour >= ((now() at time zone 'Asia/Tokyo')::date - (least(greatest(span_days, 1), 366) - 1))::timestamp
  ),
  per_device as (
    select device,
      bool_or(signed_in) as signed_in,
      bool_or(standalone) as standalone,
      (array_agg(platform order by hour desc) filter (where platform is not null))[1] as platform,
      sum(learns) as learns,
      sum(says) as says,
      count(distinct hour::date) as days
    from h
    group by device
  )
  select 'login', case when signed_in then 'signed' else 'guest' end, count(*)::int from per_device group by 2
  union all
  select 'platform', coalesce(platform, 'unknown'), count(*)::int from per_device group by 2
  union all
  select 'home', case when standalone then 'home' else 'browser' end, count(*)::int from per_device group by 2
  union all
  select 'reach', r.key, r.n
  from (
    select 'opened' as key, count(*)::int as n, 1 as o from per_device
    union all select 'learned', (count(*) filter (where learns > 0))::int, 2 from per_device
    union all select 'said', (count(*) filter (where says > 0))::int, 3 from per_device
    union all select 'two_days', (count(*) filter (where days >= 2))::int, 4 from per_device
    union all select 'three_days', (count(*) filter (where days >= 3))::int, 5 from per_device
  ) r;
$$;

-- Devices by weekday (1 Monday … 7 Sunday) and hour, Japan time, over the last `span_days` days.
create or replace function public.pl_admin_app_week_hours(p_app text, span_days int)
returns table (dow int, hour int, devices int)
language sql stable security definer
set search_path = public
as $$
  select extract(isodow from h.hour)::int, extract(hour from h.hour)::int, count(distinct h.device)::int
  from pl_admin_app_hours() h
  where h.app = p_app and h.hourly
    and h.hour >= ((now() at time zone 'Asia/Tokyo')::date - (least(greatest(span_days, 1), 366) - 1))::timestamp
  group by 1, 2;
$$;

-- ことのあめ: learners by weekday and hour over the last `span_days` days, from the moments that leave a time
-- (a rain finished — its last time that day for each pattern —, a sentence said, a memo word).
create or replace function public.pl_admin_week_hours(span_days int, with_excluded boolean default false)
returns table (dow int, hour int, learners int)
language sql stable security definer
set search_path = public
as $$
  with learners as (
    select s.user_id from pl_settings s
    where with_excluded or not exists (select 1 from pl_admin_excluded x where x.user_id = s.user_id)
  ),
  since as (
    select (((now() at time zone 'Asia/Tokyo')::date - (least(greatest(span_days, 1), 366) - 1))::timestamp
      at time zone 'Asia/Tokyo') as at
  ),
  moments as (
    select user_id, last_at as at from pl_rain_days
    union all select user_id, created_at from pl_sayings
    union all select user_id, created_at from pl_words
  )
  select extract(isodow from m.at at time zone 'Asia/Tokyo')::int,
    extract(hour from m.at at time zone 'Asia/Tokyo')::int,
    count(distinct m.user_id)::int
  from moments m
  join learners l on l.user_id = m.user_id
  cross join since
  where m.at >= since.at
  group by 1, 2;
$$;

-- ことのあめ: whether learners came back, by their first active day in the last `span_days` days, newest first.
create or replace function public.pl_admin_cohorts(span_days int, with_excluded boolean default false)
returns table (first_day date, learners int, back_next int, back_week int, back_any int)
language sql stable security definer
set search_path = public
as $$
  with learners as (
    select s.user_id from pl_settings s
    where with_excluded or not exists (select 1 from pl_admin_excluded x where x.user_id = s.user_id)
  ),
  active as (
    select a.user_id, a.day from pl_admin_active_days() a join learners l on l.user_id = a.user_id
  ),
  firsts as (select user_id, min(day) as first_day from active group by user_id),
  t as (select (now() at time zone 'Asia/Tokyo')::date as today)
  select
    f.first_day,
    count(distinct f.user_id)::int,
    case when f.first_day + 1 <= t.today
      then (count(distinct a.user_id) filter (where a.day = f.first_day + 1))::int end,
    case when f.first_day + 7 <= t.today
      then (count(distinct a.user_id) filter (where a.day <= f.first_day + 7))::int end,
    count(distinct a.user_id)::int
  from firsts f
  cross join t
  left join active a on a.user_id = f.user_id and a.day > f.first_day
  where f.first_day > t.today - least(greatest(span_days, 1), 366)
  group by f.first_day, t.today
  order by f.first_day desc;
$$;

-- ことのあめ: every approved pattern of one language in the beginner's order (step, then the function's place), with
-- how many learners bathed in it, met it again (bathed twice or more), said something with it, and how many of those
-- sentences the correction found natural as written.
create or replace function public.pl_admin_patterns(p_lang text, with_excluded boolean default false)
returns table (
  pattern_id text, form text, label text, step int,
  learners int, rains int, again int, said_learners int, sayings int, corrections int, said_naturally int
)
language sql stable security definer
set search_path = public
as $$
  with learners as (
    select s.user_id from pl_settings s
    where with_excluded or not exists (select 1 from pl_admin_excluded x where x.user_id = s.user_id)
  ),
  e as (
    select e.pattern_id,
      (count(*) filter (where e.times > 0))::int as learners,
      coalesce(sum(e.times), 0)::int as rains,
      (count(*) filter (where e.times >= 2))::int as again
    from pl_exposures e
    join learners l on l.user_id = e.user_id
    group by e.pattern_id
  ),
  y as (
    select y.pattern_id, count(distinct y.user_id)::int as said_learners, count(*)::int as sayings
    from pl_sayings y
    join learners l on l.user_id = y.user_id
    where y.pattern_id is not null
    group by y.pattern_id
  ),
  c as (
    select y.pattern_id,
      count(*)::int as corrections,
      (count(*) filter (where (c.result ->> 'natural')::boolean))::int as said_naturally
    from pl_corrections c
    join pl_sayings y on y.id = c.saying_id
    join learners l on l.user_id = c.user_id
    where y.pattern_id is not null
    group by y.pattern_id
  )
  select p.id, p.form, coalesce(f.label ->> 'ja', ''), p.step::int,
    coalesce(e.learners, 0), coalesce(e.rains, 0), coalesce(e.again, 0),
    coalesce(y.said_learners, 0), coalesce(y.sayings, 0), coalesce(c.corrections, 0), coalesce(c.said_naturally, 0)
  from pl_patterns p
  left join pl_functions f on f.id = p.function_id
  left join e on e.pattern_id = p.id
  left join y on y.pattern_id = p.id
  left join c on c.pattern_id = p.id
  where p.lang = p_lang and p.status = 'approved'
  order by p.step nulls last, f.position nulls last, p.id;
$$;

revoke all on function public.pl_admin_app_hours() from public, anon, authenticated;
revoke all on function public.pl_admin_apps() from public, anon, authenticated;
revoke all on function public.pl_admin_app_days(text, int) from public, anon, authenticated;
revoke all on function public.pl_admin_app_cohorts(text, int) from public, anon, authenticated;
revoke all on function public.pl_admin_app_profile(text, int) from public, anon, authenticated;
revoke all on function public.pl_admin_app_week_hours(text, int) from public, anon, authenticated;
revoke all on function public.pl_admin_week_hours(int, boolean) from public, anon, authenticated;
revoke all on function public.pl_admin_cohorts(int, boolean) from public, anon, authenticated;
revoke all on function public.pl_admin_patterns(text, boolean) from public, anon, authenticated;
grant execute on function public.pl_admin_apps() to service_role;
grant execute on function public.pl_admin_app_days(text, int) to service_role;
grant execute on function public.pl_admin_app_cohorts(text, int) to service_role;
grant execute on function public.pl_admin_app_profile(text, int) to service_role;
grant execute on function public.pl_admin_app_week_hours(text, int) to service_role;
grant execute on function public.pl_admin_week_hours(int, boolean) to service_role;
grant execute on function public.pl_admin_cohorts(int, boolean) to service_role;
grant execute on function public.pl_admin_patterns(text, boolean) to service_role;

notify pgrst, 'reload schema';
