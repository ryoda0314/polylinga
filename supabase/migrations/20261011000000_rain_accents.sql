-- ことのあめ: the accent colours follow the app icon's rain. pen → rain (あめ), ink stays (すみ),
-- pine → hydrangea (あじさい), brick → dusk (ゆうやけ).
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.pl_settings'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%accent%'
  loop
    execute format('alter table public.pl_settings drop constraint %I', c);
  end loop;
end $$;

update public.pl_settings
set accent = case accent when 'pen' then 'rain' when 'pine' then 'hydrangea' when 'brick' then 'dusk' else accent end;

alter table public.pl_settings alter column accent set default 'rain';
alter table public.pl_settings
  add constraint pl_settings_accent_check check (accent in ('rain', 'ink', 'hydrangea', 'dusk'));
