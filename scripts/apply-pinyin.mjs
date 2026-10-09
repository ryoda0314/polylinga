// Store checked pinyin from scripts/library/work/pinyin/<batch>.json and its corrections in <batch>.out.json
// ([{ "n": <item number>, "py": "<all syllables of the sentence>" }]). Items without a correction keep the generated
// reading. Every reading needs one valid syllable per Han character, or the item is skipped and stays unchecked.
//   node --env-file=.env.local scripts/apply-pinyin.mjs [batch names] [--dry-run]
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { hanCount } from "../src/lib/reading-core.ts";

const DIR = new URL("./library/work/pinyin/", import.meta.url);
const dryRun = process.argv.includes("--dry-run");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const SYLLABLE = /^(?:[a-zāáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜê]+|r)$/;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const batches = readdirSync(DIR)
  .filter((f) => /^batch-\d+\.json$/.test(f))
  .map((f) => f.replace(".json", ""))
  .filter((b) => !only.length || only.includes(b));

const problems = [];
const updates = [];
let corrected = 0;
for (const name of batches) {
  const batch = JSON.parse(readFileSync(new URL(`${name}.json`, DIR), "utf8"));
  const outFile = new URL(`${name}.out.json`, DIR);
  const fixes = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : [];
  const byN = new Map();
  for (const f of fixes) {
    if (!batch.items[f.n]) problems.push(`${name} #${f.n}: no such item`);
    else byN.set(f.n, String(f.py ?? ""));
  }
  corrected += byN.size;
  for (const item of batch.items) {
    const py = (byN.get(item.n) ?? item.py).trim().split(/\s+/).filter(Boolean);
    const han = hanCount(item.zh);
    const bad = py.filter((s) => !SYLLABLE.test(s));
    if (py.length !== han) problems.push(`${name} #${item.n}: ${han} characters but ${py.length} syllables — ${item.zh}`);
    else if (bad.length) problems.push(`${name} #${item.n}: not a syllable: ${bad.join(", ")} — ${item.zh}`);
    else updates.push({ id: batch.ids[item.n], zh: item.zh, py: py.join(" ") });
  }
}

let stored = 0;
if (!dryRun) {
  let next = 0;
  async function worker() {
    while (next < updates.length) {
      const u = updates[next++];
      // Only while the sentence still reads the same; a changed sentence stays unchecked.
      const { data, error } = await supabase.from("pl_sentences").update({ zh_pinyin: u.py }).eq("id", u.id).eq("zh", u.zh).select("id");
      if (error) problems.push(`${u.zh}: ${error.message}`);
      else if (data.length) stored++;
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
}

console.log(
  `${dryRun ? "[dry run] " : ""}${batches.length} batches · ${updates.length} readings ready (${corrected} corrected)` +
    (dryRun ? "" : ` · ${stored} stored`),
);
if (problems.length) console.log(`problems ${problems.length}:\n` + problems.slice(0, 40).join("\n"));
