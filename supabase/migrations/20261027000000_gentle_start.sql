-- A gentle start for someone new to the language.
-- step: the order new ways of saying come in, per language learned (lower first; scripts/library/steps.json, stored by
-- scripts/apply-steps.mjs; 500 for one not placed yet). extra: how many other things a beginner would not know yet a
-- sentence carries besides the way of saying it is marked for (0 = none, 2 = two or more; null = not judged), judged by
-- hand and stored by scripts/apply-plain.mjs. A way of saying is first met in its plainest sentences.
alter table public.pl_patterns add column if not exists step smallint not null default 500;
alter table public.pl_sentence_patterns add column if not exists extra smallint check (extra between 0 and 2);
