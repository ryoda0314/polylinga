import "server-only";
import { getSession } from "@/lib/auth";
import { sentenceAudio, type Audio } from "@/lib/corpus";
import type { Range } from "@/lib/diff";
import type { Lang } from "@/lib/langs";
import { readingFor } from "@/lib/reading";
import rainWords from "@/lib/rain-words.json";
import {
  findMemoHits,
  isDue,
  memoSpans,
  nextReturn,
  rainOrder,
  returnAfterRain,
  sentenceLength,
  wordRainTurn,
  type SentencePart,
} from "@/lib/shower-core";

export { findMemoHits };

// The example-sentence shower. One "ひと浴び" is a few sentences that share a pattern; the learner
// notices the common part on their own and can check afterwards. Patterns come back after a while
// with sentences they have not met yet: that is how they "meet again", with no quiz involved.
// ことばの雨 is the same with a word: sentences of different patterns that share one word (by its dictionary form, from
// 語のまとまり), falling as every third rain.

const CLUSTER_SIZE = 4;
const MIN_CLUSTER = 2;
/** A word rains only once the library has this many sentences with it, so there is something to compare. */
const MIN_WORD_SENTENCES = 4;

export type ShowerSentence = {
  id: string;
  text: string;
  gloss: string;
  reading: string[] | null;
  audio: Audio;
  mark: Range | null;
  /** The same pattern's part in the learner's own language, lit together with `mark` after they ask. */
  glossMark: Range | null;
  seenBefore: boolean;
  /** Where words from the learner's memo appear in `text`. */
  memoHits: Range[];
  /** 語のまとまり, once the sentence has been split (the word sheet's chips and its answer); null until then. */
  parts?: SentencePart[] | null;
};

export type ShowerCluster = {
  /** The way of saying the sentences share; "" for ことばの雨. */
  patternId: string;
  /** ことばの雨: the word the sentences share (its dictionary form); null for a way of saying. */
  word: string | null;
  /**
   * What the sentences share, named once the learner has asked: what the pattern does, in plain words in the
   * learner's language (誘う, もし〜なら; no grammar notation), or for ことばの雨 the word itself, in the language learned.
   */
  label: string | null;
  /** True when the learner has bathed in this pattern (or word) before. */
  again: boolean;
  /** Whole days since it last came round, when it is coming back. */
  againDays: number | null;
  sentences: ShowerSentence[];
  /** Where the rain comes from: the library, or other learners' corrected sentences (みんなの雨). */
  source?: "library" | "minna";
};

type MemoWord = { text: string; base: string | null };

async function memoWords(userId: string, lang: Lang): Promise<MemoWord[]> {
  const { supabase } = await getSession();
  const { data } = await supabase.from("pl_words").select("text, base").eq("user_id", userId).eq("lang", lang);
  return (data ?? []).map((w) => ({ text: String(w.text), base: (w.base as string | null) ?? null }));
}

type PartRow = {
  sentence_id: string;
  start_index: number;
  end_index: number;
  base: string;
  kind: string;
  meaning: Record<string, string> | null;
  gloss: Record<string, [number, number]> | null;
};
const PART_COLUMNS = "sentence_id, idx, start_index, end_index, base, kind, meaning, gloss";

function toPart(r: PartRow, native: Lang): SentencePart {
  const g = r.gloss?.[native];
  return {
    start: r.start_index,
    end: r.end_index,
    base: r.base,
    kind: r.kind === "function" ? "function" : "word",
    meaning: r.meaning?.[native] ?? null,
    gloss: Array.isArray(g) ? { start: g[0], end: g[1] } : null,
  };
}

