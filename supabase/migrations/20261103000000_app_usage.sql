-- ことのあめ: 姉妹アプリの使われ方の数（何台の端末が使っているか）。ことのね の kn_ping（../hanjaatume/supabase/usage.sql）と
-- 同じ考え方で、ことのは・ことのおと・ことのめ・ことのえだ・ことのかげ・ことのみ が送る。アカウントと同じく ことのあめ が受け持つ
-- （アプリごとの頭文字では ことのおと の kn_ が ことのね の kn_hours とぶつかるので、ひとつの表に app を添えて数える）。
-- 送られるのは、アプリの名前と、端末ごとの番号（その端末で作った乱数。人ともアカウントとも結びつかない）と、1時間ごとの回数
-- （open 開いた・learn そのアプリの浴びる・聞くを終えた・say 自分で言った・打った）と、ホーム画面から開いたかどうかだけ。
-- 表は外から読めず書けず、pl_app_ping だけがその時間の行を足して数える。管理（/admin/apps）が service role で
-- pl_admin_app_* を読む。ことのね の数（kn_hours・kn_days）も、そこで同じ形に並べる（あつめた → learn、読めた → say）。

create table if not exists public.pl_app_hours (
  app text not null check (app in ('kotonoha', 'kotonooto', 'kotonome', 'kotonoeda', 'kotonokage', 'kotonomi')),
  device uuid not null,
  -- 日本の時刻で、その時間の頭（13:00 なら 13:00〜13:59 の分）
  hour timestamp not null,
  opens int not null default 0,
  learns int not null default 0,
  says int not null default 0,
  -- その時間に、ホーム画面のアイコンから開いたことがある
  standalone boolean not null default false,
  primary key (app, device, hour)
);
create index if not exists pl_app_hours_hour on public.pl_app_hours (app, hour);

alter table public.pl_app_hours enable row level security;
revoke all on table public.pl_app_hours from public, anon, authenticated;

-- その時間の行に一つ数える。知らないアプリ・種類は数えない。だれでも呼べるので、ことのね と同じ天井を付ける
-- （アプリごとに1時間の端末の数、1台の1時間の回数）。
create or replace function public.pl_app_ping(p_app text, p_device uuid, p_kind text, p_standalone boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  this_hour timestamp := date_trunc('hour', now() at time zone 'Asia/Tokyo');
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
  insert into pl_app_hours as h (app, device, hour, opens, learns, says, standalone)
  values (
    p_app,
    p_device,
    this_hour,
    (p_kind = 'open')::int,
    (p_kind = 'learn')::int,
    (p_kind = 'say')::int,
    coalesce(p_standalone, false)
  )
  on conflict (app, device, hour) do update set
    opens = least(h.opens + excluded.opens, 500),
    learns = least(h.learns + excluded.learns, 500),
    says = least(h.says + excluded.says, 500),
    standalone = h.standalone or excluded.standalone;
end;
$$;

revoke all on function public.pl_app_ping(text, uuid, text, boolean) from public;
grant execute on function public.pl_app_ping(text, uuid, text, boolean) to anon, authenticated;

-- Every app's hours in one shape: the sisters' and ことのね's (kn_days is its count by the day, before it counted by
-- the hour; such a day stands at its midnight).
create or replace function public.pl_admin_app_hours()
returns table (app text, device uuid, hour timestamp, opens int, learns int, says int, standalone boolean)
language sql stable
set search_path = public
as $$
  select app, device, hour, opens, learns, says, standalone from pl_app_hours
  union all
  select 'kotonone', device, hour, opens, collects, reads, standalone from kn_hours
  union all
  select 'kotonone', device, day::timestamp, opens, collects, reads, standalone from kn_days;
$$;

-- One row per app that has counted anything: devices ever, today, in the last 7 and 30 days (today included),
-- devices first seen in the last 7 days, devices opened from the home screen, and the last 7 days' counts.
create or replace function public.pl_admin_apps()
returns table (
  app text,
  devices int,
  today int,
  week int,
  month int,
  new_week int,
  from_home_week int,
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
    select app, device, hour::date as day, opens, learns, says, standalone from pl_admin_app_hours()
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
    coalesce(sum(h.opens) filter (where h.day > t.today - 7), 0)::int,
    coalesce(sum(h.learns) filter (where h.day > t.today - 7), 0)::int,
    coalesce(sum(h.says) filter (where h.day > t.today - 7), 0)::int,
    min(h.day),
    max(h.day)
  from h
  cross join t
  group by h.app, t.today;
$$;

-- One app's last `span_days` days, today last: devices that day (and how many for the first time), from the home
-- screen, and the counts.
create or replace function public.pl_admin_app_days(p_app text, span_days int)
returns table (day date, devices int, new_devices int, from_home int, opens int, learns int, says int)
language sql stable security definer
set search_path = public
as $$
  with per_day as (
    select device, hour::date as day, bool_or(standalone) as standalone,
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
      sum(p.opens)::int as opens,
      sum(p.learns)::int as learns,
      sum(p.says)::int as says
    from per_day p
    join firsts f on f.device = p.device
    group by p.day
  )
  select span.day, coalesce(a.devices, 0), coalesce(a.new_devices, 0), coalesce(a.from_home, 0),
    coalesce(a.opens, 0), coalesce(a.learns, 0), coalesce(a.says, 0)
  from span
  left join agg a on a.day = span.day
  order by span.day;
$$;

-- Whether devices came back: for each first day in the last `span_days` days, newest first, how many devices came that
-- day, how many again the next day, within 7 days, and on any later day. A count whose days have not all come yet is null.
create or replace function public.pl_admin_app_cohorts(p_app text, span_days int)
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

-- Accounts keeping their record in each sister's table (signed in to ことのあめ there), without the excluded ones, and
-- how many of those records changed in the last 7 and 30 days. A table not made yet is skipped.
create or replace function public.pl_admin_app_accounts()
returns table (app text, accounts int, week int, month int)
language plpgsql stable security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select * from (values
      ('kotonoha', 'en_records'), ('kotonooto', 'kn_records'), ('kotonome', 'hg_records'),
      ('kotonoeda', 'ke_records'), ('kotonokage', 'sh_records'), ('kotonomi', 'vc_records')
    ) as v (app, tbl)
  loop
    if to_regclass('public.' || r.tbl) is not null then
      return query execute format(
        'select %L::text, count(*)::int,
           (count(*) filter (where updated_at > now() - interval ''7 days''))::int,
           (count(*) filter (where updated_at > now() - interval ''30 days''))::int
         from public.%I t
         where not exists (select 1 from public.pl_admin_excluded x where x.user_id = t.user_id)',
        r.app, r.tbl);
    end if;
  end loop;
end;
$$;

revoke all on function public.pl_admin_app_hours() from public, anon, authenticated;
revoke all on function public.pl_admin_apps() from public, anon, authenticated;
revoke all on function public.pl_admin_app_days(text, int) from public, anon, authenticated;
revoke all on function public.pl_admin_app_cohorts(text, int) from public, anon, authenticated;
revoke all on function public.pl_admin_app_accounts() from public, anon, authenticated;
grant execute on function public.pl_admin_apps() to service_role;
grant execute on function public.pl_admin_app_days(text, int) to service_role;
grant execute on function public.pl_admin_app_cohorts(text, int) to service_role;
grant execute on function public.pl_admin_app_accounts() to service_role;

-- The new function, callable from the sisters at once (tells Supabase's API the schema changed).
notify pgrst, 'reload schema';
