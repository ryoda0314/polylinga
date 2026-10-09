// Add more shower sentences to existing functions, reusing each function's patterns.
// A shower needs many sentences per pattern; these are everyday chat messages between friends.
// New sets arrive as drafts; run review-library.mjs and publish-reviewed.mjs afterwards.
//   node --env-file=.env.local scripts/expand-library.mjs --target=30     # top every function up towards 30 published sets
//   node --env-file=.env.local scripts/expand-library.mjs invite 8        # one function, 8 new sets
// Options: --concurrency=6  --effort=medium|high
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { fetchAll, LANGS, validateLibrary } from "./lib/library.mjs";
import { arg, report, track } from "./lib/usage.mjs";

const MODEL = "gpt-5.2";
const CONCURRENCY = Number(arg("concurrency", 6));
const EFFORT = arg("effort", "medium");
const TARGET = Number(arg("target", 0));
/** Share of generated sets that typically pass review; used to size each batch. */
const PASS_RATE = 0.6;
const MAX_BATCH = 15;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const onlyFn = positional.find((a) => !/^\d+$/.test(a)) ?? null;
const fixedCount = Number(positional.find((a) => /^\d+$/.test(a)) ?? 12);

const SENTENCE_PROPS = Object.fromEntries(
  LANGS.flatMap((l) => [
    [l, { type: "string" }],
    [`mark_${l}`, { type: "string" }],
  ]),
);
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sentences"],
  properties: {
    sentences: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: Object.keys(SENTENCE_PROPS), properties: SENTENCE_PROPS },
    },
  },
};

const SYSTEM = `You write example sentences for PolyLinga, where people learn Japanese, English, Korean and Mandarin Chinese (simplified) by bathing in many natural sentences that share a pattern and noticing the common part themselves.

Write sets of one message said naturally in all four languages. Each language's sentence must use that language's given pattern, so that many sentences of the same language share the pattern while everything else varies.

Content: real chat messages that friends in their late teens or twenties actually send each other (LINE, KakaoTalk, WeChat, iMessage): arriving somewhere, plans, school, lab, part-time work, food, home, being tired, games, music, travel, sports, shopping, weather, family, pets, small feelings. Short and casual (Japanese タメ口, Korean 반말, colloquial Mandarin, casual English). Japanese up to 25 characters, Korean up to 25 syllables, Chinese up to 20 characters, English up to 12 words. No names of real people, no brands, nothing sensitive. Vary vocabulary, verbs, subjects, tense and situations as much as possible across the sets, and avoid the sentences listed as already used. The four versions of a set mean the same thing, rendered naturally rather than word for word.

Marks: mark_xx is the exact substring of that sentence that shows the pattern's fixed part, copied character for character including spacing. Keep it minimal and never the whole sentence.

Accuracy matters more than anything else: every sentence must be something a native speaker would really send, with correct spelling and spacing (Korean 띄어쓰기).`;

const functions = (await supabase.from("pl_functions").select("id, label, position").order("position")).data ?? [];
const patterns = await fetchAll((a, b) =>
  supabase.from("pl_patterns").select("id, lang, form, examples, function_id, status").order("id").range(a, b),
);
const sentences = await fetchAll((a, b) =>
  supabase.from("pl_sentences").select("key, topic, ja, en, ko, zh, status, review").order("key").range(a, b),
);

// How many new sets each function should get this run.
const plan = [];
for (const fn of functions) {
  if (onlyFn && fn.id !== onlyFn) continue;
  const mine = sentences.filter((s) => s.topic === fn.id);
  let count = fixedCount;
  if (TARGET > 0 && !onlyFn) {
    const published = mine.filter((s) => s.status === "approved").length;
    const pending = mine.filter((s) => s.status === "draft" && !s.review).length;
    const deficit = TARGET - published - pending * PASS_RATE;
    if (deficit <= 0) continue;
    count = Math.min(MAX_BATCH, Math.max(6, Math.ceil(deficit / PASS_RATE)));
  }
  plan.push({ fn, count });
}
console.log(`expanding ${plan.length} functions, ${plan.reduce((n, p) => n + p.count, 0)} sets requested`);