/** 語のまとまり of these sentences, in order; a sentence not split yet is absent. */
export async function partsOf(ids: string[], target: Lang, native: Lang): Promise<Map<string, SentencePart[]>> {
  const out = new Map<string, SentencePart[]>();
  if (ids.length === 0) return out;
  const { supabase } = await getSession();
  const { data } = await supabase.from("pl_sentence_parts").select(PART_COLUMNS).eq("lang", target).in("sentence_id", ids).order("idx");
  for (const r of (data ?? []) as PartRow[]) out.set(r.sentence_id, [...(out.get(r.sentence_id) ?? []), toPart(r, native)]);
  return out;
}

type Candidate = { sentenceId: string; mark: Range; extra: number | null; length: number; lastSeen: number | null; memo: boolean };

/** Load the chosen sentences as the rain shows them: text, translation, sound, the shared part and its counterpart. */
async function loadRain(
  chosen: Candidate[],
  glossMarkOf: (id: string, parts: SentencePart[] | undefined) => Promise<Range | null> | Range | null,
  words: MemoWord[],
  target: Lang,
  native: Lang,
): Promise<ShowerSentence[]> {
  const { supabase } = await getSession();
  const ids = chosen.map((c) => c.sentenceId);
  const [{ data: rows }, parts] = await Promise.all([
    supabase.from("pl_sentences").select("id, ja, en, ko, zh, zh_pinyin").in("id", ids),
    partsOf(ids, target, native),
  ]);
  const byId = new Map((rows ?? []).map((r) => [String(r.id), r as Record<string, string>]));
  const out: ShowerSentence[] = [];
  for (const c of chosen) {
    const row = byId.get(c.sentenceId);
    if (!row) continue;
    const text = row[target];
    const own = parts.get(c.sentenceId) ?? null;
    out.push({
      id: c.sentenceId,
      text,
      gloss: row[native],
      reading: readingFor(text, target, row.zh_pinyin),
      audio: sentenceAudio(text, target, c.sentenceId),
      mark: c.mark,
      glossMark: await glossMarkOf(c.sentenceId, own ?? undefined),
      seenBefore: c.lastSeen !== null,
      memoHits: memoSpans(text, own, words),
      parts: own,
    });
  }
  return out;
}

