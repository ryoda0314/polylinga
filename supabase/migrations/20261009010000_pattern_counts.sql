-- How many approved sentences each approved pattern has in one language.
-- The shower picks a pattern from these counts instead of reading every mark row
-- (PostgREST returns at most 1000 rows per request, which the library will outgrow).
create or replace function public.pl_pattern_counts(target text)
returns table (pattern_id text, n bigint)
language sql stable
set search_path = public
as $$
  select sp.pattern_id, count(*)
  from pl_sentence_patterns sp
  join pl_sentences s on s.id = sp.sentence_id and s.status = 'approved'
  join pl_patterns p on p.id = sp.pattern_id and p.status = 'approved'
  where sp.lang = target
  group by sp.pattern_id;
$$;
