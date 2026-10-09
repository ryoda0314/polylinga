// Draft the pattern library with AI. Each function in scripts/library/functions.json becomes one pattern per
// language plus 5 example sets, stored as status='draft'. Nothing reaches learners until it is approved in /admin/library.
//   node --env-file=.env.local scripts/draft-library.mjs              # draft every function not yet in the database
//   node --env-file=.env.local scripts/draft-library.mjs advice why   # (re)draft only these (replaces their drafts)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { LANGS, validateLibrary } from "./lib/library.mjs";
import { arg, report, track } from "./lib/usage.mjs";

const MODEL = "gpt-5.2";
const CONCURRENCY = Number(arg("concurrency", 4));
const SETS = 5;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const allFunctions = JSON.parse(readFileSync(new URL("./library/functions.json", import.meta.url), "utf8"));
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const PATTERN = {
  type: "object",
  additionalProperties: false,
  required: ["form", "examples", "meaning"],
  properties: {
    form: { type: "string" },
    examples: { type: "string" },
    meaning: {
      type: "object",
      additionalProperties: false,
      required: LANGS,
      properties: Object.fromEntries(LANGS.map((l) => [l, { type: "string" }])),
    },
  },
};
const SENTENCE_PROPS = Object.fromEntries(
  LANGS.flatMap((l) => [
    [l, { type: "string" }],
    [`mark_${l}`, { type: "string" }],
  ]),
);
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["patterns", "sentences"],
  properties: {
    patterns: {
      type: "object",
      additionalProperties: false,
      required: LANGS,
      properties: Object.fromEntries(LANGS.map((l) => [l, PATTERN])),
    },
    sentences: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: Object.keys(SENTENCE_PROPS),
        properties: SENTENCE_PROPS,
      },
    },
  },
};

const SYSTEM = `You write study material for PolyLinga, an app where people learn Japanese, English, Korean and Mandarin Chinese (simplified characters) by starting from what they want to say. Learners notice a grammar pattern by seeing several natural sentences that share it.

Task: for one communicative function, choose the single most common everyday pattern that expresses it in each of the four languages, and write ${SETS} example sets. Each set is one situation said naturally in all four languages, and each language's sentence uses that language's chosen pattern.

Register: casual spoken language between friends of similar age (Japanese タメ口, Korean 반말, colloquial Mandarin, casual English). Natural, not textbook-stiff, not slang-heavy.

Sentences: short (Japanese up to 25 characters, Korean up to 25 syllables, Chinese up to 20 characters, English up to 12 words). Everyday situations: friends, school, work, food, travel, hobbies, home. Vary the vocabulary and situations across the sets. No names of real people, no brands, nothing sensitive. The four versions of a set mean the same thing, rendered naturally rather than word for word.

Marks: for every sentence give mark_xx = the exact substring of that sentence that shows the pattern's fixed part, copied character for character including spacing. Keep it minimal, for example Korean 갈래 for -(으)ㄹ래?, Japanese てくれる for 〜てくれる？, Chinese 要不要, English Could you. Never mark the whole sentence.

Patterns: "form" is a compact formula a learner can reuse, with V for a verb and N for a noun (for example "V + (으)ㄹ래?", "Could you + V?", "要不要 + V？", "〜てくれる？"). "meaning" explains the pattern to a learner whose own language is ja, en, ko and zh respectively: one or two short sentences in that language saying what it expresses and any formation rule the learner needs (for example Korean batchim). "examples" gives 2 or 3 "base → form" pairs in the pattern's language, separated by " · ".

Accuracy matters more than anything else: every sentence must be something a native speaker would naturally say, with correct spelling and spacing (Korean 띄어쓰기).`;

