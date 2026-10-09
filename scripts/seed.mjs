// Load the hand-written library (scripts/seed-data.json) into Supabase as approved content and build embeddings.
//   node --env-file=.env.local scripts/seed.mjs            # validate + write
//   node --env-file=.env.local scripts/seed.mjs --dry-run  # validate only
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { LANGS, validateLibrary } from "./lib/library.mjs";

const EMBEDDING_MODEL = "text-embedding-3-small";
const dryRun = process.argv.includes("--dry-run");

const data = JSON.parse(readFileSync(new URL("./seed-data.json", import.meta.url), "utf8"));
const { problems, marks } = validateLibrary(data);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(
  `ok: ${data.functions.length} functions, ${data.patterns.length} patterns, ${data.sentences.length} sentences, ${marks.length} marks`,
);
if (dryRun) process.exit(0);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function check(label, { error }) {
  if (error) {
    console.error(label, error.message);
    process.exit(1);
  }
}

check("functions", await supabase.from("pl_functions").upsert(data.functions));
check(
  "patterns",
  await supabase
    .from("pl_patterns")
    .upsert(data.patterns.map((p) => ({ ...p, status: "approved", source: "hand" }))),
);

const sentenceRows = data.sentences.map(({ key, topic, ja, en, ko, zh }) => ({
  key,
  topic,
  ja,
  en,
  ko,
  zh,
  status: "approved",
  source: "hand",
}));
const upserted = await supabase.from("pl_sentences").upsert(sentenceRows, { onConflict: "key" }).select("id, key");
check("sentences", upserted);
const idByKey = new Map(upserted.data.map((r) => [r.key, r.id]));
const ids = [...idByKey.values()];

check("clear marks", await supabase.from("pl_sentence_patterns").delete().in("sentence_id", ids));
check(
  "marks",
  await supabase
    .from("pl_sentence_patterns")
    .insert(marks.map(({ key, ...m }) => ({ sentence_id: idByKey.get(key), ...m }))),
);

const items = data.sentences.flatMap((s) =>
  LANGS.map((lang) => ({ sentence_id: idByKey.get(s.key), lang, text: s[lang] })),
);
const embeddings = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: items.map((i) => i.text) });
check(
  "embeddings",
  await supabase.from("pl_sentence_embeddings").upsert(
    items.map((item, i) => ({ sentence_id: item.sentence_id, lang: item.lang, embedding: embeddings.data[i].embedding })),
  ),
);

console.log(`seeded ${ids.length} sentences, ${items.length} embeddings`);
