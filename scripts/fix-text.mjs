// Correct the text of published sentences and move their marks to match.
// Input: a JSON file with [{ "topic": "<function id>", "lang": "ko", "from": "<old sentence>", "to": "<new sentence>" }]
// The sentence's existing mark text must still occur exactly once in the new sentence.
//   node --env-file=.env.local scripts/fix-text.mjs fixes.json [--dry-run]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const file = process.argv.find((a) => a.endsWith(".json"));
const dryRun = process.argv.includes("--dry-run");
if (!file) {
  console.error("usage: node --env-file=.env.local scripts/fix-text.mjs fixes.json [--dry-run]");
  process.exit(1);
}
const fixes = JSON.parse(readFileSync(file, "utf8"));
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let done = 0;
for (const f of fixes) {
  const { data: rows } = await supabase.from("pl_sentences").select(`id, ${f.lang}`).eq("topic", f.topic).eq(f.lang, f.from);
  const row = rows?.[0];
  if (!row) {
    console.log(`not found: [${f.topic}/${f.lang}] ${f.from}`);
    continue;
  }
  const { data: mark } = await supabase
    .from("pl_sentence_patterns")
    .select("start_index, end_index")
    .eq("sentence_id", row.id)
    .eq("lang", f.lang)
    .maybeSingle();
  let update = null;
  if (mark) {
    const sub = f.from.slice(mark.start_index, mark.end_index);
    const at = f.to.indexOf(sub);
    if (at === -1 || f.to.indexOf(sub, at + 1) !== -1) {
      console.log(`mark "${sub}" not found exactly once in: ${f.to}`);
      continue;
    }
    update = { start_index: at, end_index: at + sub.length };
  }
  if (!dryRun) {
    // A changed Chinese sentence loses its checked pinyin until scripts/prepare-pinyin.mjs picks it up again.
    await supabase.from("pl_sentences").update({ [f.lang]: f.to, ...(f.lang === "zh" ? { zh_pinyin: null } : {}) }).eq("id", row.id);
    if (update) await supabase.from("pl_sentence_patterns").update(update).eq("sentence_id", row.id).eq("lang", f.lang);
  }
  done++;
  console.log(`${dryRun ? "[dry run] " : ""}${f.topic}/${f.lang}: ${f.from} → ${f.to}`);
}
console.log(`${done} of ${fixes.length} fixed`);