async function draftOne(fn, knownPatterns, existingForms) {
  const avoid = LANGS.map((l) => `${l}: ${existingForms[l].join(", ") || "-"}`).join("\n");
  let feedback = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      reasoning_effort: "high",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Function: ${fn.label.ja} / ${fn.label.en}\nGuidance (Japanese): ${fn.brief}\n\nPattern forms already used for other functions; pick different ones:\n${avoid}${feedback}`,
        },
      ],
      response_format: { type: "json_schema", json_schema: { name: "library_function", strict: true, schema: SCHEMA } },
    });
    track(completion);
    const out = JSON.parse(completion.choices[0].message.content);

    const patterns = LANGS.map((l) => ({
      id: `${l}-${fn.id}`,
      lang: l,
      function_id: fn.id,
      form: out.patterns[l].form.trim(),
      examples: out.patterns[l].examples.trim(),
      meaning: out.patterns[l].meaning,
    }));
    const sentences = out.sentences.slice(0, SETS).map((s, i) => ({
      key: `${fn.id}-${i + 1}`,
      topic: fn.id,
      ...Object.fromEntries(LANGS.map((l) => [l, s[l].trim()])),
      marks: Object.fromEntries(LANGS.map((l) => [l, [`${l}-${fn.id}`, s[`mark_${l}`]]])),
    }));

    const { problems, marks } = validateLibrary({ patterns, sentences }, { knownPatterns });
    if (sentences.length < SETS) problems.push(`only ${sentences.length} sets, expected ${SETS}`);
    if (problems.length === 0) return { patterns, sentences, marks };
    feedback = `\n\nYour previous answer had these problems; fix them:\n${problems.join("\n")}`;
    if (attempt === 2) throw new Error(problems.join("; "));
  }
}

async function save(fn, { patterns, sentences, marks }) {
  // Replace any earlier draft of this function; approved rows are never touched.
  await supabase.from("pl_sentences").delete().eq("topic", fn.id).eq("status", "draft");
  await supabase.from("pl_patterns").delete().eq("function_id", fn.id).eq("status", "draft");

  const { id, position, label } = fn;
  let r = await supabase.from("pl_functions").upsert({ id, position, label });
  if (r.error) throw new Error(`function: ${r.error.message}`);
  r = await supabase
    .from("pl_patterns")
    .upsert(patterns.map((p) => ({ ...p, status: "draft", source: "ai" })), { ignoreDuplicates: true });
  if (r.error) throw new Error(`patterns: ${r.error.message}`);
  const ins = await supabase
    .from("pl_sentences")
    .upsert(
      sentences.map(({ key, topic, ja, en, ko, zh }) => ({ key, topic, ja, en, ko, zh, status: "draft", source: "ai" })),
      { onConflict: "key", ignoreDuplicates: true },
    )
    .select("id, key");
  if (ins.error) throw new Error(`sentences: ${ins.error.message}`);
  const idByKey = new Map(ins.data.map((row) => [row.key, row.id]));
  const rows = marks.filter((m) => idByKey.has(m.key)).map(({ key, ...m }) => ({ sentence_id: idByKey.get(key), ...m }));
  if (rows.length) {
    r = await supabase.from("pl_sentence_patterns").upsert(rows);
    if (r.error) throw new Error(`marks: ${r.error.message}`);
  }
  return ins.data.length;
}

const { data: existingFns } = await supabase.from("pl_functions").select("id");
const { data: existingPatterns } = await supabase.from("pl_patterns").select("id, lang, form, status");
const present = new Set((existingFns ?? []).map((f) => f.id));
const knownPatterns = new Map((existingPatterns ?? []).map((p) => [p.id, p.lang]));
const existingForms = Object.fromEntries(
  LANGS.map((l) => [l, (existingPatterns ?? []).filter((p) => p.lang === l && p.status !== "rejected").map((p) => p.form)]),
);

const todo = only.length ? allFunctions.filter((f) => only.includes(f.id)) : allFunctions.filter((f) => !present.has(f.id));
console.log(`drafting ${todo.length} functions`);

let next = 0;
const results = { ok: 0, failed: 0 };
async function worker() {
  while (next < todo.length) {
    const fn = todo[next++];
    try {
      const draft = await draftOne(fn, knownPatterns, existingForms);
      const n = await save(fn, draft);
      results.ok++;
      console.log(`ok   ${fn.id} (${n} sets)`);
    } catch (err) {
      results.failed++;
      console.error(`fail ${fn.id}: ${String(err.message).slice(0, 300)}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`done: ${results.ok} drafted, ${results.failed} failed`);
report("draft");
