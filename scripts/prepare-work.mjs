// Write one work file per function for hand-written (Claude-written) library content:
// its patterns, published sentences, drafts waiting for a decision, and how many new sets to write.
// The writer answers in scripts/library/work/<id>.out.json; scripts/apply-work.mjs applies it.
//   node --env-file=.env.local scripts/prepare-work.mjs --target=30 [function ids]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fetchAll, LANGS } from "./lib/library.mjs";
import { arg } from "./lib/usage.mjs";

const TARGET = Number(arg("target", 30));
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const DIR = new URL("./library/work/", import.meta.url);
mkdirSync(DIR, { recursive: true });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const inDb = (await supabase.from("pl_functions").select("id, label, position").order("position")).data ?? [];
// Functions listed in functions.json but not created yet: the writer drafts their patterns too.
const listed = JSON.parse(readFileSync(new URL("./library/functions.json", import.meta.url), "utf8"));
const functions = [
  ...inDb,
  ...listed.filter((f) => !inDb.some((d) => d.id === f.id)).map((f) => ({ ...f, isNew: true })),
];
const patterns = await fetchAll((a, b) =>
  supabase.from("pl_patterns").select("id, lang, form, examples, meaning, function_id, status, review").order("id").range(a, b),
);
const sentences = await fetchAll((a, b) =>
  supabase.from("pl_sentences").select("id, key, topic, ja, en, ko, zh, status, review").neq("status", "rejected").order("key").range(a, b),
);
const marks = await fetchAll((a, b) =>
  supabase.from("pl_sentence_patterns").select("sentence_id, lang, start_index, end_index").order("sentence_id").order("lang").range(a, b),
);
const marksBySentence = new Map();
for (const m of marks) {
  const list = marksBySentence.get(m.sentence_id) ?? [];
  list.push(m);
  marksBySentence.set(m.sentence_id, list);
}
const markText = (s) =>
  Object.fromEntries(
    LANGS.map((l) => {
      const m = (marksBySentence.get(s.id) ?? []).find((x) => x.lang === l);
      return [l, m ? s[l].slice(m.start_index, m.end_index) : ""];
    }),
  );

let written = 0;
let totalNew = 0;
for (const fn of functions) {
  if (only.length && !only.includes(fn.id)) continue;
  const fnPatterns = LANGS.map((l) => patterns.find((p) => p.function_id === fn.id && p.lang === l)).filter(Boolean);
  const mine = sentences.filter((s) => s.topic === fn.id);
  const published = mine.filter((s) => s.status === "approved");
  const drafts = mine.filter((s) => s.status === "draft");
  const need = Math.max(5, TARGET - published.length - drafts.length);
  totalNew += need;
  const work = {
    function: { id: fn.id, label: fn.label, brief: fn.brief ?? null, isNew: !!fn.isNew },
    // Forms other functions already use, so a new function picks a different construction.
    otherForms: fn.isNew
      ? Object.fromEntries(LANGS.map((l) => [l, patterns.filter((p) => p.lang === l && p.status !== "rejected").map((p) => p.form)]))
      : undefined,
    patterns: fnPatterns.map((p) => ({
      id: p.id,
      lang: p.lang,
      form: p.form,
      examples: p.examples,
      meaning: p.meaning,
      status: p.status,
      reviewerNote: p.review?.langs?.[p.lang]?.ok === false ? p.review.langs[p.lang] : null,
    })),
    published: published.map((s) => ({ ja: s.ja, en: s.en, ko: s.ko, zh: s.zh, marks: markText(s) })),
    drafts: drafts.map((s) => ({
      key: s.key,
      ja: s.ja,
      en: s.en,
      ko: s.ko,
      zh: s.zh,
      marks: markText(s),
      reviewerNotes: s.review
        ? Object.fromEntries(LANGS.filter((l) => s.review.langs?.[l]?.ok === false).map((l) => [l, s.review.langs[l]]))
        : null,
    })),
    newSetsToWrite: need,
  };
  writeFileSync(new URL(`${fn.id}.json`, DIR), JSON.stringify(work, null, 2) + "\n");
  written++;
}
console.log(`wrote ${written} work files to scripts/library/work/ · ${totalNew} new sets requested in total`);
