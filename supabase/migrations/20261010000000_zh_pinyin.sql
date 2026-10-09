-- Checked pinyin for the library's Chinese sentences: one syllable per Han character, in order, separated by spaces
-- (neutral tones unmarked, erhua 儿 as "r"). Null means not checked yet; the app then falls back to pinyin-pro.
alter table public.pl_sentences add column if not exists zh_pinyin text;
