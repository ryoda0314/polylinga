// Store the judged plainness of sentences (scripts/library/work/plain/<lang>.json and its .out.json, see
// prepare-plain.mjs) as pl_sentence_patterns.extra, while the sentence still reads the same, and show how many plain
// ones each way of saying has: fewer than two rains' worth means a beginner meets it in harder sentences too soon.
//   node --env-file=.env.local scripts/apply-plain.mjs [langs] [--dry-run]
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DIR = new URL("./library/work/plain/", import.meta.url);
const dryRun = process.argv.includes("--dry-run");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const langs = only.length ? only : ["ko", "zh", "en"];
const TWO_RAINS = 8;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const problems = [];
for (const lang of langs) {
  const inFile = new URL(`${lang}.json`, DIR);
  const outFile = new URL(`${lang}.out.json`, DIR);
  if (!existsSync(inFile) || !existsSync(outFile)) {
    console.log(`${lang}: nothing to apply`);
    continue;
  }
  const { refs, items } = JSON.parse(readFileSync(inFile, "utf8"));
  const judged = new Map();
  for (const j of JSON.parse(readFileSync(outFile, "utf8"))) {
    if (!items[j.n]) problems.push(`${lang} #${j.n}: no such item`);
    else if (![0, 1, 2].includes(j.extra)) problems.push(`${lang} #${j.n}: extra must be 0, 1 or 2`);
    else judged.set(j.n, j.extra);
  }
  for (const item of items) if (!judged.has(item.n)) problems.push(`${lang} #${item.n}: not judged — ${item.text}`);

  // Only sentences that still read as they did when judged.
  const ids = [...new Set(refs.map((r) => r.sentence_id))];
  const current = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from("pl_sentences").select(`id, ${lang}`).in("id", ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const row of data) current.set(row.id, row[lang]);
  }

  const groups = new Map(); // `${pattern}|${extra}` -> sentence ids
  const plain = new Map(); // way of saying -> [plain, all]
  for (const item of items) {
    const ref = refs[item.n];
    const extra = judged.get(item.n);
    if (extra === undefined) continue;
    if (current.get(ref.sentence_id) !== ref.text) {
      problems.push(`${lang} #${item.n}: changed since it was judged — ${ref.text}`);
      continue;
    }
    const key = `${ref.pattern_id}|${extra}`;
    groups.set(key, [...(groups.get(key) ?? []), ref.sentence_id]);
    const [p, all] = plain.get(item.way) ?? [0, 0];
    plain.set(item.way, [p + (extra === 0 ? 1 : 0), all + 1]);
  }

  if (!dryRun) {
    for (const [key, sentenceIds] of groups) {
      const [patternId, extra] = key.split("|");
      const { error } = await supabase
        .from("pl_sentence_patterns")
        .update({ extra: Number(extra) })
        .eq("pattern_id", patternId)
        .eq("lang", lang)
        .in("sentence_id", sentenceIds);
      if (error) throw new Error(`${patternId}: ${error.message}`);
    }
  }
  console.log(`${dryRun ? "[dry run] " : ""}${lang}: ${judged.size} of ${items.length} judged`);
  for (const [way, [p, all]] of plain) console.log(`  ${p < TWO_RAINS ? "!" : " "} ${String(p).padStart(2)} / ${all} plain  ${way}`);
}
if (problems.length) console.log(`problems ${problems.length}:\n` + problems.slice(0, 40).join("\n"));
