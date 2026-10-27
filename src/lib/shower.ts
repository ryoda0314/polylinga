import "server-only";
import { getSession } from "@/lib/auth";
import { sentenceAudio, type Audio } from "@/lib/corpus";
import type { Range } from "@/lib/diff";
import type { Lang } from "@/lib/langs";
import { readingFor } from "@/lib/reading";
import { findMemoHits, isDue, nextReturn, rainOrder, returnAfterRain, sentenceLength } from "@/lib/shower-core";

export { findMemoHits };

// The example-sentence shower. One "ひと浴び" is a few sentences that share a pattern; the learner
// notices the common part on their own and can check afterwards. Patterns come back after a while
// with sentences they have not met yet: that is how they "meet again", with no quiz involved.

const CLUSTER_SIZE = 4;
const MIN_CLUSTER = 2;

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
};

export type ShowerCluster = {
  patternId: string;
  /** What the pattern does, in plain words in the learner's language (誘う, もし〜なら). No grammar notation. */
  label: string | null;
  /** True when the learner has bathed in this pattern before. */
  again: boolean;
  /** Whole days since it last came round, when it is coming back. */
  againDays: number | null;
  sentences: ShowerSentence[];
  /** Where the rain comes from: the library, or other learners' corrected sentences (みんなの雨). */
  source?: "library" | "minna";
};

async function memoWords(userId: string, lang: Lang): Promise<string[]> {
  const { supabase } = await getSession();
  const { data } = await supabase.from("pl_words").select("text").eq("user_id", userId).eq("lang", lang);
  return (data ?? []).map((w) => String(w.text));
}

