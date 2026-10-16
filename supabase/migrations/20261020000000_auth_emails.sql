-- The app sends its own sign-up and password emails (Resend, from the old app's verified domain): the shared project's
-- templates and redirect list belong to the old app. They are metered like AI calls, a few per address a day and a
-- ceiling for the whole service, so the sign-up form cannot be used to mail strangers.
alter table public.pl_daily_usage add column if not exists emails int not null default 0;
alter table public.pl_global_usage add column if not exists emails int not null default 0;

-- Returns uses left today for the user, -1 when the user is over their limit, -2 when the service is.
create or replace function public.pl_consume_for(uid uuid, kind text, user_limit int, global_limit int)
returns int
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Tokyo')::date;
  used int;
  global_used int;
begin
  if kind not in ('corrections', 'tts', 'emails') then
    raise exception 'unknown kind %', kind;
  end if;

  insert into pl_daily_usage (user_id, day) values (uid, today) on conflict do nothing;
  insert into pl_global_usage (day) values (today) on conflict do nothing;

  execute format('update pl_global_usage set %1$I = %1$I + 1 where day = $1 and %1$I < $2 returning %1$I', kind)
    into global_used using today, global_limit;
  if global_used is null then
    return -2;
  end if;

  execute format('update pl_daily_usage set %1$I = %1$I + 1 where user_id = $1 and day = $2 and %1$I < $3 returning %1$I', kind)
    into used using uid, today, user_limit;
  if used is null then
    execute format('update pl_global_usage set %1$I = %1$I - 1 where day = $1', kind) using today;
    return -1;
  end if;
  return user_limit - used;
end;
$$;

create or replace function public.pl_refund_for(uid uuid, kind text)
returns void
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if kind not in ('corrections', 'tts', 'emails') then
    return;
  end if;
  execute format('update pl_daily_usage set %1$I = greatest(%1$I - 1, 0) where user_id = $1 and day = $2', kind)
    using uid, today;
  execute format('update pl_global_usage set %1$I = greatest(%1$I - 1, 0) where day = $1', kind) using today;
end;
$$;

revoke all on function public.pl_consume_for(uuid, text, int, int) from public, anon, authenticated;
revoke all on function public.pl_refund_for(uuid, text) from public, anon, authenticated;
grant execute on function public.pl_consume_for(uuid, text, int, int) to service_role;
grant execute on function public.pl_refund_for(uuid, text) to service_role;