/** Choose and load the next cluster for this learner, avoiding the pattern they just had. */
export async function pickCluster(
  userId: string,
  target: Lang,
  native: Lang,
  avoidPatternId: string | null,
): Promise<ShowerCluster | null> {
  const { supabase } = await getSession();
  const [{ data: patterns }, { data: functions }, { data: counts }, { data: exposures }, words] = await Promise.all([
    supabase.from("pl_patterns").select("id, function_id, step").eq("lang", target),
    supabase.from("pl_functions").select("id, position, label"),
    supabase.rpc("pl_pattern_counts", { target }),
    supabase.from("pl_exposures").select("pattern_id, times, last_at, next_at, return_after").eq("user_id", userId),
    memoWords(userId, target),
  ]);

  const position = new Map((functions ?? []).map((f) => [f.id, f.position as number]));
  const size = new Map(((counts ?? []) as { pattern_id: string; n: number }[]).map((c) => [c.pattern_id, Number(c.n)]));
  const usable = (patterns ?? []).filter((p) => p.id !== avoidPatternId && (size.get(p.id) ?? 0) >= MIN_CLUSTER);
  if (usable.length === 0) return null;

  const exposure = new Map((exposures ?? []).map((e) => [e.pattern_id, e]));
  const rains = rainsIn(patterns ?? [], exposures ?? []);
  const now = Date.now();
  // Due patterns come back first: the ones overdue by the most rains, then by the longest wait in days.
  const due = usable
    .filter((p) => exposure.has(p.id) && isDue(exposure.get(p.id)!, rains, now))
    .sort((a, b) => {
      const ea = exposure.get(a.id)!, eb = exposure.get(b.id)!;
      return (
        (ea.return_after ?? Infinity) - (eb.return_after ?? Infinity) ||
        new Date(ea.next_at ?? 0).getTime() - new Date(eb.next_at ?? 0).getTime()
      );
    });
  // New ones in the order that suits someone new to the language (steps.json), then by the functions' own order.
  const fresh = usable
    .filter((p) => !exposure.has(p.id))
    .sort(
      (a, b) =>
        (a.step ?? 500) - (b.step ?? 500) ||
        (position.get(a.function_id) ?? 999) - (position.get(b.function_id) ?? 999) ||
        a.id.localeCompare(b.id),
    );
  const soonest = [...usable].sort(
    (a, b) =>
      new Date(exposure.get(a.id)?.next_at ?? 0).getTime() - new Date(exposure.get(b.id)?.next_at ?? 0).getTime(),
  );
  const pattern = due[0] ?? fresh[0] ?? soonest[0];

  // Sentences of this pattern the learner has not seen come first, the plainest and shortest of them first (among
  // equally plain ones, those with a memo word), then the ones seen longest ago (rainOrder). The lists are asked for at
  // once: the seen ones and the memo words' pieces are found through the sentence's own marks.
  const bases = [...new Set(words.flatMap((w) => (w.base ? [w.base] : [])))];
  const [{ data: markRows }, { data: seenRows }, { data: memoParts }] = await Promise.all([
    supabase
      .from("pl_sentence_patterns")
      .select(`sentence_id, start_index, end_index, extra, pl_sentences!inner(${target})`)
      .eq("pattern_id", pattern.id)
      .eq("lang", target),
    supabase
      .from("pl_seen")
      .select("sentence_id, last_at, pl_sentences!inner(pl_sentence_patterns!inner(pattern_id))")
      .eq("user_id", userId)
      .eq("pl_sentences.pl_sentence_patterns.pattern_id", pattern.id),
    bases.length
      ? supabase
          .from("pl_sentence_parts")
          .select("sentence_id, pl_sentences!inner(pl_sentence_patterns!inner(pattern_id))")
          .eq("lang", target)
          .in("base", bases)
          .eq("pl_sentences.pl_sentence_patterns.pattern_id", pattern.id)
      : { data: [] },
  ]);
  const lastSeen = new Map((seenRows ?? []).map((s) => [s.sentence_id, new Date(s.last_at).getTime()]));
  const withMemo = new Set((memoParts ?? []).map((p) => p.sentence_id as string));
  const typed = words.map((w) => w.text);
  const candidates: Candidate[] = (markRows ?? []).map((m) => {
    const text = (m.pl_sentences as unknown as Record<string, string> | null)?.[target] ?? "";
    return {
      sentenceId: m.sentence_id as string,
      mark: { start: m.start_index as number, end: m.end_index as number },
      extra: (m.extra as number | null) ?? null,
      length: sentenceLength(text, target),
      lastSeen: lastSeen.get(m.sentence_id as string) ?? null,
      memo: withMemo.has(m.sentence_id as string) || findMemoHits(text, typed).length > 0,
    };
  });
  const chosen = rainOrder(candidates).slice(0, CLUSTER_SIZE);

  // The pattern's part in the translation, asked for while the sentences load.
  const glossMark = Promise.resolve(
    supabase
      .from("pl_sentence_patterns")
      .select("sentence_id, start_index, end_index")
      .in("sentence_id", chosen.map((c) => c.sentenceId))
      .eq("lang", native),
  ).then(
    ({ data }) =>
      new Map((data ?? []).map((m) => [m.sentence_id as string, { start: m.start_index as number, end: m.end_index as number }])),
  );
  const sentences = await loadRain(chosen, async (id) => (await glossMark).get(id) ?? null, words, target, native);
  if (sentences.length < MIN_CLUSTER) return null;

  const fn = (functions ?? []).find((f) => f.id === pattern.function_id);
  const label = ((fn?.label ?? {}) as Record<string, string>)[native] ?? null;
  const lastAt = exposure.get(pattern.id)?.last_at;
  return {
    patternId: pattern.id,
    word: null,
    label,
    again: exposure.has(pattern.id),
    againDays: lastAt ? Math.floor((now - new Date(lastAt).getTime()) / 86_400_000) : null,
    sentences,
  };
}

