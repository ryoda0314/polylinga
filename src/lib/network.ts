import "server-only";
import type { CorrectionResult } from "@/lib/ai";
import { getSession } from "@/lib/auth";
import { approvedPatterns, functionLabels } from "@/lib/corpus";
import type { Lang } from "@/lib/langs";
import { buildNetwork, type NetMark, type NetPiece, type Network, type SaidSentence, type SeenSentence } from "@/lib/network-core";

/** The sentences the web is grown from: the ones bathed in most lately (a long `in` list would not fit a request). */
const RECENT_SENTENCES = 150;
/** Points kept, so the web stays readable on a phone. */
const MAX_NODES = 48;

/** The browser-side split, for a sentence 語のまとまり has not reached yet: each word its own dictionary form. */
function roughPieces(text: string, lang: Lang): NetPiece[] {
  try {
    return [...new Intl.Segmenter(lang, { granularity: "word" }).segment(text)]
      .filter((s) => s.isWordLike)
      .map((s) => ({ start: s.index, end: s.index + s.segment.length, base: s.segment, kind: "word" as const, meaning: null }));
  } catch {
    return [];
  }
}

/**
 * ことばの網 for 自分: the words and ways of saying of the sentences the learner bathed in, in this language, joined where
 * they came together, and solid where the learner has said them. Only sentences of rains they had in this language
 * count (pl_seen is shared by every language a learner has studied).
 */
export async function loadNetwork(userId: string, target: Lang, native: Lang): Promise<Network> {
  const { supabase } = await getSession();
  const [{ data: seenRows }, { data: exposures }, { data: wordExposures }, { data: corrections }, patterns, labels] = await Promise.all([
    supabase.from("pl_seen").select("sentence_id, times, last_at").eq("user_id", userId).order("last_at", { ascending: false }).limit(RECENT_SENTENCES),
    supabase.from("pl_exposures").select("pattern_id").eq("user_id", userId),
    supabase.from("pl_word_exposures").select("base").eq("user_id", userId).eq("lang", target),
    supabase
      .from("pl_corrections")
      .select("corrected, result")
      .eq("user_id", userId)
      .eq("target_lang", target)
      .order("created_at", { ascending: false })
      .limit(200),
    approvedPatterns(target),
    functionLabels(),
  ]);
  const ids = (seenRows ?? []).map((r) => String(r.sentence_id));
  if (ids.length === 0) return { nodes: [], edges: [], sentences: [] };

  const [{ data: sentenceRows }, { data: markRows }, { data: partRows }] = await Promise.all([
    supabase.from("pl_sentences").select(`id, ${target}, ${native}`).in("id", ids),
    supabase.from("pl_sentence_patterns").select("sentence_id, pattern_id, start_index, end_index").eq("lang", target).in("sentence_id", ids),
    supabase
      .from("pl_sentence_parts")
      .select("sentence_id, idx, start_index, end_index, base, kind, meaning")
      .eq("lang", target)
      .in("sentence_id", ids)
      .order("idx")
      .limit(3000),
  ]);

  // The ways of saying the learner has bathed in, in this language, with what each does in their own words.
  const bathed = new Set((exposures ?? []).map((e) => String(e.pattern_id)));
  const forms = new Map<string, string | null>();
  for (const p of patterns) if (bathed.has(p.id)) forms.set(p.id, labels.get(p.functionId)?.[native] ?? null);
  const words = new Set((wordExposures ?? []).map((w) => String(w.base).toLowerCase()));

  const marks = new Map<string, NetMark[]>();
  for (const m of markRows ?? []) {
    const id = String(m.sentence_id);
    marks.set(id, [...(marks.get(id) ?? []), { patternId: String(m.pattern_id), start: m.start_index as number, end: m.end_index as number }]);
  }
  const pieces = new Map<string, NetPiece[]>();
  for (const p of partRows ?? []) {
    const id = String(p.sentence_id);
    const meaning = (p.meaning as Record<string, string> | null)?.[native] ?? null;
    pieces.set(id, [
      ...(pieces.get(id) ?? []),
      { start: p.start_index as number, end: p.end_index as number, base: String(p.base), kind: p.kind === "function" ? "function" : "word", meaning },
    ]);
  }
  const rows = new Map((sentenceRows ?? []).map((r) => [String(r.id), r as Record<string, unknown>]));
  const seen: SeenSentence[] = [];
  for (const r of seenRows ?? []) {
    const id = String(r.sentence_id);
    const row = rows.get(id);
    if (!row) continue;
    const text = String(row[target] ?? "");
    const own = pieces.get(id) ?? roughPieces(text, target);
    // A sentence of this language's rains: of a way of saying bathed in here, or carrying a word of ことばの雨 here.
    const ofHere = (marks.get(id) ?? []).some((m) => bathed.has(m.patternId)) || own.some((p) => words.has(p.base.toLowerCase()));
    if (!ofHere) continue;
    seen.push({
      id,
      text,
      gloss: String(row[native] ?? ""),
      pieces: own,
      marks: marks.get(id) ?? [],
      times: (r.times as number) ?? 1,
      lastAt: new Date(r.last_at as string).getTime(),
    });
  }
  const said: SaidSentence[] = (corrections ?? []).map((c) => ({
    text: String(c.corrected ?? ""),
    patternIds: ((c.result as Partial<CorrectionResult> | null)?.patterns ?? []).map((p) => p.id),
  }));
  return buildNetwork(seen, said, forms, { now: Date.now(), maxNodes: MAX_NODES });
}
