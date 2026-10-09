// Publish drafts the reviewer found no problem with (scripts/review-library.mjs), then make them searchable.
// Patterns: approved when their own language passed. Sentence sets: approved when all four languages passed.
// Anything flagged stays a draft for a person to check in /admin/library, unless --reject-flagged:
// then flagged sentence sets are set aside as 'rejected' (notes kept, restorable in the admin page)
// and the shower is filled by generating more instead. Flagged patterns always stay drafts (fix-patterns.mjs).
//   node --env-file=.env.local scripts/publish-reviewed.mjs [--dry-run] [--reject-flagged]
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { fetchAll, LANGS } from "./lib/library.mjs";

const EMBEDDING_MODEL = "text-embedding-3-small";
const dryRun = process.argv.includes("--dry-run");
const rejectFlagged = process.argv.includes("--reject-flagged");

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const patterns = await fetchAll((a, b) => supabase.from("pl_patterns").select("id, lang, review").eq("status", "draft").order("id").range(a, b));
const sentences = await fetchAll((a, b) =>
  supabase.from("pl_sentences").select("id, ja, en, ko, zh, review").eq("status", "draft").order("id").range(a, b),
);

const okPatterns = (patterns ?? []).filter((p) => p.review?.langs?.[p.lang]?.ok === true).map((p) => p.id);
const okSentences = (sentences ?? []).filter((s) => LANGS.every((l) => s.review?.langs?.[l]?.ok === true));
const flaggedSentences = (sentences ?? []).filter(
  (s) => s.review && LANGS.some((l) => s.review?.langs?.[l] && s.review.langs[l].ok === false),
);
console.log(
  `patterns: ${okPatterns.length} of ${patterns?.length ?? 0} drafts pass · sentence sets: ${okSentences.length} of ${sentences?.length ?? 0} pass`,
);
if (dryRun) process.exit(0);

for (let i = 0; i < okPatterns.length; i += 100) {
  const { error } = await supabase.from("pl_patterns").update({ status: "approved" }).in("id", okPatterns.slice(i, i + 100));
  if (error) throw new Error(error.message);
}
for (let i = 0; i < okSentences.length; i += 100) {
  const ids = okSentences.slice(i, i + 100).map((s) => s.id);
  const { error } = await supabase.from("pl_sentences").update({ status: "approved" }).in("id", ids);
  if (error) throw new Error(error.message);
}
if (rejectFlagged) {
  for (let i = 0; i < flaggedSentences.length; i += 100) {
    const ids = flaggedSentences.slice(i, i + 100).map((s) => s.id);
    const { error } = await supabase.from("pl_sentences").update({ status: "rejected" }).in("id", ids);
    if (error) throw new Error(error.message);
  }
  console.log(`set aside ${flaggedSentences.length} flagged sentence sets`);
}

// Embeddings for every approved sentence that lacks them (used by 書いてみる to find close examples).
const approved = await fetchAll((a, b) =>
  supabase.from("pl_sentences").select("id, ja, en, ko, zh").eq("status", "approved").order("id").range(a, b),
);
const embedded = await fetchAll((a, b) =>
  supabase.from("pl_sentence_embeddings").select("sentence_id, lang").order("sentence_id").order("lang").range(a, b),
);
const have = new Set((embedded ?? []).map((e) => `${e.sentence_id}:${e.lang}`));
const items = (approved ?? []).flatMap((s) =>
  LANGS.filter((l) => !have.has(`${s.id}:${l}`)).map((lang) => ({ sentence_id: s.id, lang, text: s[lang] })),
);
for (let i = 0; i < items.length; i += 200) {
  const batch = items.slice(i, i + 200);
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: batch.map((b) => b.text) });
  const vectors = res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  const { error } = await supabase
    .from("pl_sentence_embeddings")
    .upsert(batch.map((b, j) => ({ sentence_id: b.sentence_id, lang: b.lang, embedding: vectors[j] })));
  if (error) throw new Error(error.message);
}
console.log(`published ${okPatterns.length} patterns and ${okSentences.length} sentence sets; ${items.length} new embeddings`);