/**
 * ことばの雨: choose a word and load sentences that share it. Words come back like patterns (when due). Before new ones,
 * the learner's own words they could not guess (予想できなかった), then the list in src/lib/rain-words.json: words that
 * go with many ways of saying (まだ, 一緒に, 今日 ...), not topics, in an order for someone new to the language. Only
 * words with enough split sentences in the library rain. Null when none is ready, and the rain is of a pattern instead.
 */
export async function pickWordCluster(
  userId: string,
  target: Lang,
  native: Lang,
  avoidWord: string | null,
  counted?: { words: number },
): Promise<ShowerCluster | null> {
  const { supabase } = await getSession();
  const list = ((rainWords as Record<string, string[]>)[target] ?? []).map((w) => w.toLowerCase());
  const [{ data: exposures }, { data: stuckRows }, words, rains] = await Promise.all([
    supabase.from("pl_word_exposures").select("base, times, last_at, next_at, return_after").eq("user_id", userId).eq("lang", target),
    supabase
      .from("pl_words")
      .select("base")
      .eq("user_id", userId)
      .eq("lang", target)
      .not("stuck_at", "is", null)
      .not("base", "is", null)
      .order("stuck_at"),
    memoWords(userId, target),
    counted ?? rainsSoFar(userId, target),
  ]);
  const avoid = avoidWord?.toLowerCase() ?? null;
  const stuck = (stuckRows ?? []).map((r) => String(r.base).toLowerCase());
  const exposure = new Map((exposures ?? []).map((e) => [String(e.base).toLowerCase(), e]));
  const named = [...new Set([...stuck, ...list, ...exposure.keys()])].filter((b) => b !== avoid);
  if (named.length === 0) return null;

  // How many split sentences each word is in (enough to compare?), and the pieces themselves to choose from.
  const { data: pieceRows } = await supabase
    .from("pl_sentence_parts")
    .select("sentence_id, base, start_index, end_index, gloss")
    .eq("lang", target)
    .in("base", named)
    .limit(5000);
  const pieces = new Map<string, PartRow[]>();
  for (const p of (pieceRows ?? []) as PartRow[]) {
    const b = p.base.toLowerCase();
    if (!(pieces.get(b) ?? []).some((q) => q.sentence_id === p.sentence_id)) pieces.set(b, [...(pieces.get(b) ?? []), p]);
  }
  const ready = (b: string) => (pieces.get(b)?.length ?? 0) >= MIN_WORD_SENTENCES;
  const now = Date.now();
  const due = [...exposure.entries()]
    .filter(([b, e]) => ready(b) && isDue(e, rains.words, now))
    .sort(([, a], [, b]) => new Date(a.next_at ?? 0).getTime() - new Date(b.next_at ?? 0).getTime())
    .map(([b]) => b);
  const fresh = [...stuck, ...list].filter((b) => ready(b) && !exposure.has(b) && b !== avoid);
  const word = due[0] ?? fresh[0];
  if (!word) return null;

  const mine = pieces.get(word)!;
  const ids = mine.map((p) => p.sentence_id);
  const [{ data: seenRows }, { data: textRows }, { data: markRows }, { data: bathed }] = await Promise.all([
    supabase.from("pl_seen").select("sentence_id, last_at").eq("user_id", userId).in("sentence_id", ids),
    supabase.from("pl_sentences").select(`id, ${target}`).in("id", ids),
    supabase.from("pl_sentence_patterns").select("sentence_id, pattern_id").eq("lang", target).in("sentence_id", ids),
    supabase.from("pl_exposures").select("pattern_id").eq("user_id", userId),
  ]);
  const lastSeen = new Map((seenRows ?? []).map((s) => [s.sentence_id, new Date(s.last_at).getTime()]));
  // A sentence of a way of saying the learner has bathed in carries nothing new but the word (plain, extra 0); one of a
  // way of saying still to come carries that too (extra 1). So the word is met first where it is the one new thing.
  const known = new Set((bathed ?? []).map((e) => e.pattern_id as string));
  const familiar = new Set((markRows ?? []).filter((m) => known.has(m.pattern_id as string)).map((m) => m.sentence_id as string));
  const textOf = new Map((textRows ?? []).map((r) => [String(r.id), String((r as Record<string, unknown>)[target] ?? "")]));
  const typed = words.map((w) => w.text);
  const candidates: Candidate[] = mine
    .filter((p) => textOf.has(p.sentence_id))
    .map((p) => ({
      sentenceId: p.sentence_id,
      mark: { start: p.start_index, end: p.end_index },
      extra: familiar.has(p.sentence_id) ? 0 : 1,
      length: sentenceLength(textOf.get(p.sentence_id)!, target),
      lastSeen: lastSeen.get(p.sentence_id) ?? null,
      memo: findMemoHits(textOf.get(p.sentence_id)!, typed.filter((w) => w.toLowerCase() !== word)).length > 0,
    }));
  const chosen = rainOrder(candidates).slice(0, CLUSTER_SIZE);
  const glossOf = new Map(mine.map((p) => [p.sentence_id, p.gloss?.[native]]));
  const sentences = await loadRain(
    chosen,
    (id) => {
      const g = glossOf.get(id);
      return Array.isArray(g) ? { start: g[0], end: g[1] } : null;
    },
    words,
    target,
    native,
  );
  if (sentences.length < MIN_CLUSTER) return null;

  const e = exposure.get(word);
  return {
    patternId: "",
    word,
    label: mine[0].base,
    again: Boolean(e),
    againDays: e?.last_at ? Math.floor((now - new Date(e.last_at).getTime()) / 86_400_000) : null,
    sentences,
  };
}