/** Choose and load the next cluster for this learner, avoiding the pattern they just had. */
export async function pickCluster(
  userId: string,
  target: Lang,
  native: Lang,
  avoidPatternId: string | null,
): Promise<ShowerCluster | null> {
  const { supabase } = await getSession();
  const [{ data: patterns }, { data: functions }, { data: counts }, { data: exposures }] = await Promise.all([
    supabase.from("pl_patterns").select("id, function_id, step").eq("lang", target),
    supabase.from("pl_functions").select("id, position, label"),
    supabase.rpc("pl_pattern_counts", { target }),
    supabase.from("pl_exposures").select("pattern_id, times, last_at, next_at, return_after").eq("user_id", userId),
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

  // Sentences of this pattern the learner has not seen come first, the plainest and shortest of them first, then the
  // ones seen longest ago (rainOrder). Both lists are asked for at once: the seen ones are found through the
  // sentence's own marks.
  const [{ data: markRows }, { data: seenRows }] = await Promise.all([
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
  ]);
  const lastSeen = new Map((seenRows ?? []).map((s) => [s.sentence_id, new Date(s.last_at).getTime()]));
  const candidates = (markRows ?? []).map((m) => {
    const sentence = m.pl_sentences as unknown as Record<string, string> | null;
    return {
      sentenceId: m.sentence_id as string,
      mark: { start: m.start_index as number, end: m.end_index as number },
      extra: (m.extra as number | null) ?? null,
      length: sentenceLength(sentence?.[target] ?? "", target),
      lastSeen: lastSeen.get(m.sentence_id as string) ?? null,
    };
  });
  const chosen = rainOrder(candidates).slice(0, CLUSTER_SIZE);

  const chosenIds = chosen.map((c) => c.sentenceId);
  const [{ data: rows }, { data: glossRows }, words] = await Promise.all([
    supabase.from("pl_sentences").select("id, ja, en, ko, zh, zh_pinyin").in("id", chosenIds),
    supabase.from("pl_sentence_patterns").select("sentence_id, start_index, end_index").in("sentence_id", chosenIds).eq("lang", native),
    memoWords(userId, target),
  ]);
  const byId = new Map((rows ?? []).map((r) => [String(r.id), r as Record<string, string>]));
  const glossMark = new Map(
    (glossRows ?? []).map((m) => [m.sentence_id as string, { start: m.start_index as number, end: m.end_index as number }]),
  );

  const sentences: ShowerSentence[] = chosen
    .filter((c) => byId.has(c.sentenceId))
    .map((c) => {
      const row = byId.get(c.sentenceId)!;
      const text = row[target];
      return {
        id: c.sentenceId,
        text,
        gloss: row[native],
        reading: readingFor(text, target, row.zh_pinyin),
        audio: sentenceAudio(text, target, c.sentenceId),
        mark: c.mark,
        glossMark: glossMark.get(c.sentenceId) ?? null,
        seenBefore: lastSeen.has(c.sentenceId),
        memoHits: findMemoHits(text, words),
      };
    });
  if (sentences.length < MIN_CLUSTER) return null;

  const fn = (functions ?? []).find((f) => f.id === pattern.function_id);
  const label = ((fn?.label ?? {}) as Record<string, string>)[native] ?? null;
  const lastAt = exposure.get(pattern.id)?.last_at;
  return {
    patternId: pattern.id,
    label,
    again: exposure.has(pattern.id),
    againDays: lastAt ? Math.floor((now - new Date(lastAt).getTime()) / 86_400_000) : null,
    sentences,
  };
}

/** How many rains (clusters) the learner has bathed in, in this language: every bath counts once for its pattern. */
function rainsIn(patterns: { id: string }[], exposures: { pattern_id: string; times: number }[]): number {
  const ids = new Set(patterns.map((p) => p.id));
  return exposures.reduce((n, e) => n + (ids.has(e.pattern_id) ? (e.times ?? 0) : 0), 0);
}

/** Remember a finished cluster: when the pattern returns, which sentences were seen, which memo words were met. */
export async function recordCluster(userId: string, target: Lang, patternId: string, sentenceIds: string[]) {
  const { supabase } = await getSession();
  const ids = sentenceIds.slice(0, CLUSTER_SIZE);
  const nowIso = new Date().toISOString();

  const [{ data: patterns }, { data: exposures }, { data: seenRows }, { data: rows }, { data: words }] = await Promise.all([
    supabase.from("pl_patterns").select("id").eq("lang", target),
    supabase.from("pl_exposures").select("pattern_id, times").eq("user_id", userId),
    supabase.from("pl_seen").select("sentence_id, times").eq("user_id", userId).in("sentence_id", ids),
    supabase.from("pl_sentences").select(`id, ${target}`).in("id", ids),
    supabase.from("pl_words").select("id, text, encounters").eq("user_id", userId).eq("lang", target),
  ]);

  const exposure = (exposures ?? []).find((e) => e.pattern_id === patternId);
  const times = (exposure?.times ?? 0) + 1;
  const rains = rainsIn(patterns ?? [], exposures ?? []) + 1; // counting this one
  const seen = new Map((seenRows ?? []).map((s) => [s.sentence_id, s.times as number]));
  const texts = (rows ?? []).map((r) => String((r as Record<string, unknown>)[target] ?? ""));

  const writes: PromiseLike<unknown>[] = [
    supabase.from("pl_exposures").upsert({
      user_id: userId,
      pattern_id: patternId,
      times,
      last_at: nowIso,
      next_at: nextReturn(times),
      return_after: returnAfterRain(times, rains),
    }),
    supabase.from("pl_seen").upsert(
      (rows ?? []).map((r) => ({
        user_id: userId,
        sentence_id: r.id,
        times: (seen.get(r.id) ?? 0) + 1,
        last_at: nowIso,
      })),
    ),
  ];
  for (const w of words ?? []) {
    const met = texts.filter((t) => findMemoHits(t, [String(w.text)]).length > 0).length;
    if (met > 0) {
      writes.push(
        supabase
          .from("pl_words")
          .update({ encounters: (w.encounters as number) + met, last_seen_at: nowIso, last_met_at: nowIso })
          .eq("id", w.id),
      );
    }
  }
  // The day's record for 自分 (pl_rain_days), counted per pattern.
  writes.push(supabase.rpc("pl_log_rain", { p_pattern: patternId, p_source: "library", p_first: times === 1 }));
  await Promise.all(writes);
}

/** Other approved sentences that contain a word, for the word sheet. */
export async function sentencesWith(word: string, target: Lang, native: Lang, excludeId: string | null) {
  const { supabase } = await getSession();
  const needle = word.replace(/[%_\\]/g, (c) => `\\${c}`);
  let query = supabase
    .from("pl_sentences")
    .select("id, ja, en, ko, zh, zh_pinyin")
    .ilike(target, `%${needle}%`)
    .limit(6);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;
  return (data ?? []).slice(0, 5).map((r) => {
    const row = r as Record<string, string>;
    const text = row[target];
    return {
      id: String(r.id),
      text,
      gloss: row[native],
      reading: readingFor(text, target, row.zh_pinyin),
      audio: sentenceAudio(text, target, String(r.id)),
      hits: findMemoHits(text, [word]),
    };
  });
}
