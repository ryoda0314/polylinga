// Apply hand-written answers from scripts/library/work/<id>.out.json (see prepare-work.mjs):
// fixed patterns are published, drafts are kept / fixed / dropped, new sets are added as published,
// and everything newly published gets search embeddings. Invalid items are skipped and reported.
//   node --env-file=.env.local scripts/apply-work.mjs [function ids] [--dry-run]
import { existsSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { fetchAll, LANGS, validateLibrary } from "./lib/library.mjs";

const DIR = new URL("./library/work/", import.meta.url);
const dryRun = process.argv.includes("--dry-run");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const files = readdirSync(DIR).filter((f) => f.endsWith(".out.json") && (!only.length || only.includes(f.replace(".out.json", ""))));
const sentences = await fetchAll((a, b) =>
  supabase.from("pl_sentences").select("id, key, topic, ja, en, ko, zh, status").order("key").range(a, b),
);
const patterns = await fetchAll((a, b) =>
  supabase.from("pl_patterns").select("id, lang, function_id, status").order("id").range(a, b),
);
const listed = JSON.parse(readFileSync(new URL("./library/functions.json", import.meta.url), "utf8"));
const { data: fnRows } = await supabase.from("pl_functions").select("id");
const fnInDb = new Set((fnRows ?? []).map((f) => f.id));

const report = { files: 0, patterns: 0, kept: 0, fixed: 0, dropped: 0, added: 0, skipped: [] };
const toEmbed = [];

for (const file of files) {
  const out = JSON.parse(readFileSync(new URL(file, DIR), "utf8"));
  const fid = out.function;

  // A new function: create it and its four patterns from the writer's answer.
  if (!fnInDb.has(fid)) {
    const entry = listed.find((f) => f.id === fid);
    const given = Object.fromEntries((out.patterns ?? []).map((p) => [p.lang, p]));
    const complete = entry && LANGS.every((l) => given[l]?.form?.trim() && LANGS.every((m) => given[l].meaning?.[m]?.trim()));
    if (!complete) {
      report.skipped.push(`${fid}: new function needs its entry in functions.json and all four patterns`);
      continue;
    }
    if (!dryRun) {
      let r = await supabase.from("pl_functions").upsert({ id: fid, position: entry.position, label: entry.label });
      if (r.error) throw new Error(r.error.message);
      r = await supabase.from("pl_patterns").upsert(
        LANGS.map((l) => ({
          id: `${l}-${fid}`,
          lang: l,
          function_id: fid,
          form: given[l].form.trim(),
          examples: given[l].examples?.trim() || null,
          meaning: given[l].meaning,
          status: "approved",
          source: "claude",
        })),
      );
      if (r.error) throw new Error(r.error.message);
    }
    fnInDb.add(fid);
    for (const l of LANGS) patterns.push({ id: `${l}-${fid}`, lang: l, function_id: fid, status: "approved" });
    out.patterns = []; // already applied
    report.patterns += 4;
  }
  const fnPatterns = Object.fromEntries(
    LANGS.map((l) => [l, patterns.find((p) => p.function_id === fid && p.lang === l)]),
  );
  if (LANGS.some((l) => !fnPatterns[l])) {
    report.skipped.push(`${fid}: missing patterns`);
    continue;
  }
  const known = new Map(LANGS.map((l) => [fnPatterns[l].id, l]));
  const mine = sentences.filter((s) => s.topic === fid);
  const others = mine.filter((s) => s.status !== "rejected");

  // Patterns: anything returned is the corrected or confirmed version; publish it.
  for (const p of out.patterns ?? []) {
    const target = fnPatterns[p.lang];
    if (!target || !p.form?.trim() || LANGS.some((l) => !p.meaning?.[l]?.trim())) {
      report.skipped.push(`${fid}: pattern ${p.lang} incomplete`);
      continue;
    }
    if (!dryRun) {
      const { error } = await supabase
        .from("pl_patterns")
        .update({ form: p.form.trim(), examples: p.examples?.trim() || null, meaning: p.meaning, status: "approved" })
        .eq("id", target.id);
      if (error) throw new Error(error.message);
    }
    report.patterns++;
  }

  // Drafts: keep, fix, or drop.
  for (const d of out.drafts ?? []) {
    const row = mine.find((s) => s.key === d.key && s.status === "draft");
    if (!row) continue;
    if (d.decision === "drop") {
      if (!dryRun) await supabase.from("pl_sentences").update({ status: "rejected" }).eq("id", row.id);
      report.dropped++;
      continue;
    }
    const texts = d.decision === "fix" ? d : row;
    const markSubs = d.decision === "fix" ? d.marks : d.marks ?? null;
    const set = {
      key: row.key,
      ...Object.fromEntries(LANGS.map((l) => [l, String(texts[l] ?? "").trim()])),
      marks: Object.fromEntries(LANGS.map((l) => [l, [fnPatterns[l].id, markSubs?.[l] ?? ""]])),
    };
    if (!markSubs) {
      // "keep" without marks: reuse the stored ones.
      const { data: stored } = await supabase.from("pl_sentence_patterns").select("lang, start_index, end_index").eq("sentence_id", row.id);
      for (const m of stored ?? []) set.marks[m.lang] = [fnPatterns[m.lang].id, set[m.lang].slice(m.start_index, m.end_index)];
    }
    const { problems, marks } = validateLibrary({ patterns: [], sentences: [set] }, { knownPatterns: known });
    if (problems.length || marks.length !== 4) {
      report.skipped.push(`${row.key}: ${problems.join("; ") || "missing marks"}`);
      continue;
    }
    if (!dryRun) {
      const { error } = await supabase
        .from("pl_sentences")
        .update({ ...Object.fromEntries(LANGS.map((l) => [l, set[l]])), status: "approved", source: "ai" })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      await supabase.from("pl_sentence_patterns").delete().eq("sentence_id", row.id);
      await supabase.from("pl_sentence_patterns").insert(
        marks.map((m) => ({ sentence_id: row.id, pattern_id: m.pattern_id, lang: m.lang, start_index: m.start_index, end_index: m.end_index })),
      );
    }
    toEmbed.push(row.id);
    if (d.decision === "fix") report.fixed++;
    else report.kept++;
  }

  // New sets: validate against everything else in the function (duplicates included).
  const taken = new Set(mine.map((s) => s.key));
  let n = mine.length;
  const nextKey = () => {
    let key;
    do key = `${fid}-${++n}`;
    while (taken.has(key));
    taken.add(key);
    return key;
  };
  const fresh = (out.new ?? []).map((s) => ({
    key: nextKey(),
    topic: fid,
    ...Object.fromEntries(LANGS.map((l) => [l, String(s[l] ?? "").trim()])),
    marks: Object.fromEntries(LANGS.map((l) => [l, [fnPatterns[l].id, s.marks?.[l] ?? ""]])),
  }));
  const check = validateLibrary(
    { patterns: [], sentences: [...others.map((s) => ({ ...s, marks: {} })), ...fresh] },
    { knownPatterns: known },
  );
  const badKeys = new Set(
    check.problems.filter((p) => fresh.some((f) => p.startsWith(`sentence ${f.key}:`))).map((p) => p.split(":")[0].replace("sentence ", "")),
  );
  for (const p of check.problems.filter((x) => fresh.some((f) => x.startsWith(`sentence ${f.key}:`)))) report.skipped.push(`${fid} new: ${p}`);
  const good = fresh.filter((f) => !badKeys.has(f.key) && check.marks.filter((m) => m.key === f.key).length === 4);
  if (good.length && !dryRun) {
    const ins = await supabase
      .from("pl_sentences")
      .insert(good.map(({ key, topic, ja, en, ko, zh }) => ({ key, topic, ja, en, ko, zh, status: "approved", source: "claude" })))
      .select("id, key");
    if (ins.error) throw new Error(ins.error.message);
    const idByKey = new Map(ins.data.map((r) => [r.key, r.id]));
    const rows = check.marks
      .filter((m) => idByKey.has(m.key))
      .map(({ key, ...m }) => ({ sentence_id: idByKey.get(key), ...m }));
    const r = await supabase.from("pl_sentence_patterns").insert(rows);
    if (r.error) throw new Error(r.error.message);
    toEmbed.push(...ins.data.map((r2) => r2.id));
  }
  report.added += good.length;
  report.files++;
  if (!dryRun) renameSync(new URL(file, DIR), new URL(file.replace(".out.json", ".done.json"), DIR));
}

// Search embeddings for everything published here. A failure here leaves the content published;
// `node --env-file=.env.local scripts/publish-reviewed.mjs` fills any missing embeddings later.
async function embedAll(ids) {
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = (await supabase.from("pl_sentences").select("id, ja, en, ko, zh").in("id", ids.slice(i, i + 500))).data ?? [];
    const items = chunk.flatMap((s) => LANGS.map((lang) => ({ sentence_id: s.id, lang, text: s[lang] })));
    for (let j = 0; j < items.length; j += 100) {
      const batch = items.slice(j, j + 100);
      const res = await openai.embeddings.create({ model: "text-embedding-3-small", input: batch.map((b) => b.text) });
      const vectors = res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
      for (let attempt = 1; ; attempt++) {
        const { error } = await supabase
          .from("pl_sentence_embeddings")
          .upsert(batch.map((b, k) => ({ sentence_id: b.sentence_id, lang: b.lang, embedding: vectors[k] })));
        if (!error) break;
        if (attempt === 3) throw new Error(error.message);
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
  }
}
if (!dryRun && toEmbed.length) {
  try {
    await embedAll(toEmbed);
  } catch (err) {
    console.error(`embeddings not finished (${err.message}); run scripts/publish-reviewed.mjs to fill them in`);
  }
}

console.log(
  `${dryRun ? "[dry run] " : ""}${report.files} files · patterns published ${report.patterns} · drafts kept ${report.kept}, fixed ${report.fixed}, dropped ${report.dropped} · new sets ${report.added}`,
);
if (report.skipped.length) console.log(`skipped ${report.skipped.length}:\n` + report.skipped.slice(0, 40).join("\n"));
if (!existsSync(DIR)) process.exit(0);