/**
 * The next rain from the library: every third one ことばの雨 (wordRainTurn) when a word is ready, otherwise a way of
 * saying. `after` is what a correction's 次の雨 came from, so the next rain is something else.
 */
export async function pickRain(
  userId: string,
  target: Lang,
  native: Lang,
  after: { patternId: string | null; word: string | null },
): Promise<ShowerCluster | null> {
  const rains = await rainsSoFar(userId, target);
  if (wordRainTurn(rains.all)) {
    const word = await pickWordCluster(userId, target, native, after.word, rains);
    if (word) return word;
  }
  return pickCluster(userId, target, native, after.patternId);
}

/** How many rains (clusters) the learner has bathed in, in this language: every bath counts once for its pattern. */
function rainsIn(patterns: { id: string }[], exposures: { pattern_id: string; times: number }[]): number {
  const ids = new Set(patterns.map((p) => p.id));
  return exposures.reduce((n, e) => n + (ids.has(e.pattern_id) ? (e.times ?? 0) : 0), 0);
}

/** Rains so far in this language: of ways of saying, of words, and both (which decides when ことばの雨 falls). */
export async function rainsSoFar(userId: string, target: Lang): Promise<{ patterns: number; words: number; all: number }> {
  const { supabase } = await getSession();
  const [{ data: patterns }, { data: exposures }, { data: wordExposures }] = await Promise.all([
    supabase.from("pl_patterns").select("id").eq("lang", target),
    supabase.from("pl_exposures").select("pattern_id, times").eq("user_id", userId),
    supabase.from("pl_word_exposures").select("times").eq("user_id", userId).eq("lang", target),
  ]);
  const p = rainsIn(patterns ?? [], exposures ?? []);
  const w = (wordExposures ?? []).reduce((n, e) => n + ((e.times as number) ?? 0), 0);
  return { patterns: p, words: w, all: p + w };
}

