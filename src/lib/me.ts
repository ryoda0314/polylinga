import "server-only";
import type { CorrectionResult } from "@/lib/ai";
import { getSession } from "@/lib/auth";
import { approvedPatterns, functionLabels, loadSentences, type ShownSentence } from "@/lib/corpus";
import type { Range } from "@/lib/diff";
import type { Lang } from "@/lib/langs";
import { createAdminClient } from "@/lib/supabase/server";

// 自分: a quiet look back at what the learner has bathed in, noticed and said, in the language they are learning.
// Counts are their own and never compared with anyone's; there are no streaks or badges, and days with nothing in
// them are simply not shown.

export type Sofar = { rains: number; patterns: number; said: number; words: number };
export type MetPattern = { patternId: string; label: string; times: number; used: boolean; lastAt: string | null };
export type DayRain = { patternId: string; label: string; times: number; first: boolean };
export type MySaid = {
  id: string;
  sayingId: string | null;
  text: string;
  gloss: string;
  input: string;
  natural: boolean;
  day: string;
};
export type Day = { day: string; rains: DayRain[]; minna: DayRain[]; said: MySaid[]; words: string[] };
export type MySentence = { id: string; text: string; gloss: string; reached?: boolean };

/** Days are the learner's days in Japan, the same as the daily limits. */
const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
export function dayOf(iso: string): string {
  return DAY_KEY.format(new Date(iso));
}
export const DAY = /^\d{4}-\d{2}-\d{2}$/;

const DAYS_PER_PAGE = 7;
const RAIN_ROWS = 600;
const SAID_ROWS = 120;
const WORD_ROWS = 300;

/** Plain labels (誘う, もし〜なら) for every pattern in the language, by pattern id. */
async function patternLabels(target: Lang, native: Lang): Promise<Map<string, string>> {
  const [patterns, labels] = await Promise.all([approvedPatterns(target), functionLabels()]);
  return new Map(patterns.map((p) => [p.id, labels.get(p.functionId)?.[native] ?? ""]));
}

function toSaid(c: { id: string; saying_id: string | null; input: string; corrected: string; result: unknown; created_at: string }): MySaid {
  const result = (c.result ?? {}) as Partial<CorrectionResult>;
  return {
    id: String(c.id),
    sayingId: c.saying_id ? String(c.saying_id) : null,
    text: String(c.corrected),
    gloss: String(result.meaning ?? ""),
    input: String(c.input),
    natural: result.natural === true,
    day: dayOf(c.created_at),
  };
}

/**
 * For the rain's greeting: whether the learner has already bathed today, and whether they are coming back after a few
 * days away (never how many, and never as a streak).
 */
export async function rainSoFar(userId: string, target: Lang): Promise<{ today: boolean; back: boolean }> {
  const { supabase } = await getSession();
  const today = dayOf(new Date().toISOString());
  const { data } = await supabase
    .from("pl_rain_days")
    .select("day")
    .eq("user_id", userId)
    .eq("lang", target)
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();
  const last = (data?.day as string | undefined) ?? null;
  if (!last) return { today: false, back: false };
  const away = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 86_400_000;
  return { today: away === 0, back: away >= BACK_AFTER_DAYS };
}

/** Days away after which coming back is greeted. */
const BACK_AFTER_DAYS = 3;

/** The four numbers at the top of 自分. */
export async function loadSofar(userId: string, target: Lang): Promise<Sofar> {
  const { supabase } = await getSession();
  const [{ data: exposures }, { count: said }, { count: words }] = await Promise.all([
    supabase
      .from("pl_exposures")
      .select("times, pl_patterns!inner(lang)")
      .eq("user_id", userId)
      .eq("pl_patterns.lang", target),
    supabase.from("pl_corrections").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("target_lang", target),
    supabase.from("pl_words").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("lang", target),
  ]);
  return {
    rains: (exposures ?? []).reduce((n, e) => n + ((e.times as number) ?? 0), 0),
    patterns: (exposures ?? []).length,
    said: said ?? 0,
    words: words ?? 0,
  };
}

