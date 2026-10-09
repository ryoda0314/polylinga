// Fix patterns the reviewer flagged, following its note, without changing the construction itself
// (existing sentences already mark it). The fixed pattern loses its review so the next
// review-library.mjs run checks it again; publish-reviewed.mjs publishes it once it passes.
//   node --env-file=.env.local scripts/fix-patterns.mjs [pattern ids]
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { LANGS } from "./lib/library.mjs";
import { arg, report, track } from "./lib/usage.mjs";

const MODEL = "gpt-5.2";
const CONCURRENCY = Number(arg("concurrency", 6));

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const SCHEMA = {
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

const SYSTEM = `You maintain grammar patterns in a language-learning app for Japanese, English, Korean and Mandarin Chinese (simplified).
A reviewer flagged one pattern. Fix exactly what the reviewer pointed out and keep everything else.

Rules:
- Keep the same construction: example sentences already highlight it, so do not switch to a different grammar point.
- "form" is a compact reusable formula with V for a verb and N for a noun (for example "V + (으)ㄹ래?", "Could you + V?").
- "meaning" explains the pattern to a learner whose own language is ja, en, ko and zh respectively: one or two short, accurate sentences in that language, including any formation rule the learner needs.
- "examples" gives 2 or 3 "base → form" pairs in the pattern's language separated by " · ".`;

const { data: flagged } = await supabase
  .from("pl_patterns")
  .select("id, lang, form, examples, meaning, function_id, review")
  .eq("status", "draft");
const todo = (flagged ?? []).filter(
  (p) => (!only.length || only.includes(p.id)) && p.review?.langs?.[p.lang] && p.review.langs[p.lang].ok === false,
);
console.log(`fixing ${todo.length} patterns`);

let next = 0;
const counts = { fixed: 0, failed: 0 };
async function worker() {
  while (next < todo.length) {
    const p = todo[next++];
    try {
      const { data: samples } = await supabase
        .from("pl_sentence_patterns")
        .select("start_index, end_index, pl_sentences(" + p.lang + ")")
        .eq("pattern_id", p.id)
        .limit(4);
      const verdict = p.review.langs[p.lang];
      const completion = await openai.chat.completions.create({
        model: MODEL,
        reasoning_effort: "high",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              `Pattern language: ${p.lang}`,
              `form: ${p.form}`,
              `examples: ${p.examples ?? ""}`,
              ...LANGS.map((l) => `explanation for ${l} speakers: ${p.meaning?.[l] ?? ""}`),
              "",
              `Reviewer note (Japanese): ${verdict.note}`,
              `Reviewer suggestion: ${verdict.suggestion}`,
              "",
              "Sentences that use it (marked part in brackets):",
              ...(samples ?? []).map((s) => {
                const text = s.pl_sentences?.[p.lang] ?? "";
                return `- ${text.slice(0, s.start_index)}[${text.slice(s.start_index, s.end_index)}]${text.slice(s.end_index)}`;
              }),
            ].join("\n"),
          },
        ],
        response_format: { type: "json_schema", json_schema: { name: "fixed_pattern", strict: true, schema: SCHEMA } },
      });
      track(completion);
      const out = JSON.parse(completion.choices[0].message.content);
      if (!out.form?.trim() || LANGS.some((l) => !out.meaning?.[l]?.trim())) throw new Error("incomplete fix");
      const { error } = await supabase
        .from("pl_patterns")
        .update({ form: out.form.trim(), examples: out.examples.trim() || null, meaning: out.meaning, review: null })
        .eq("id", p.id);
      if (error) throw new Error(error.message);
      counts.fixed++;
      console.log(`ok   ${p.id}: ${p.form} → ${out.form.trim()}`);
    } catch (err) {
      counts.failed++;
      console.error(`fail ${p.id}: ${String(err.message).slice(0, 200)}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`done: ${counts.fixed} fixed, ${counts.failed} failed`);
report("fix-patterns");