/** Memo words met in these sentences (as typed, or by dictionary form), counted as meetings. */
async function countMeetings(userId: string, target: Lang, ids: string[], nowIso: string): Promise<PromiseLike<unknown>[]> {
  const { supabase } = await getSession();
  const [{ data: rows }, { data: words }, { data: partRows }] = await Promise.all([
    supabase.from("pl_sentences").select(`id, ${target}`).in("id", ids),
    supabase.from("pl_words").select("id, text, base, encounters").eq("user_id", userId).eq("lang", target),
    supabase.from("pl_sentence_parts").select("sentence_id, start_index, end_index, base").eq("lang", target).in("sentence_id", ids),
  ]);
  const writes: PromiseLike<unknown>[] = [];
  for (const w of words ?? []) {
    const word = { text: String(w.text), base: (w.base as string | null) ?? null };
    const met = (rows ?? []).filter((r) => {
      const text = String((r as Record<string, unknown>)[target] ?? "");
      const parts = (partRows ?? [])
        .filter((p) => p.sentence_id === r.id)
        .map((p) => ({ start: p.start_index as number, end: p.end_index as number, base: String(p.base) }));
      return memoSpans(text, parts, [word]).length > 0;
    }).length;
    if (met > 0) {
      writes.push(
        supabase
          .from("pl_words")
          .update({ encounters: (w.encounters as number) + met, last_seen_at: nowIso, last_met_at: nowIso })
          .eq("id", w.id),
      );
    }
  }
  return writes;
}

/** The sentences as seen, once more each. */
async function markSeen(userId: string, ids: string[], nowIso: string) {
  const { supabase } = await getSession();
  const { data: seenRows } = await supabase.from("pl_seen").select("sentence_id, times").eq("user_id", userId).in("sentence_id", ids);
  const seen = new Map((seenRows ?? []).map((s) => [s.sentence_id, s.times as number]));
  return supabase.from("pl_seen").upsert(ids.map((id) => ({ user_id: userId, sentence_id: id, times: (seen.get(id) ?? 0) + 1, last_at: nowIso })));
}

/** Remember a finished cluster: when the pattern returns, which sentences were seen, which memo words were met. */
export async function recordCluster(userId: string, target: Lang, patternId: string, sentenceIds: string[]) {
  const { supabase } = await getSession();
  const ids = sentenceIds.slice(0, CLUSTER_SIZE);
  const nowIso = new Date().toISOString();

  const [{ data: patterns }, { data: exposures }, { data: known }] = await Promise.all([
    supabase.from("pl_patterns").select("id").eq("lang", target),
    supabase.from("pl_exposures").select("pattern_id, times").eq("user_id", userId),
    supabase.from("pl_sentences").select("id").in("id", ids),
  ]);
  const real = (known ?? []).map((r) => String(r.id));
  const exposure = (exposures ?? []).find((e) => e.pattern_id === patternId);
  const times = (exposure?.times ?? 0) + 1;
  const rains = rainsIn(patterns ?? [], exposures ?? []) + 1; // counting this one

  const writes: PromiseLike<unknown>[] = [
    supabase.from("pl_exposures").upsert({
      user_id: userId,
      pattern_id: patternId,
      times,
      last_at: nowIso,
      next_at: nextReturn(times),
      return_after: returnAfterRain(times, rains),
    }),
    markSeen(userId, real, nowIso),
    ...(await countMeetings(userId, target, real, nowIso)),
    // The day's record for 自分 (pl_rain_days), counted per pattern.
    supabase.rpc("pl_log_rain", { p_pattern: patternId, p_source: "library", p_first: times === 1 }),
  ];
  await Promise.all(writes);
}

