import "server-only";
import { getSession } from "@/lib/auth";
import { audioUrl } from "@/lib/audio";
import type { CorrectionResult } from "@/lib/ai";
import type { Lang } from "@/lib/langs";
import { readingFor } from "@/lib/reading";
import type { ShowerCluster, ShowerSentence } from "@/lib/shower";
import { findMemoHits } from "@/lib/shower-core";
import { createAdminClient } from "@/lib/supabase/server";

// みんなの雨: other learners' corrected sentences, raining in clusters by pattern like the library's. Learners who switch
// sharing on send every correction judged safe to share; nobody ever sees who wrote what. All reads and writes go
// through the service role, and nothing that leaves here carries an author.

const CLUSTER_SIZE = 4;
/** A pattern rains here only once this many other learners' sentences have gathered for it. */
export const MIN_MINNA = 4;

/** After a correction: if the learner shares, let the corrected sentence rain under each pattern it uses. */
export async function shareCorrection(args: {
  userId: string;
  correctionId: string;
  target: Lang;
  native: Lang;
  result: CorrectionResult;
}) {
  const { userId, correctionId, target, native, result } = args;
  if (!result.shareable || result.patterns.length === 0) return;
  const admin = createAdminClient();
  const { data: settings } = await admin.from("pl_settings").select("share_rain").eq("user_id", userId).maybeSingle();
  if (!settings?.share_rain) return;
  const spans = await Promise.all(result.patterns.map((p) => narrowToLibraryPart(result.corrected, p, target)));
  const { error } = await admin.from("pl_shared").upsert(
    result.patterns.map((p, i) => ({
      correction_id: correctionId,
      user_id: userId,
      target_lang: target,
      native_lang: native,
      text: result.corrected,
      gloss: result.meaning,
      pattern_id: p.id,
      start_index: spans[i].start,
      end_index: spans[i].end,
    })),
    { onConflict: "correction_id,pattern_id", ignoreDuplicates: true },
  );
  if (error) console.error("[minna] share", error.message);
}

/**
 * The part to light in a shared sentence. The correction sometimes marks the words around a pattern too (要不要一起去…);
 * where the pattern's usual part from the library sits inside that, light only it, as the library's own sentences do.
 */
async function narrowToLibraryPart(text: string, p: { id: string; start: number; end: number }, target: Lang) {
  const admin = createAdminClient();
  const { data: marks } = await admin
    .from("pl_sentence_patterns")
    .select("sentence_id, start_index, end_index")
    .eq("pattern_id", p.id)
    .eq("lang", target)
    .limit(30);
  if (!marks?.length) return { start: p.start, end: p.end };
  const { data: rows } = await admin.from("pl_sentences").select(`id, ${target}`).in("id", marks.map((m) => m.sentence_id));
  const textOf = new Map((rows ?? []).map((r) => [String((r as Record<string, unknown>).id), String((r as Record<string, unknown>)[target] ?? "")]));
  const counts = new Map<string, number>();
  for (const m of marks) {
    const part = (textOf.get(m.sentence_id) ?? "").slice(m.start_index, m.end_index).trim();
    if (part) counts.set(part, (counts.get(part) ?? 0) + 1);
  }
  const marked = text.slice(p.start, p.end);
  // the most common library part that occurs within what the correction marked
  const best = [...counts.entries()].filter(([part]) => marked.includes(part)).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0];
  if (!best) return { start: p.start, end: p.end };
  const start = p.start + marked.indexOf(best[0]);
  return { start, end: start + best[0].length };
}