async function expand(fn, count) {
  const fnPatterns = LANGS.map((l) =>
    patterns.find((p) => p.function_id === fn.id && p.lang === l && p.status !== "rejected"),
  );
  if (fnPatterns.some((p) => !p)) throw new Error("missing a pattern for some language");
  const existing = sentences.filter((s) => s.topic === fn.id);
  const used = existing.map((s) => `- ${s.ja} / ${s.ko}`).join("\n");

  let feedback = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      reasoning_effort: EFFORT,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            `Function: ${fn.label.ja} / ${fn.label.en}`,
            "Patterns to use:",
            ...fnPatterns.map((p) => `${p.lang}: ${p.form}   (e.g. ${p.examples ?? ""})`),
            "",
            `Write ${count} new sets.`,
            "Already used (do not repeat these or near-copies):",
            used || "-",
            feedback,
          ].join("\n"),
        },
      ],
      response_format: { type: "json_schema", json_schema: { name: "more_sentences", strict: true, schema: SCHEMA } },
    });
    track(completion);
    const out = JSON.parse(completion.choices[0].message.content);

    const taken = new Set(existing.map((s) => s.key));
    let n = existing.length;
    const nextKey = () => {
      let key;
      do key = `${fn.id}-${++n}`;
      while (taken.has(key));
      taken.add(key);
      return key;
    };
    const fresh = out.sentences.slice(0, count).map((s) => ({
      key: nextKey(),
      topic: fn.id,
      ...Object.fromEntries(LANGS.map((l) => [l, s[l].trim()])),
      marks: Object.fromEntries(LANGS.map((l, i) => [l, [fnPatterns[i].id, s[`mark_${l}`]]])),
    }));

    // Validate against everything in this function so duplicates of existing sentences are caught too.
    const known = new Map(fnPatterns.map((p) => [p.id, p.lang]));
    const check = validateLibrary(
      { patterns: [], sentences: [...existing.map((s) => ({ ...s, marks: {} })), ...fresh] },
      { knownPatterns: known },
    );
    const problems = check.problems.filter((p) => fresh.some((f) => p.startsWith(`sentence ${f.key}:`)));
    if (problems.length === 0) return { fresh, marks: check.marks.filter((m) => fresh.some((f) => f.key === m.key)) };
    feedback = `\nYour previous answer had these problems; fix them:\n${problems.join("\n")}`;
    if (attempt === 2) {
      // Keep the sets that are fine rather than losing the whole batch.
      const bad = new Set(problems.map((p) => p.split(":")[0].replace("sentence ", "")));
      const good = fresh.filter((f) => !bad.has(f.key));
      return { fresh: good, marks: check.marks.filter((m) => good.some((f) => f.key === m.key)) };
    }
  }
}

let next = 0;
const totals = { sets: 0, failed: 0 };
async function worker() {
  while (next < plan.length) {
    const { fn, count } = plan[next++];
    try {
      const { fresh, marks } = await expand(fn, count);
      if (fresh.length === 0) throw new Error("no valid sets");
      const ins = await supabase
        .from("pl_sentences")
        .insert(fresh.map(({ key, topic, ja, en, ko, zh }) => ({ key, topic, ja, en, ko, zh, status: "draft", source: "ai" })))
        .select("id, key");
      if (ins.error) throw new Error(ins.error.message);
      const idByKey = new Map(ins.data.map((r) => [r.key, r.id]));
      const rows = marks.map(({ key, ...m }) => ({ sentence_id: idByKey.get(key), ...m })).filter((r) => r.sentence_id);
      const r = await supabase.from("pl_sentence_patterns").insert(rows);
      if (r.error) throw new Error(r.error.message);
      // Keep the in-memory view current so later batches avoid these sentences too.
      sentences.push(
        ...fresh.map((f) => ({ key: f.key, topic: f.topic, ja: f.ja, en: f.en, ko: f.ko, zh: f.zh, status: "draft", review: null })),
      );
      totals.sets += fresh.length;
      console.log(`ok   ${fn.id} +${fresh.length}`);
    } catch (err) {
      totals.failed++;
      console.error(`fail ${fn.id}: ${String(err.message).slice(0, 200)}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`done: ${totals.sets} new draft sets, ${totals.failed} functions failed`);
report("expand");
