// Write the sentences of each language's opening ways of saying (steps.json "first", or the functions named) for
// judging by hand (Claude): how many other things a beginner would not know yet each one carries besides the way of
// saying it is marked for. The judge answers in scripts/library/work/plain/<lang>.out.json
// ([{ "n": <item number>, "extra": 0 | 1 | 2, "why": "<what, when not 0>" }]); scripts/apply-plain.mjs stores it.
//   node --env-file=.env.local scripts/prepare-plain.mjs [--langs=ko,zh,en] [function ids]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fetchAll } from "./lib/library.mjs";
import { arg } from "./lib/usage.mjs";

const langs = arg("langs", "ko,zh,en").split(",");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const steps = JSON.parse(readFileSync(new URL("./library/steps.json", import.meta.url), "utf8"));
const DIR = new URL("./library/work/plain/", import.meta.url);
mkdirSync(DIR, { recursive: true });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const [functions, patterns] = await Promise.all([
  fetchAll((a, b) => supabase.from("pl_functions").select("id, label").order("id").range(a, b)),
  fetchAll((a, b) => supabase.from("pl_patterns").select("id, lang, function_id, form").order("id").range(a, b)),
]);
const label = new Map(functions.map((f) => [f.id, f.label?.ja ?? f.id]));

for (const lang of langs) {
  const ids = only.length ? only : (steps[lang]?.first ?? []);
  const items = [];
  const refs = [];
  for (const fn of ids) {
    const pattern = patterns.find((p) => p.lang === lang && p.function_id === fn);
    if (!pattern) {
      console.log(`${lang}: no pattern for ${fn}`);
      continue;
    }
    const marks = await fetchAll((a, b) =>
      supabase
        .from("pl_sentence_patterns")
        .select(`sentence_id, start_index, end_index, pl_sentences!inner(ja, ${lang}, status)`)
        .eq("pattern_id", pattern.id)
        .eq("lang", lang)
        .eq("pl_sentences.status", "approved")
        .order("sentence_id")
        .range(a, b),
    );
    for (const m of marks) {
      const text = m.pl_sentences[lang];
      items.push({
        n: items.length,
        way: `${label.get(fn)}: ${pattern.form}`,
        text,
        lit: text.slice(m.start_index, m.end_index),
        ja: m.pl_sentences.ja,
      });
      refs.push({ sentence_id: m.sentence_id, pattern_id: pattern.id, text });
    }
  }
  writeFileSync(new URL(`${lang}.json`, DIR), JSON.stringify({ lang, refs, items }, null, 1) + "\n");
  console.log(`${lang}: ${items.length} sentences from ${ids.length} ways of saying → scripts/library/work/plain/${lang}.json`);
}
