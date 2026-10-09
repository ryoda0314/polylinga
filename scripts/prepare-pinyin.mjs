// Write the library's Chinese sentences whose pinyin has not been checked yet, with pinyin-pro's reading as a
// starting point, in batches for checking by hand (Claude). scripts/apply-pinyin.mjs stores the checked readings.
//   node --env-file=.env.local scripts/prepare-pinyin.mjs [--batches=8] [--all]
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { customPinyin, pinyin } from "pinyin-pro";
import words from "../src/lib/pinyin-words.json" with { type: "json" };
import { isHan } from "../src/lib/reading-core.ts";
import { fetchAll } from "./lib/library.mjs";
import { arg } from "./lib/usage.mjs";

const BATCHES = Number(arg("batches", 8));
const all = process.argv.includes("--all");
const DIR = new URL("./library/work/pinyin/", import.meta.url);
mkdirSync(DIR, { recursive: true });

customPinyin(words); // the same word readings the app uses, so the starting point is the app's fallback reading

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** pinyin-pro's syllable for each Han character of `text`, in order ("?" where it has none). */
function generated(text) {
  const byOffset = new Map();
  let offset = 0;
  for (const item of pinyin(text, { type: "all" })) {
    if (item.isZh && item.origin.length === 1) byOffset.set(offset, item.pinyin);
    offset += item.origin.length;
  }
  const out = [];
  for (let i = 0; i < text.length; i++) if (isHan(text[i])) out.push(byOffset.get(i) || "?");
  return out.join(" ");
}

const rows = await fetchAll((a, b) =>
  supabase.from("pl_sentences").select("id, zh, zh_pinyin").eq("status", "approved").order("key").range(a, b),
);
const todo = rows.filter((r) => all || !r.zh_pinyin);
const size = Math.ceil(todo.length / BATCHES);
let written = 0;
for (let b = 0; b * size < todo.length; b++) {
  const chunk = todo.slice(b * size, (b + 1) * size);
  const name = `batch-${String(b + 1).padStart(2, "0")}`;
  const batch = {
    ids: chunk.map((r) => r.id),
    items: chunk.map((r, n) => ({ n, zh: r.zh, py: generated(r.zh) })),
  };
  writeFileSync(new URL(`${name}.json`, DIR), JSON.stringify(batch, null, 1) + "\n");
  written++;
}
console.log(`${todo.length} sentences to check, written as ${written} batches to scripts/library/work/pinyin/`);
