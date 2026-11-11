// Write library sentences in batches for splitting into 語のまとまり by hand (Claude): the pieces a learner picks out
// and memo, each with its dictionary form, what it means in that sentence and its part of the Japanese translation.
// The word sheet's chips, memo words met again in other inflections, and the answer shown once a learner could not
// guess a word come from this. The browser's own splitting (Intl.Segmenter) keeps Korean particles and endings on
// their words (집에, 먹을래) and runs some Chinese words together (我还没), so it is prepared here instead.
// Each batch carries its rules and the answer it expects in <batch>.out.json; scripts/check-parts.mjs checks answers.
// Sentences come in the beginner's order (pl_patterns.step), so the ones learners meet first are done first; a sentence
// already in a batch is never written again.
//   node --env-file=.env.local scripts/prepare-parts.mjs [--langs=ko,zh,en] [--size=60] [--batches=4]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fetchAll } from "./lib/library.mjs";
import { ANSWER, RULES } from "./lib/parts.mjs";
import { arg } from "./lib/usage.mjs";

const langs = arg("langs", "ko,zh,en").split(",");
const SIZE = Number(arg("size", 60));
const BATCHES = Number(arg("batches", Infinity));
const DIR = new URL("./library/work/parts/", import.meta.url);
mkdirSync(DIR, { recursive: true });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const [patterns, functions] = await Promise.all([
  fetchAll((a, b) => supabase.from("pl_patterns").select("id, lang, function_id, step").order("id").range(a, b)),
  fetchAll((a, b) => supabase.from("pl_functions").select("id, position").order("id").range(a, b)),
]);
const position = new Map(functions.map((f) => [f.id, f.position]));

for (const lang of langs) {
  const existing = readdirSync(DIR).filter((f) => new RegExp(`^${lang}-\\d+\\.json$`).test(f));
  const done = new Set(existing.flatMap((f) => JSON.parse(readFileSync(new URL(f, DIR), "utf8")).items.map((i) => i.id)));
  let next = Math.max(0, ...existing.map((f) => Number(f.match(/-(\d+)\.json$/)[1]))) + 1;

  // The beginner's order: each way of saying by its step (then its function's place), its sentences under it.
  const order = patterns
    .filter((p) => p.lang === lang)
    .sort((a, b) => (a.step ?? 500) - (b.step ?? 500) || (position.get(a.function_id) ?? 999) - (position.get(b.function_id) ?? 999));
  const rank = new Map(order.map((p, i) => [p.id, i]));
  const marks = await fetchAll((a, b) =>
    supabase
      .from("pl_sentence_patterns")
      .select(`sentence_id, pattern_id, pl_sentences!inner(ja, ${lang}, status)`)
      .eq("lang", lang)
      .eq("pl_sentences.status", "approved")
      .order("sentence_id")
      .range(a, b),
  );
  const first = new Map();
  for (const m of marks) {
    const r = rank.get(m.pattern_id) ?? Infinity;
    const had = first.get(m.sentence_id);
    if (!had || r < had.r) first.set(m.sentence_id, { r, id: m.sentence_id, text: m.pl_sentences[lang], ja: m.pl_sentences.ja });
  }
  const todo = [...first.values()].filter((s) => !done.has(s.id)).sort((a, b) => a.r - b.r || a.id.localeCompare(b.id));

  let written = 0;
  for (let i = 0; i < todo.length && written < BATCHES; i += SIZE, written++) {
    const name = `${lang}-${String(next++).padStart(3, "0")}`;
    const items = todo.slice(i, i + SIZE).map((s, n) => ({ n, id: s.id, text: s.text, ja: s.ja }));
    const file = new URL(`${name}.json`, DIR);
    if (existsSync(file)) throw new Error(`${name}.json already exists`);
    writeFileSync(file, JSON.stringify({ lang, batch: name, answer: ANSWER, rules: RULES[lang], items }, null, 1) + "\n");
  }
  console.log(`${lang}: ${first.size} approved sentences, ${done.size} already in a batch, ${todo.length} to go; wrote ${written} batches of up to ${SIZE}`);
}
