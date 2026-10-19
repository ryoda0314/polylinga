import type { Dict } from "@/lib/i18n";

// The learning record written out as one Markdown text, for the learner to keep or to hand to an AI of their choice.
// Pure: the data comes from loadExport (me.ts), the words from the dictionary, so it can be tested on its own.

export type Stage = "new" | "seen" | "understood" | "used";

export type ExportData = {
  /** Language names as the learner reads them (韓国語, 日本語). */
  targetName: string;
  nativeName: string;
  cue: string | null;
  today: string;
  totals: { rains: number; patterns: number; said: number; words: number };
  /** Newest first, at most the ones written out; `saidAll` counts every one. */
  said: {
    day: string;
    intent: string | null;
    input: string;
    corrected: string;
    natural: boolean;
    explanation: string;
    meaning: string;
    patterns: string[];
  }[];
  saidAll: number;
  patterns: { form: string; label: string; times: number; used: boolean; lastDay: string | null }[];
  words: { text: string; note: string | null; stage: Stage; encounters: number; uses: number; since: string }[];
  days: { day: string; rains: number; said: number; words: number }[];
};

/** One line in a table cell or list item: no line breaks, and no bar that would end the cell. */
function cell(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\|/g, "｜")
    .trim();
}

function table(head: readonly string[], rows: (string | number | null)[][]): string[] {
  return [
    `| ${head.join(" | ")} |`,
    `|${head.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
  ];
}

export function formatExport(d: ExportData, L: Dict["exportDoc"]): string {
  const out: string[] = [`# ${L.title}`, "", L.ask(d.targetName), "", `## ${L.howTitle}`, ...L.how.map((h) => `- ${h}`), ""];

  const natural = d.said.filter((s) => s.natural).length;
  const known = d.days.map((x) => x.day).sort();
  out.push(`## ${L.summaryTitle}`, `- ${L.learning(d.targetName, d.nativeName)}`);
  if (known.length) out.push(`- ${L.period(known[0], known[known.length - 1], known.length)}`);
  out.push(`- ${L.totals(d.totals.rains, d.totals.patterns, d.totals.said, natural, d.totals.words)}`);
  if (d.cue) out.push(`- ${L.cue(d.cue)}`);
  out.push(`- ${L.written(d.today)}`, "");

  out.push(`## ${L.saidTitle}`);
  if (d.said.length < d.saidAll) out.push(L.saidMore(d.said.length, d.saidAll));
  if (d.said.length === 0) out.push(L.none);
  d.said.forEach((s, i) => {
    out.push(`${i + 1}. ${s.day}`);
    if (s.intent) out.push(`   - ${L.intent}: ${cell(s.intent)}`);
    if (s.natural || s.input.trim() === s.corrected.trim()) {
      out.push(`   - ${L.wrote}: ${cell(s.input)}（${L.natural}）`);
    } else {
      out.push(`   - ${L.wrote}: ${cell(s.input)}`, `   - ${L.fixed}: ${cell(s.corrected)}`);
      if (s.explanation) out.push(`   - ${L.why}: ${cell(s.explanation)}`);
    }
    if (s.meaning) out.push(`   - ${L.meaning}: ${cell(s.meaning)}`);
    if (s.patterns.length) out.push(`   - ${L.used}: ${s.patterns.map(cell).join("、")}`);
  });
  out.push("");

  out.push(`## ${L.patternsTitle}`);
  if (d.patterns.length === 0) out.push(L.none);
  else
    out.push(
      ...table(
        L.patternHead,
        [...d.patterns]
          .sort((a, b) => b.times - a.times)
          .map((p) => [p.form, p.label, p.times, p.used ? L.usedYes : L.usedNo, p.lastDay]),
      ),
    );
  out.push("");

  out.push(`## ${L.wordsTitle}`);
  if (d.words.length === 0) out.push(L.none);
  else out.push(...table(L.wordHead, d.words.map((w) => [w.text, w.note, L.stages[w.stage], w.encounters, w.uses, w.since])));
  out.push("");

  out.push(`## ${L.daysTitle}`);
  if (d.days.length === 0) out.push(L.none);
  else out.push(...table(L.dayHead, d.days.map((x) => [x.day, x.rains, x.said, x.words])));

  return out.join("\n") + "\n";
}
