// Second opinion on drafted library content. A separate reviewer pass flags sentences or patterns that look
// unnatural, mistranslated or wrongly marked, with a note in Japanese for whoever checks them.
// Only drafts without a review are sent, at most 15 sets per call. Results go to the `review` column.
//   node --env-file=.env.local scripts/review-library.mjs           # every function with unreviewed drafts
//   node --env-file=.env.local scripts/review-library.mjs advice    # only these functions
// Options: --concurrency=6  --effort=high|medium
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { fetchAll, LANGS } from "./lib/library.mjs";
import { arg, report, track } from "./lib/usage.mjs";

const MODEL = "gpt-5.2";
const CONCURRENCY = Number(arg("concurrency", 6));
const EFFORT = arg("effort", "high");
const PER_CALL = 15;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const VERDICT = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "note", "suggestion"],
  properties: {
    ok: { type: "boolean" },
    note: { type: "string", description: "Empty when ok. Otherwise the problem, in Japanese, one short sentence." },
    suggestion: { type: "string", description: "Empty when ok. Otherwise a corrected version." },
  },
};
const LANG_VERDICTS = {
  type: "object",
  additionalProperties: false,
  required: LANGS,
  properties: Object.fromEntries(LANGS.map((l) => [l, VERDICT])),
};
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["patterns", "sentences"],
  properties: {
    patterns: LANG_VERDICTS,
    sentences: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "langs"],
        properties: { key: { type: "string" }, langs: LANG_VERDICTS },
      },
    },
  },
};

const SYSTEM = `You are a strict reviewer with native-level command of Japanese, English, Korean and Mandarin Chinese (simplified). You check study material for a language-learning app before it is published.

Each function has one pattern per language and example sets. Every set is one message said in all four languages, in casual speech between friends (Japanese タメ口, Korean 반말, colloquial Mandarin, casual English). Each sentence highlights a "mark": the substring that shows its language's pattern.

Flag a sentence (ok=false) when any of these is true:
- it is ungrammatical, misspelled, wrongly spaced (Korean 띄어쓰기), or not something a native speaker would naturally say;
- it does not mean the same as the other languages in its set;
- the register is not casual (for example Korean 존댓말 or Japanese です/ます);
- the mark does not cover the pattern's fixed part, or covers much more than it.
Flag a pattern when the form is misleading, the explanation for a learner of that language is wrong or confusing, or the examples are wrong.

Be strict but do not flag pure style preferences. Write every note in Japanese, briefly, for a Japanese reader who may not know the language. When you flag something, give a corrected version in "suggestion" (for a sentence: the corrected sentence; for a pattern: the corrected form or explanation). Return a verdict for every set key you were given.`;

function describe(fn, patterns, batch, marks) {
  const lines = [`Function: ${fn.label.ja} / ${fn.label.en}`, "", "Patterns:"];
  for (const l of LANGS) {
    const p = patterns.find((x) => x.lang === l);
    if (!p) continue;
    lines.push(`[${l}] form: ${p.form}`, `     examples: ${p.examples ?? ""}`);
    for (const ml of LANGS) lines.push(`     explanation for ${ml} speakers: ${p.meaning?.[ml] ?? ""}`);
  }
  lines.push("", "Example sets:");
  for (const s of batch) {
    lines.push(`key ${s.key}`);
    for (const l of LANGS) {
      const m = marks.find((x) => x.sentence_id === s.id && x.lang === l);
      lines.push(`  ${l}: ${s[l]}   [mark: ${m ? s[l].slice(m.start_index, m.end_index) : "(none)"}]`);
    }
  }
  return lines.join("\n");
}

const fns = (await supabase.from("pl_functions").select("id, label").order("position")).data ?? [];
const patterns = await fetchAll((a, b) =>
  supabase.from("pl_patterns").select("id, lang, form, examples, meaning, function_id, status, review").order("id").range(a, b),
);
const drafts = await fetchAll((a, b) =>
  supabase
    .from("pl_sentences")
    .select("id, key, topic, ja, en, ko, zh")
    .eq("status", "draft")
    .is("review", null)
    .order("key")
    .range(a, b),
);

// One job per batch of up to PER_CALL unreviewed sets; patterns ride along with the first batch of their function.
const jobs = [];
for (const fn of fns) {
  if (only.length && !only.includes(fn.id)) continue;
  const fnPatterns = patterns.filter((p) => p.function_id === fn.id && p.status !== "rejected");
  const needPatterns = fnPatterns.some((p) => p.status === "draft" && !p.review);
  const mine = drafts.filter((s) => s.topic === fn.id);
  if (mine.length === 0 && !needPatterns) continue;
  for (let i = 0; i < Math.max(mine.length, 1); i += PER_CALL) {
    jobs.push({ fn, fnPatterns, batch: mine.slice(i, i + PER_CALL), reviewPatterns: i === 0 && needPatterns });
  }
}
console.log(`reviewing ${jobs.length} batches`);

let next = 0;
const counts = { ok: 0, failed: 0, flaggedSets: 0, flaggedPatterns: 0 };
async function worker() {
  while (next < jobs.length) {
    const { fn, fnPatterns, batch, reviewPatterns } = jobs[next++];
    try {
      const { data: marks } = batch.length
        ? await supabase
            .from("pl_sentence_patterns")
            .select("sentence_id, lang, start_index, end_index")
            .in(
              "sentence_id",
              batch.map((s) => s.id),
            )
        : { data: [] };
      const completion = await openai.chat.completions.create({
        model: MODEL,
        reasoning_effort: EFFORT,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: describe(fn, fnPatterns, batch, marks ?? []) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "library_review", strict: true, schema: SCHEMA } },
      });
      track(completion);
      const out = JSON.parse(completion.choices[0].message.content);
      const checkedAt = new Date().toISOString();

      if (reviewPatterns) {
        for (const p of fnPatterns.filter((x) => x.status === "draft" && !x.review)) {
          const verdict = out.patterns[p.lang];
          await supabase.from("pl_patterns").update({ review: { checked_at: checkedAt, langs: { [p.lang]: verdict } } }).eq("id", p.id);
          if (verdict && !verdict.ok) counts.flaggedPatterns++;
        }
      }
      for (const r of out.sentences) {
        const s = batch.find((x) => x.key === r.key);
        if (!s) continue;
        await supabase.from("pl_sentences").update({ review: { checked_at: checkedAt, langs: r.langs } }).eq("id", s.id);
        if (LANGS.some((l) => r.langs[l] && !r.langs[l].ok)) counts.flaggedSets++;
      }
      counts.ok++;
      console.log(`ok   ${fn.id} (${batch.length} sets)`);
    } catch (err) {
      counts.failed++;
      console.error(`fail ${fn.id}: ${String(err.message).slice(0, 300)}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(
  `done: ${counts.ok} batches reviewed, ${counts.failed} failed, ${counts.flaggedSets} sets and ${counts.flaggedPatterns} patterns flagged`,
);
report("review");