/** Remember a finished ことばの雨: when the word returns, which sentences were seen, which memo words were met. */
export async function recordWordCluster(userId: string, target: Lang, word: string, sentenceIds: string[]) {
  const { supabase } = await getSession();
  const ids = sentenceIds.slice(0, CLUSTER_SIZE);
  const nowIso = new Date().toISOString();
  const base = word.toLowerCase();

  const [{ data: exposure }, { data: known }, rains] = await Promise.all([
    supabase.from("pl_word_exposures").select("times").eq("user_id", userId).eq("lang", target).eq("base", base).maybeSingle(),
    // Only sentences that really carry the word count: the ids come from the page.
    supabase.from("pl_sentence_parts").select("sentence_id").eq("lang", target).eq("base", base).in("sentence_id", ids),
    rainsSoFar(userId, target),
  ]);
  const real = [...new Set((known ?? []).map((r) => String(r.sentence_id)))];
  if (real.length === 0) return;
  const times = ((exposure?.times as number | undefined) ?? 0) + 1;

  await Promise.all([
    supabase.from("pl_word_exposures").upsert({
      user_id: userId,
      lang: target,
      base,
      times,
      last_at: nowIso,
      next_at: nextReturn(times),
      return_after: returnAfterRain(times, rains.words + 1),
    }),
    markSeen(userId, real, nowIso),
    ...(await countMeetings(userId, target, real, nowIso)),
    supabase.rpc("pl_log_word_rain", { p_lang: target, p_base: base, p_first: times === 1 }),
  ]);
}

/** Library sentences with this word by its dictionary form (once split), each with where the word is. */
async function sentencesWithBase(base: string, target: Lang, excludeId: string | null, limit: number) {
  const { supabase } = await getSession();
  let query = supabase.from("pl_sentence_parts").select("sentence_id, start_index, end_index").eq("lang", target).eq("base", base).limit(40);
  if (excludeId) query = query.neq("sentence_id", excludeId);
  const { data } = await query;
  const hits = new Map<string, Range[]>();
  for (const p of data ?? []) {
    const id = String(p.sentence_id);
    hits.set(id, [...(hits.get(id) ?? []), { start: p.start_index as number, end: p.end_index as number }]);
  }
  return [...hits].slice(0, limit);
}

/**
 * Other approved sentences with a word, for the word sheet and the memo: found by its dictionary form once the library
 * has been split (so 먹다 finds 먹었어 too), otherwise by its text.
 */
export async function sentencesWith(word: string, target: Lang, native: Lang, excludeId: string | null, base: string | null = null) {
  const { supabase } = await getSession();
  const byBase = base ? await sentencesWithBase(base, target, excludeId, 5) : [];
  let rows: Record<string, string>[];
  if (byBase.length) {
    const { data } = await supabase.from("pl_sentences").select("id, ja, en, ko, zh, zh_pinyin").in("id", byBase.map(([id]) => id));
    const byId = new Map((data ?? []).map((r) => [String(r.id), r as Record<string, string>]));
    rows = byBase.flatMap(([id]) => (byId.has(id) ? [byId.get(id)!] : []));
  } else {
    const needle = word.replace(/[%_\\]/g, (c) => `\\${c}`);
    let query = supabase.from("pl_sentences").select("id, ja, en, ko, zh, zh_pinyin").ilike(target, `%${needle}%`).limit(6);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query;
    rows = ((data ?? []) as Record<string, string>[]).slice(0, 5);
  }
  const baseHits = new Map(byBase);
  const parts = await partsOf(rows.map((r) => String(r.id)), target, native);
  return rows.map((row) => {
    const id = String(row.id);
    const text = row[target];
    const own = parts.get(id) ?? null;
    const hits = baseHits.get(id) ?? findMemoHits(text, [word]);
    return {
      id,
      text,
      gloss: row[native],
      reading: readingFor(text, target, row.zh_pinyin),
      audio: sentenceAudio(text, target, id),
      hits,
      // What the word means in this sentence, for the answer once the learner asks (答え合わせ).
      meaning: own?.find((p) => hits.some((h) => h.start === p.start && h.end === p.end))?.meaning ?? null,
    };
  });
}