/**
 * The learner's days, newest first: what rained on them, what they said and which words they typed in. `before` is a
 * day (YYYY-MM-DD) to page back from; `earlier` is the day to ask for next, or null when there is nothing older.
 */
export async function loadDays(
  userId: string,
  target: Lang,
  native: Lang,
  before: string | null,
): Promise<{ days: Day[]; earlier: string | null; today: string; yesterday: string }> {
  const { supabase } = await getSession();
  const beforeTs = before ? `${before}T00:00:00+09:00` : null;

  let rainQuery = supabase
    .from("pl_rain_days")
    .select("day, pattern_id, source, times, first, last_at")
    .eq("user_id", userId)
    .eq("lang", target)
    .order("day", { ascending: false })
    .order("last_at", { ascending: false })
    .limit(RAIN_ROWS);
  let saidQuery = supabase
    .from("pl_corrections")
    .select("id, saying_id, input, corrected, result, created_at")
    .eq("user_id", userId)
    .eq("target_lang", target)
    .order("created_at", { ascending: false })
    .limit(SAID_ROWS);
  let wordQuery = supabase
    .from("pl_words")
    .select("text, created_at")
    .eq("user_id", userId)
    .eq("lang", target)
    .order("created_at", { ascending: false })
    .limit(WORD_ROWS);
  if (before) rainQuery = rainQuery.lt("day", before);
  if (beforeTs) {
    saidQuery = saidQuery.lt("created_at", beforeTs);
    wordQuery = wordQuery.lt("created_at", beforeTs);
  }
  const [{ data: rains }, { data: said }, { data: words }, labels] = await Promise.all([
    rainQuery,
    saidQuery,
    wordQuery,
    patternLabels(target, native),
  ]);

  const days = new Map<string, Day>();
  const dayFor = (key: string) => {
    let d = days.get(key);
    if (!d) days.set(key, (d = { day: key, rains: [], minna: [], said: [], words: [] }));
    return d;
  };
  for (const r of rains ?? []) {
    const label = labels.get(r.pattern_id) ?? "";
    if (!label) continue;
    const rain = { patternId: r.pattern_id as string, label, times: r.times as number, first: r.first === true };
    dayFor(String(r.day))[r.source === "minna" ? "minna" : "rains"].push(rain);
  }
  for (const c of said ?? []) {
    const s = toSaid(c);
    dayFor(s.day).said.push(s);
  }
  for (const w of words ?? []) dayFor(dayOf(w.created_at)).words.push(String(w.text));

  // A list that came back full may stop partway through its oldest day: show only the days every list covers fully,
  // and leave the rest for the next page.
  const cutoffs = [
    (rains ?? []).length === RAIN_ROWS ? String(rains!.at(-1)!.day) : null,
    (said ?? []).length === SAID_ROWS ? dayOf(said!.at(-1)!.created_at) : null,
    (words ?? []).length === WORD_ROWS ? dayOf(words!.at(-1)!.created_at) : null,
  ].filter((d): d is string => d !== null);
  const cutoff = cutoffs.sort().at(-1) ?? null;
  const all = [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
  const whole = cutoff ? all.filter((d) => d.day > cutoff) : all;
  const shown = (whole.length > 0 ? whole : all.slice(0, 1)).slice(0, DAYS_PER_PAGE);
  const more = all.length > shown.length;
  const now = Date.now();
  return {
    days: shown,
    earlier: more && shown.length > 0 ? shown.at(-1)!.day : null,
    today: dayOf(new Date(now).toISOString()),
    yesterday: dayOf(new Date(now - 86_400_000).toISOString()),
  };
}

/** Every pattern the learner has bathed in, most recent first, and whether they have used it in a sentence of their own. */
export async function loadPatterns(userId: string, target: Lang, native: Lang): Promise<MetPattern[]> {
  const { supabase } = await getSession();
  const [{ data: exposures }, { data: corrections }, labels] = await Promise.all([
    supabase
      .from("pl_exposures")
      .select("pattern_id, times, last_at, pl_patterns!inner(lang)")
      .eq("user_id", userId)
      .eq("pl_patterns.lang", target),
    supabase
      .from("pl_corrections")
      .select("result")
      .eq("user_id", userId)
      .eq("target_lang", target)
      .order("created_at", { ascending: false })
      .limit(300),
    patternLabels(target, native),
  ]);
  const used = new Set<string>();
  for (const c of corrections ?? []) {
    for (const p of (c.result as Partial<CorrectionResult> | null)?.patterns ?? []) used.add(p.id);
  }
  return (exposures ?? [])
    .map((e) => ({
      patternId: e.pattern_id as string,
      label: labels.get(e.pattern_id) ?? "",
      times: (e.times as number) ?? 0,
      used: used.has(e.pattern_id),
      lastAt: (e.last_at as string | null) ?? null,
    }))
    .filter((p) => p.label)
    .sort((a, b) => new Date(b.lastAt ?? 0).getTime() - new Date(a.lastAt ?? 0).getTime());
}

/** The learner's own sentences: what they said, what they wished they could say, and what they let rain on others. */
export async function loadMine(userId: string, target: Lang): Promise<{ said: MySaid[]; wanted: MySentence[]; shared: MySentence[] }> {
  const { supabase } = await getSession();
  const admin = createAdminClient();
  const [{ data: said }, { data: hearts }, { data: shared }] = await Promise.all([
    supabase
      .from("pl_corrections")
      .select("id, saying_id, input, corrected, result, created_at")
      .eq("user_id", userId)
      .eq("target_lang", target)
      .order("created_at", { ascending: false })
      .limit(60),
    // what they said 「これ言いたかった」 to in みんなの雨, newest first, still raining
    admin
      .from("pl_shared_hearts")
      .select("created_at, pl_shared!inner(id, text, gloss, status, target_lang)")
      .eq("user_id", userId)
      .eq("pl_shared.target_lang", target)
      .eq("pl_shared.status", "live")
      .order("created_at", { ascending: false })
      .limit(30),
    // their own sentences in みんなの雨
    admin
      .from("pl_shared")
      .select("id, correction_id, text, gloss")
      .eq("user_id", userId)
      .eq("target_lang", target)
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  type Heart = { pl_shared: { id: string; text: string; gloss: string } | { id: string; text: string; gloss: string }[] };
  const wanted = dedupe(
    ((hearts ?? []) as unknown as Heart[]).map((h) => {
      const s = Array.isArray(h.pl_shared) ? h.pl_shared[0] : h.pl_shared;
      return { id: s.id, text: s.text, gloss: s.gloss };
    }),
  );

  // One sentence may rain under two patterns: show it once, reached if either row reached someone.
  const ownRows = (shared ?? []) as { id: string; correction_id: string; text: string; gloss: string }[];
  const { data: reachedRows } = ownRows.length
    ? await admin.from("pl_shared_hearts").select("shared_id").in("shared_id", ownRows.map((r) => r.id))
    : { data: [] as { shared_id: string }[] };
  const reachedIds = new Set((reachedRows ?? []).map((r) => r.shared_id));
  const byCorrection = new Map<string, MySentence>();
  for (const r of ownRows) {
    const was = byCorrection.get(r.correction_id);
    byCorrection.set(r.correction_id, {
      id: was?.id ?? r.id,
      text: r.text,
      gloss: r.gloss,
      reached: Boolean(was?.reached) || reachedIds.has(r.id),
    });
  }

  return { said: (said ?? []).map(toSaid), wanted, shared: [...byCorrection.values()] };
}

function dedupe(list: MySentence[]) {
  const out: MySentence[] = [];
  for (const s of list) if (!out.some((o) => o.text === s.text)) out.push(s);
  return out;
}

export type PatternLook = {
  id: string;
  label: string;
  /** The parts that were lit in the sentences the learner bathed in, most common first (要不要). */
  parts: string[];
  times: number;
  firstDay: string | null;
  lastAt: string | null;
  /** Library sentences of this pattern the learner has bathed in, most recent first. */
  seen: ShownSentence[];
  /** The learner's own corrected sentences that use it, with the part lit. */
  mine: (MySaid & { mark: Range | null })[];
  /** Other learners' sentences of this pattern met in みんなの雨. */
  minna: { id: string; text: string; gloss: string; mark: Range }[];
};

/** One pattern seen from the learner's side, or null if it is not one they have met in this language. */
export async function loadPatternLook(userId: string, target: Lang, native: Lang, patternId: string): Promise<PatternLook | null> {
  const { supabase } = await getSession();
  const labels = await patternLabels(target, native);
  const label = labels.get(patternId);
  if (label === undefined) return null;

  const [{ data: exposure }, { data: firstRow }, { data: markRows }, { data: corrections }, { data: minnaRows }] =
    await Promise.all([
      supabase.from("pl_exposures").select("times, last_at").eq("user_id", userId).eq("pattern_id", patternId).maybeSingle(),
      supabase
        .from("pl_rain_days")
        .select("day")
        .eq("user_id", userId)
        .eq("pattern_id", patternId)
        .eq("first", true)
        .order("day")
        .limit(1)
        .maybeSingle(),
      supabase.from("pl_sentence_patterns").select("sentence_id").eq("pattern_id", patternId).eq("lang", target),
      supabase
        .from("pl_corrections")
        .select("id, saying_id, input, corrected, result, created_at")
        .eq("user_id", userId)
        .eq("target_lang", target)
        .order("created_at", { ascending: false })
        .limit(300),
      createAdminClient()
        .from("pl_shared_seen")
        .select("last_at, pl_shared!inner(id, text, gloss, start_index, end_index, pattern_id, status)")
        .eq("user_id", userId)
        .eq("pl_shared.pattern_id", patternId)
        .eq("pl_shared.status", "live")
        .order("last_at", { ascending: false })
        .limit(12),
    ]);

  const ids = (markRows ?? []).map((m) => m.sentence_id as string);
  const { data: seenRows } = ids.length
    ? await supabase
        .from("pl_seen")
        .select("sentence_id, last_at")
        .eq("user_id", userId)
        .in("sentence_id", ids)
        .order("last_at", { ascending: false })
        .limit(30)
    : { data: [] as { sentence_id: string; last_at: string }[] };
  const seen = (await loadSentences((seenRows ?? []).map((s) => s.sentence_id), target, native)).map((s) => ({
    ...s,
    marks: s.marks.filter((m) => m.patternId === patternId),
  }));
  type Shared = { id: string; text: string; gloss: string; start_index: number; end_index: number };
  const minna = ((minnaRows ?? []) as unknown as { pl_shared: Shared | Shared[] }[]).map((r) => {
    const s = Array.isArray(r.pl_shared) ? r.pl_shared[0] : r.pl_shared;
    return { id: s.id, text: s.text, gloss: s.gloss, mark: { start: s.start_index, end: s.end_index } };
  });
  // Met in the library rain, or only in みんなの雨.
  if (!exposure && seen.length === 0 && minna.length === 0) return null;

  const counts = new Map<string, number>();
  for (const s of seen) {
    for (const m of s.marks) {
      const part = s.text.slice(m.start, m.end).trim();
      if (part) counts.set(part, (counts.get(part) ?? 0) + 1);
    }
  }
  const parts = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([part]) => part);

  const mine = (corrections ?? []).flatMap((c) => {
    const p = ((c.result as Partial<CorrectionResult> | null)?.patterns ?? []).find((x) => x.id === patternId);
    return p ? [{ ...toSaid(c), mark: { start: p.start, end: p.end } }] : [];
  });


  return {
    id: patternId,
    label,
    parts,
    times: (exposure?.times as number | undefined) ?? 0,
    firstDay: (firstRow?.day as string | undefined) ?? null,
    lastAt: (exposure?.last_at as string | null | undefined) ?? null,
    seen,
    mine,
    minna,
  };
}

/** Stop one of the learner's sentences raining in みんなの雨 (every pattern it rained under). */
export async function withdrawShared(userId: string, sharedId: string) {
  const admin = createAdminClient();
  const { data: row } = await admin.from("pl_shared").select("correction_id, user_id").eq("id", sharedId).maybeSingle();
  if (!row || row.user_id !== userId) return;
  await admin.from("pl_shared").update({ status: "hidden" }).eq("correction_id", row.correction_id).eq("user_id", userId);
}
