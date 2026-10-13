-- 書いてみる hints, chosen by the way of saying as well as by meaning. The old search (pl_match_sentences) took the
-- three sentences closest in meaning, which mostly shared topic words (カフェ, ラーメン) with what the learner wanted
-- to say rather than a way of saying it. This returns one sentence per function (かたち): the function's best sentence,
-- ranked by that sentence's closeness plus the closeness of the function's average meaning. Averaging a function's
-- sentences cancels their topics and leaves the way of saying they share.

create or replace function public.pl_hint_sentences(
  query_embedding extensions.vector(1536),
  query_lang text,
  target_lang text,
  match_count int default 3
)
returns table (sentence_id uuid, function_id text, similarity float, form_similarity float)
language sql stable
set search_path = public, extensions
as $$
  with fn as (
    select distinct sp.sentence_id, p.function_id
    from public.pl_sentence_patterns sp
    join public.pl_patterns p on p.id = sp.pattern_id
    where sp.lang = target_lang and p.function_id is not null
  ),
  sims as (
    select e.sentence_id, fn.function_id, e.embedding, 1 - (e.embedding <=> query_embedding) as sim
    from public.pl_sentence_embeddings e
    join public.pl_sentences s on s.id = e.sentence_id and s.status = 'approved'
    join fn on fn.sentence_id = e.sentence_id
    where e.lang = query_lang
  ),
  forms as (
    select sims.function_id, 1 - (avg(sims.embedding) <=> query_embedding) as form_sim
    from sims group by sims.function_id
  ),
  best as (
    select distinct on (sims.function_id) sims.sentence_id, sims.function_id, sims.sim
    from sims order by sims.function_id, sims.sim desc
  )
  select best.sentence_id, best.function_id, best.sim, forms.form_sim
  from best join forms using (function_id)
  order by best.sim + forms.form_sim desc
  limit least(match_count, 10);
$$;

revoke all on function public.pl_hint_sentences(extensions.vector, text, text, int) from public, anon;
grant execute on function public.pl_hint_sentences(extensions.vector, text, text, int) to authenticated;
