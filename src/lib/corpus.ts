import "server-only";
import { cache } from "react";
import { embed } from "@/lib/ai";
import { audioUrl } from "@/lib/audio";
import { getSession } from "@/lib/auth";
import type { Lang } from "@/lib/langs";
import { readingFor } from "@/lib/reading";

// The pattern library: approved 4-language sentence sets and the "かたち" marked in each.
// RLS hides drafts, so every read here sees approved content only.

export type Sentence = { id: string; zhPinyin: string | null } & Record<Lang, string>;
export type Mark = { patternId: string; start: number; end: number };
export type Pattern = {
  id: string;
  lang: Lang;
  form: string;
  meaning: Partial<Record<Lang, string>>;
  examples: string | null;
};

/** Everything a page needs to show one sentence in the learner's target language. */
export type ShownSentence = {
  id: string;
  text: string;
  gloss: string;
  marks: Mark[];
  reading: string[] | null;
  audio: Audio;
};
export type Audio = { src: string; fallback: string | null } | null;

/** Unrelated intents measured around 0.23, related ones 0.45 and up. */
const MIN_SIMILARITY = 0.35;

async function db() {
  return (await getSession()).supabase;
}

function toSentence(row: Record<string, unknown>): Sentence {
  return {
    id: String(row.id),
    ja: String(row.ja),
    en: String(row.en),
    ko: String(row.ko),
    zh: String(row.zh),
    zhPinyin: (row.zh_pinyin as string | null) ?? null,
  };
}

export function sentenceAudio(text: string, lang: Lang, sentenceId: string): Audio {
  return { src: audioUrl(text, lang), fallback: `/api/tts?sentence=${sentenceId}&lang=${lang}` };
}

function show(sentence: Sentence, marks: Mark[], target: Lang, native: Lang): ShownSentence {
  const text = sentence[target];
  return {
    id: sentence.id,
    text,
    gloss: sentence[native],
    marks,
    reading: readingFor(text, target, sentence.zhPinyin),
    audio: sentenceAudio(text, target, sentence.id),
  };
}

/** Closest approved sentences to an intent, searched in the learner's own language. */
export async function searchCorpus(intent: string, nativeLang: Lang) {
  const vector = await embed(intent);
  const { data, error } = await (await db()).rpc("pl_match_sentences", {
    query_embedding: vector,
    query_lang: nativeLang,
    match_count: 3,
  });
  if (error) throw error;
  return ((data ?? []) as { sentence_id: string; similarity: number }[])
    .filter((m) => m.similarity >= MIN_SIMILARITY)
    .map((m) => ({ sentence_id: m.sentence_id, similarity: Math.round(m.similarity * 1000) / 1000 }));
}

/** Sentences by id, in the given order, with their marks in the target language. */
export async function loadSentences(ids: string[], target: Lang, native: Lang): Promise<ShownSentence[]> {
  if (ids.length === 0) return [];
  const supabase = await db();
  const [{ data: rows }, { data: markRows }] = await Promise.all([
    supabase.from("pl_sentences").select("id, ja, en, ko, zh, zh_pinyin").in("id", ids),
    supabase
      .from("pl_sentence_patterns")
      .select("sentence_id, pattern_id, start_index, end_index")
      .in("sentence_id", ids)
      .eq("lang", target),
  ]);
  const byId = new Map((rows ?? []).map((r) => [String(r.id), toSentence(r)]));
  const marks = new Map<string, Mark[]>();
  for (const r of markRows ?? []) {
    const list = marks.get(r.sentence_id) ?? [];
    list.push({ patternId: r.pattern_id, start: r.start_index, end: r.end_index });
    marks.set(r.sentence_id, list);
  }
  return ids.filter((id) => byId.has(id)).map((id) => show(byId.get(id)!, marks.get(id) ?? [], target, native));
}

export const approvedPatterns = cache(async (lang: Lang): Promise<Pattern[]> => {
  const { data } = await (await db())
    .from("pl_patterns")
    .select("id, lang, form, meaning, examples, function_id")
    .eq("lang", lang)
    .order("id");
  return (data ?? []).map((r) => ({
    id: String(r.id),
    lang: r.lang as Lang,
    form: String(r.form),
    meaning: (r.meaning ?? {}) as Pattern["meaning"],
    examples: (r.examples as string | null) ?? null,
  }));
});

/** Up to `per` approved example sentences for each pattern, skipping the ones in `exclude`. */
export async function patternExamples(
  patternIds: string[],
  target: Lang,
  native: Lang,
  per = 3,
  exclude: string[] = [],
): Promise<Map<string, ShownSentence[]>> {
  const result = new Map<string, ShownSentence[]>();
  if (patternIds.length === 0) return result;
  const { data: markRows } = await (await db())
    .from("pl_sentence_patterns")
    .select("sentence_id, pattern_id")
    .in("pattern_id", patternIds)
    .eq("lang", target)
    .order("sentence_id");

  const chosen = new Map<string, string[]>();
  for (const r of markRows ?? []) {
    if (exclude.includes(r.sentence_id)) continue;
    const list = chosen.get(r.pattern_id) ?? [];
    if (list.length < per) list.push(r.sentence_id);
    chosen.set(r.pattern_id, list);
  }
  const shown = await loadSentences([...new Set([...chosen.values()].flat())], target, native);
  const byId = new Map(shown.map((s) => [s.id, s]));
  for (const id of patternIds) {
    result.set(
      id,
      (chosen.get(id) ?? []).map((sid) => byId.get(sid)).filter((s): s is ShownSentence => !!s),
    );
  }
  return result;
}
