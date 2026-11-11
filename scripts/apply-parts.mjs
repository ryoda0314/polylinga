// Store 語のまとまり from scripts/library/work/parts/<batch>.out.json in pl_sentence_parts (meaning and gloss under
// "ja", the language the answers are written for). A sentence whose answer does not pass check-parts' placement checks
// is skipped and keeps whatever it had; one that passes replaces its parts.
//   node --env-file=.env.local scripts/apply-parts.mjs [batch names] [--dry-run]   # default: every answered batch
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { place } from "./lib/parts.mjs";

const DIR = new URL("./library/work/parts/", import.meta.url);
const dryRun = process.argv.includes("--dry-run");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const batches = readdirSync(DIR)
  .filter((f) => /^[a-z]{2}-\d+\.json$/.test(f))
  .map((f) => f.replace(".json", ""))
  .filter((b) => existsSync(new URL(`${b}.out.json`, DIR)) && (!only.length || only.includes(b)))
  .sort();

let stored = 0;
let skipped = 0;
for (const name of batches) {
  const batch = JSON.parse(readFileSync(new URL(`${name}.json`, DIR), "utf8"));
  const answers = new Map(JSON.parse(readFileSync(new URL(`${name}.out.json`, DIR), "utf8")).map((a) => [a.n, a.parts]));
  const rows = [];
  const ids = [];
  for (const item of batch.items) {
    if (!answers.has(item.n)) continue;
    const { parts, problems } = place(item, answers.get(item.n));
    if (problems.length || parts.length === 0) {
      skipped++;
      console.log(`skip ${name} ${item.n}. ${item.text} — ${problems.join(" / ") || "no parts"}`);
      continue;
    }
    ids.push(item.id);
    parts.forEach((p, idx) =>
      rows.push({
        sentence_id: item.id,
        lang: batch.lang,
        idx,
        start_index: p.start,
        end_index: p.end,
        base: p.base.slice(0, 60),
        kind: p.kind,
        meaning: { ja: p.meaning },
        gloss: p.gloss ? { ja: [p.gloss.start, p.gloss.end] } : {},
      }),
    );
  }
  if (!dryRun && ids.length) {
    const { error: delError } = await supabase.from("pl_sentence_parts").delete().eq("lang", batch.lang).in("sentence_id", ids);
    if (delError) throw new Error(`${name}: ${delError.message}`);
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("pl_sentence_parts").insert(rows.slice(i, i + 500));
      if (error) throw new Error(`${name}: ${error.message}`);
    }
  }
  stored += ids.length;
  console.log(`${name}: ${ids.length} sentences, ${rows.length} parts${dryRun ? " (dry run)" : ""}`);
}
console.log(`${dryRun ? "would store" : "stored"} ${stored} sentences from ${batches.length} batches; skipped ${skipped}`);
