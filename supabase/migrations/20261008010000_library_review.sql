-- Second-opinion notes from the automated reviewer (scripts/review-library.mjs), shown in /admin/library.
-- {"checked_at": "...", "langs": {"ko": {"ok": false, "note": "...", "suggestion": "..."}, ...}}
alter table public.pl_sentences add column if not exists review jsonb;
alter table public.pl_patterns add column if not exists review jsonb;
