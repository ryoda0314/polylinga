// Store the order new ways of saying come in for someone new to each language (scripts/library/steps.json) as
// pl_patterns.step, and print each language's opening rains. Needs supabase/migrations/20261027000000_gentle_start.sql.
//   node --env-file=.env.local scripts/apply-steps.mjs [--dry-run]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fetchAll } from "./lib/library.mjs";

// first: 1, 2, 3 … and basic: 100, 101 … in the order listed; then the functions not listed (the column's default),
// by their position; then later.
const STEP = { basic: 100, rest: 500, later: 900 };

const dryRun = process.argv.includes("--dry-run");
const steps = JSON.parse(readFileSync(new URL("./library/steps.json", import.meta.url), "utf8"));

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const functions = await fetchAll((a, b) => supabase.from("pl_functions").select("id, position").order("position").range(a, b));
const patterns = await fetchAll((a, b) =>
  supabase.from("pl_patterns").select("id, lang, function_id, form, step").order("id").range(a, b),
);
const position = new Map(functions.map((f) => [f.id, f.position]));

const problems = [];
const changes = new Map(); // step -> pattern ids
for (const [lang, lists] of Object.entries(steps)) {
  if (lang === "note") continue;
  const stepOf = new Map();
  const put = (id, step, list) => {
    if (!position.has(id)) problems.push(`${lang} ${list}: no function ${id}`);
    else if (stepOf.has(id)) problems.push(`${lang} ${list}: ${id} is listed twice`);
    else stepOf.set(id, step);
  };
  if ((lists.first ?? []).length >= STEP.basic) problems.push(`${lang} first: more than ${STEP.basic - 1}`);
  (lists.first ?? []).forEach((id, i) => put(id, i + 1, "first"));
  (lists.basic ?? []).forEach((id, i) => put(id, STEP.basic + i, "basic"));
  for (const id of lists.later ?? []) put(id, STEP.later, "later");

  const mine = patterns.filter((p) => p.lang === lang);
  if (!mine.length) problems.push(`${lang}: no patterns`);
  for (const p of mine) {
    const step = stepOf.get(p.function_id) ?? STEP.rest;
    if (p.step !== step) changes.set(step, [...(changes.get(step) ?? []), p.id]);
  }
  for (const id of lists.first ?? []) {
    if (!mine.some((p) => p.function_id === id)) problems.push(`${lang} first: ${id} has no ${lang} pattern`);
  }
  const step = (p) => stepOf.get(p.function_id) ?? STEP.rest;
  const order = [...mine].sort((a, b) => step(a) - step(b) || position.get(a.function_id) - position.get(b.function_id));
  console.log(`${lang}: ${order.slice(0, 20).map((p) => p.form).join(" → ")} …`);
}

if (problems.length) {
  console.log(`problems ${problems.length}:\n` + problems.join("\n"));
  process.exit(1);
}

const changed = [...changes.values()].reduce((n, ids) => n + ids.length, 0);
if (!dryRun) {
  for (const [step, ids] of changes) {
    const { error } = await supabase.from("pl_patterns").update({ step }).in("id", ids);
    if (error) throw new Error(`step ${step}: ${error.message}`);
  }
}
console.log(`${dryRun ? "[dry run] " : ""}${changed} of ${patterns.length} patterns ${dryRun ? "would change" : "changed"}`);
