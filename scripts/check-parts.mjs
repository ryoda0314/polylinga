// Check 語のまとまり answers (scripts/library/work/parts/<batch>.out.json) against their batch: every part placed in
// the sentence in order, nothing skipped or left over, every gloss found in the translation. Writes <batch>.md beside
// them for reading, and lists what needs another look. No database access.
//   node scripts/check-parts.mjs [batch names]      # default: every batch that has an answer
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { markdown, place } from "./lib/parts.mjs";

const DIR = new URL("./library/work/parts/", import.meta.url);
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const batches = readdirSync(DIR)
  .filter((f) => /^[a-z]{2}-\d+\.json$/.test(f))
  .map((f) => f.replace(".json", ""))
  .filter((b) => (only.length ? only.includes(b) : existsSync(new URL(`${b}.out.json`, DIR))))
  .sort();

let sentences = 0;
let flagged = 0;
for (const name of batches) {
  const batch = JSON.parse(readFileSync(new URL(`${name}.json`, DIR), "utf8"));
  const outFile = new URL(`${name}.out.json`, DIR);
  const answers = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : [];
  const byN = new Map(answers.map((a) => [a.n, a.parts]));
  const items = batch.items.map((item) => (byN.has(item.n) ? { ...item, ...place(item, byN.get(item.n)) } : { ...item }));
  writeFileSync(new URL(`${name}.md`, DIR), markdown(name, items) + "\n");
  const bad = items.filter((i) => !i.parts || i.problems.length);
  sentences += items.length;
  flagged += bad.length;
  console.log(`${name}: ${items.length} sentences, ${bad.length} to look at again`);
  for (const i of bad) console.log(`  ${i.n}. ${i.text} — ${i.parts ? i.problems.join(" / ") : "no answer"}`);
}
console.log(`${batches.length} batches, ${sentences} sentences, ${flagged} to look at again`);
