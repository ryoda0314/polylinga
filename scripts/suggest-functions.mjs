// Propose more communicative functions (働き) for the shower and append them to scripts/library/functions.json.
// Review the appended entries before drafting them with draft-library.mjs.
//   node --env-file=.env.local scripts/suggest-functions.mjs --count=100
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { LANGS } from "./lib/library.mjs";
import { arg, report, track } from "./lib/usage.mjs";

const COUNT = Number(arg("count", 100));
const FILE = new URL("./library/functions.json", import.meta.url);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const listed = JSON.parse(readFileSync(FILE, "utf8"));
const { data: inDb } = await supabase.from("pl_functions").select("id, position, label");
const known = new Map([...(inDb ?? []), ...listed].map((f) => [f.id, f]));
const maxPosition = Math.max(...[...known.values()].map((f) => f.position ?? 0));

const ITEM = {
  type: "object",
  additionalProperties: false,
  required: ["id", "brief", "label"],
  properties: {
    id: { type: "string", description: "kebab-case English, unique" },
    brief: { type: "string", description: "Japanese: what the learner wants to do, with a typical Japanese phrasing in 「」" },
    label: {
      type: "object",
      additionalProperties: false,
      required: LANGS,
      properties: Object.fromEntries(LANGS.map((l) => [l, { type: "string" }])),
    },
  },
};

const completion = await openai.chat.completions.create({
  model: "gpt-5.2",
  reasoning_effort: "high",
  messages: [
    {
      role: "system",
      content: `You design the curriculum skeleton of PolyLinga, a language-learning app for Japanese, English, Korean and Mandarin Chinese.
Learners bathe in many casual chat messages between friends that share one pattern, and notice the pattern themselves.
A "function" is something people want to do in everyday casual conversation (invite, refuse politely, say what you did yesterday, ask how much, ...),
which each of the four languages expresses with one common, reusable pattern.

Propose ${COUNT} new functions that do not overlap with the existing ones. Cover what friends really say in chats and calls:
time and tense (did, will, was doing, used to), negation, questions (who, what, which, how much, how many),
giving and receiving favours, offers, refusing, agreeing and disagreeing, feelings, plans and changes of plan, conditions and concessions,
degree and frequency, quantity, comparison, purpose, means, location and existence, possession, guessing, hearsay, reactions and interjections,
encouragement, complaints, apologies and thanks in different situations. Order them from basic to more advanced.
Labels are short names in each language (ja, en, ko, zh). The brief is in Japanese and shows a typical phrasing in 「」.`,
    },
    {
      role: "user",
      content: `Existing functions (do not repeat or overlap):\n${[...known.values()].map((f) => `${f.id}: ${f.label?.ja} / ${f.label?.en}`).join("\n")}`,
    },
  ],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "functions",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["functions"],
        properties: { functions: { type: "array", items: ITEM } },
      },
    },
  },
});
track(completion);
const proposed = JSON.parse(completion.choices[0].message.content).functions;

const added = [];
for (const f of proposed) {
  const id = f.id.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!id || known.has(id) || LANGS.some((l) => !f.label[l]?.trim())) continue;
  const entry = { id, position: maxPosition + added.length + 1, brief: f.brief.trim(), label: f.label };
  known.set(id, entry);
  added.push(entry);
}
writeFileSync(FILE, JSON.stringify([...listed, ...added], null, 2) + "\n");
console.log(`appended ${added.length} functions to scripts/library/functions.json`);
for (const f of added) console.log(`${String(f.position).padStart(3)} ${f.id.padEnd(24)} ${f.label.ja} — ${f.brief}`);
report("suggest-functions");