/** The next cluster of other learners' sentences, patterns the learner has met first, sentences they have not seen first. */
export async function pickMinnaCluster(
  userId: string,
  target: Lang,
  native: Lang,
  avoidPatternId: string | null,
): Promise<ShowerCluster | null> {
  const admin = createAdminClient();
  const { supabase } = await getSession();
  const [{ data: counts }, { data: exposures }, { data: seenRows }] = await Promise.all([
    admin.rpc("pl_shared_counts", { target, viewer: userId }),
    supabase.from("pl_exposures").select("pattern_id").eq("user_id", userId),
    admin.from("pl_shared_seen").select("shared_id").eq("user_id", userId),
  ]);
  const met = new Set((exposures ?? []).map((e) => e.pattern_id as string));
  const candidates = ((counts ?? []) as { pattern_id: string; n: number }[])
    .filter((c) => Number(c.n) >= MIN_MINNA && c.pattern_id !== avoidPatternId)
    .map((c) => ({ id: c.pattern_id, met: met.has(c.pattern_id), shuffle: Math.random() }))
    .sort((a, b) => Number(b.met) - Number(a.met) || a.shuffle - b.shuffle);
  if (candidates.length === 0) return null;
  const seen = new Set((seenRows ?? []).map((s) => s.shared_id as string));

  // Try patterns in order until one has enough sentences the learner has not seen; otherwise take the first anyway.
  let patternId = candidates[0].id;
  let rows: { id: string; text: string; gloss: string; start_index: number; end_index: number }[] = [];
  for (const c of candidates.slice(0, 6)) {
    const { data } = await admin
      .from("pl_shared")
      .select("id, text, gloss, start_index, end_index")
      .eq("pattern_id", c.id)
      .eq("target_lang", target)
      .eq("status", "live")
      .neq("user_id", userId)
      .limit(200);
    const list = (data ?? []).map((r) => ({ ...r, unseen: !seen.has(r.id), shuffle: Math.random() }));
    if (rows.length === 0 || list.filter((r) => r.unseen).length >= CLUSTER_SIZE) {
      patternId = c.id;
      rows = list.sort((a, b) => Number(b.unseen) - Number(a.unseen) || a.shuffle - b.shuffle);
      if (list.filter((r) => r.unseen).length >= CLUSTER_SIZE) break;
    }
  }
  // The same sentence can be shared twice (two corrections came out alike): rain it once.
  const chosen: typeof rows = [];
  for (const r of rows) {
    if (!chosen.some((c) => c.text === r.text)) chosen.push(r);
    if (chosen.length === CLUSTER_SIZE) break;
  }
  if (chosen.length < 2) return null;

  const [{ data: pattern }, { data: words }] = await Promise.all([
    supabase.from("pl_patterns").select("function_id").eq("id", patternId).maybeSingle(),
    supabase.from("pl_words").select("text").eq("user_id", userId).eq("lang", target),
  ]);
  const { data: fn } = pattern?.function_id
    ? await supabase.from("pl_functions").select("label").eq("id", pattern.function_id).maybeSingle()
    : { data: null };
  const memo = (words ?? []).map((w) => String(w.text));

  const sentences: ShowerSentence[] = chosen.map((r) => ({
    id: r.id,
    text: r.text,
    gloss: r.gloss,
    reading: readingFor(r.text, target, null),
    audio: { src: audioUrl(r.text, target), fallback: `/api/tts?shared=${r.id}` },
    mark: { start: r.start_index, end: r.end_index },
    glossMark: null,
    seenBefore: seen.has(r.id),
    memoHits: findMemoHits(r.text, memo),
  }));
  return {
    patternId,
    label: ((fn?.label ?? {}) as Record<string, string>)[native] ?? null,
    again: met.has(patternId),
    againDays: null,
    sentences,
    source: "minna",
  };
}

/** Remember which of other learners' sentences this learner has bathed in, and the day's rain for 自分. */
export async function recordMinna(userId: string, patternId: string, sharedIds: string[]) {
  const now = new Date().toISOString();
  const { supabase } = await getSession();
  const [{ error }] = await Promise.all([
    createAdminClient()
      .from("pl_shared_seen")
      .upsert(sharedIds.slice(0, CLUSTER_SIZE).map((id) => ({ user_id: userId, shared_id: id, last_at: now }))),
    supabase.rpc("pl_log_rain", { p_pattern: patternId, p_source: "minna", p_first: false }),
  ]);
  if (error) console.error("[minna] seen", error.message);
}

/** 「これ言いたかった」: the author will hear that their sentence reached someone, never how many. */
export async function heartShared(userId: string, sharedId: string) {
  const admin = createAdminClient();
  const { data: row } = await admin.from("pl_shared").select("user_id, status").eq("id", sharedId).maybeSingle();
  if (!row || row.status !== "live" || row.user_id === userId) return;
  await admin.from("pl_shared_hearts").upsert({ shared_id: sharedId, user_id: userId }, { ignoreDuplicates: true });
}

/** A report hides the sentence at once; a person looks at it later. */
export async function reportShared(userId: string, sharedId: string) {
  const admin = createAdminClient();
  await admin.from("pl_shared_reports").upsert({ shared_id: sharedId, user_id: userId }, { ignoreDuplicates: true });
  await admin.from("pl_shared").update({ status: "hidden" }).eq("id", sharedId);
}

/** Whether one of the learner's sentences has reached someone since they last heard so. */
export async function reachedSomeone(userId: string, since: string | null): Promise<boolean> {
  let query = createAdminClient()
    .from("pl_shared_hearts")
    .select("shared_id, pl_shared!inner(user_id)")
    .eq("pl_shared.user_id", userId)
    .limit(1);
  if (since) query = query.gt("created_at", since);
  const { data } = await query;
  return (data ?? []).length > 0;
}
