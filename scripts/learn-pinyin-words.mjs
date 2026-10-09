// Learn word readings for pinyin-pro (src/lib/pinyin-words.json) from the library's checked pinyin, so corrections and
// memo words, which have no checked pinyin, are read better too. A word qualifies when pinyin-pro misread it somewhere,
// it reads the same way everywhere in the library (twice or more), and adding it makes no library sentence worse.
// Words come from ICU word segments (no 一/不, whose tone depends on what follows) plus whole verb-不-complement units.
//   node --env-file=.env.local scripts/learn-pinyin-words.mjs [--dry-run]
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { clearCustomDict, customPinyin, pinyin } from "pinyin-pro";
import { isHan } from "../src/lib/reading-core.ts";
import { fetchAll } from "./lib/library.mjs";

const FILE = new URL("../src/lib/pinyin-words.json", import.meta.url);
const dryRun = process.argv.includes("--dry-run");
// Read differently outside chat sentences: 过去 "the past" guòqù, 我过的生活 guò de, 试用 shì yòng, 精神 jīngshén.
const EXCLUDE = new Set(["过去", "过的", "试用", "精神"]);
const ALWAYS = { 谁: "shéi" };

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const rows = await fetchAll((a, b) =>
  supabase.from("pl_sentences").select("zh, zh_pinyin").eq("status", "approved").not("zh_pinyin", "is", null).order("key").range(a, b),
);

function generated(text) {
  const byOffset = new Map();
  let offset = 0;
  for (const item of pinyin(text, { type: "all" })) {
    if (item.isZh && item.origin.length === 1) byOffset.set(offset, item.pinyin);
    offset += item.origin.length;
  }
  const out = [];
  for (let i = 0; i < text.length; i++) if (isHan(text[i])) out.push(byOffset.get(i) || "?");
  return out;
}

clearCustomDict("pinyin");
const sentences = rows
  .map((r) => {
    const idx = new Map();
    let k = 0;
    for (let i = 0; i < r.zh.length; i++) if (isHan(r.zh[i])) idx.set(i, k++);
    return { zh: r.zh, syl: r.zh_pinyin.split(" "), gen: generated(r.zh), idx };
  })
  .filter((s) => s.syl.length === s.gen.length);

const readings = new Map();
function note(key, s, from) {
  const ks = [...key].map((_, j) => s.idx.get(from + j));
  if (ks.some((k) => k === undefined)) return;
  const v = readings.get(key) ?? { forms: new Set(), n: 0, wrong: 0 };
  v.forms.add(ks.map((k) => s.syl[k]).join(" "));
  v.n++;
  if (ks.some((k) => s.syl[k] !== s.gen[k])) v.wrong++;
  readings.set(key, v);
}
const segmenter = new Intl.Segmenter("zh", { granularity: "word" });
for (const s of sentences) {
  for (const w of segmenter.segment(s.zh)) {
    if (w.isWordLike && w.segment.length >= 2 && [...w.segment].every(isHan) && !/[一不]/.test(w.segment)) note(w.segment, s, w.index);
  }
  for (let i = 1; i + 1 < s.zh.length; i++) {
    if (s.zh[i] === "不" && isHan(s.zh[i - 1]) && isHan(s.zh[i + 1]) && s.syl[s.idx.get(i)] === "bu") note(s.zh.slice(i - 1, i + 2), s, i - 1);
  }
}
const dict = {
  ...Object.fromEntries(
    [...readings]
      .filter(([k, v]) => !EXCLUDE.has(k) && v.forms.size === 1 && v.n >= 2 && v.wrong > 0)
      .map(([k, v]) => [k, [...v.forms][0]]),
  ),
  ...ALWAYS,
};

const mismatches = (s) => generated(s.zh).reduce((n, p, k) => n + (p !== s.syl[k]), 0);
const base = sentences.map((s) => s.gen.reduce((n, p, k) => n + (p !== s.syl[k]), 0));
let total = 0;
for (;;) {
  clearCustomDict("pinyin");
  customPinyin(dict);
  const now = sentences.map(mismatches);
  total = now.reduce((a, b) => a + b, 0);
  const worse = sentences.filter((s, i) => now[i] > base[i]);
  if (!worse.length) break;
  for (const s of worse) for (const k of Object.keys(dict)) if (s.zh.includes(k) && !ALWAYS[k]) delete dict[k];
}
const sorted = Object.fromEntries(Object.entries(dict).sort(([a], [b]) => a.localeCompare(b, "zh")));
if (!dryRun) writeFileSync(FILE, JSON.stringify(sorted, null, 1) + "\n");
console.log(
  `${dryRun ? "[dry run] " : ""}${Object.keys(sorted).length} words · syllables pinyin-pro misreads in the library: ` +
    `${base.reduce((a, b) => a + b, 0)} → ${total}`,
);
