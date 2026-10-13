import "server-only";
import { audioUrl } from "@/lib/audio";
import { getSession } from "@/lib/auth";
import { approvedPatterns, functionLabels, loadSentences, type Audio } from "@/lib/corpus";
import { diffRanges, type Range } from "@/lib/diff";
import type { Lang } from "@/lib/langs";
import { readingFor } from "@/lib/reading";

// The hands-on tutorial (/tutorial) walks a new learner once through the loop with real library sentences of one way of
// saying (誘う): bathe in four, notice the shared part, see a sentence of their own corrected and explained word by word,
// meet the way of saying again days later, and choose when to bathe. The "said" sentence is a sample attempt written for
// the tutorial (no AI is called), with the kind of slip learners of that language make.

export type TutorialSentence = {
  id: string;
  text: string;
  gloss: string;
  reading: string[] | null;
  audio: Audio;
  mark: Range | null;
  glossMark: Range | null;
};

export type TutorialSay = {
  intent: string;
  attempt: string;
  corrected: string;
  reading: string[] | null;
  meaning: string;
  removed: Range[];
  added: Range[];
  explanation: string;
  parts: { start: number; end: number; meaning: string; gloss: Range | null }[];
  audio: Audio;
};

export type TutorialData = {
  label: string;
  rain: TutorialSentence[];
  again: TutorialSentence[];
  /** A word shown as if the learner had typed it into the memo: it comes back dotted in the later rain. */
  memo: string;
  say: TutorialSay;
};

type Pick = {
  rain: string[];
  again: string[];
  memo: string;
  say: { attempt: string; corrected: string; meaning: string; explanation: string; parts: [string, string, string][] };
};

// Library sentences of 誘う in each language learned (pl_sentences), and the sample attempt. parts: [word, its meaning
// here, its counterpart in the translation].
const PICKS: Partial<Record<Lang, Pick>> = {
  zh: {
    rain: ["周末要不要看电影？", "明天要不要去咖啡厅？", "今晚要不要吃拉面？", "今天要不要去唱歌？"],
    again: ["周末要不要去海边？", "要不要去看烟花？"],
    memo: "周末",
    say: {
      attempt: "周末要不要看去电影？",
      corrected: "周末要不要去看电影？",
      meaning: "週末、映画見に行かない？",
      explanation: "「去」（行く）を「看」（見る）の前に置くと、「見に行く」になります。",
      parts: [["周末", "週末", "週末"], ["要不要", "〜しない？（誘い）", "ない？"], ["去", "行く", "行か"], ["看", "見る", "見に"], ["电影", "映画", "映画"]],
    },
  },
  ko: {
    rain: ["내일 카페 갈래?", "주말에 영화 볼래?", "같이 밥 먹을래?", "오늘 노래방 갈래?"],
    again: ["주말에 바다 갈래?", "불꽃놀이 보러 갈래?"],
    memo: "주말",
    say: {
      attempt: "주말에 영화 보러 가을래?",
      corrected: "주말에 영화 보러 갈래?",
      meaning: "週末、映画見に行かない？",
      explanation: "「가다」には「을래」ではなく「ㄹ래」が付いて、「갈래」になります。",
      parts: [["주말에", "週末に", "週末"], ["영화", "映画", "映画"], ["보러", "見に", "見に"], ["갈래", "行かない？（誘い）", "行かない？"]],
    },
  },
  en: {
    rain: ["Wanna grab ramen tonight?", "Wanna go to a café tomorrow?", "Wanna go to karaoke today?", "Wanna go see the fireworks?"],
    again: ["Wanna go to the beach this weekend?", "Wanna play games together tonight?"],
    memo: "tonight",
    say: {
      attempt: "Wanna see movie this weekend?",
      corrected: "Wanna see a movie this weekend?",
      meaning: "週末、映画見に行かない？",
      explanation: "「movie」の前に「a」を付けます。",
      parts: [["Wanna", "〜しない？（誘い）", "ない？"], ["see", "見る", "見に"], ["a movie", "映画", "映画"], ["this weekend", "今週末", "週末"]],
    },
  },
};

/** Where `part` sits in `text` at or after `from`, or null. */
function place(text: string, part: string, from = 0): Range | null {
  const at = text.indexOf(part, from);
  return at === -1 ? null : { start: at, end: at + part.length };
}

export async function tutorialData(target: Lang, native: Lang): Promise<TutorialData | null> {
  const pick = PICKS[target];
  if (!pick) return null;
  const { supabase } = await getSession();
  const [patterns, labels, { data: rows }] = await Promise.all([
    approvedPatterns(target),
    functionLabels(),
    supabase.from("pl_sentences").select(`id, ${target}`).in(target, [...pick.rain, ...pick.again]),
  ]);
  const pattern = patterns.find((p) => p.functionId === "invite");
  if (!pattern) return null;
  const idOf = new Map((rows ?? []).map((r) => [String((r as Record<string, unknown>)[target]), String(r.id)]));
  const ids = [...pick.rain, ...pick.again].map((text) => idOf.get(text)).filter((id): id is string => Boolean(id));
  const shown = new Map((await loadSentences(ids, target, native)).map((s) => [s.text, s]));
  const sentence = (text: string): TutorialSentence | null => {
    const s = shown.get(text);
    if (!s) return null;
    const mark = s.marks.find((m) => m.patternId === pattern.id) ?? null;
    return {
      id: s.id,
      text: s.text,
      gloss: s.gloss,
      reading: s.reading,
      audio: s.audio,
      mark: mark ? { start: mark.start, end: mark.end } : null,
      glossMark: s.glossMarks[0] ? { start: s.glossMarks[0].start, end: s.glossMarks[0].end } : null,
    };
  };
  const rain = pick.rain.map(sentence).filter((s): s is TutorialSentence => s !== null);
  const again = pick.again.map(sentence).filter((s): s is TutorialSentence => s !== null);
  if (rain.length < 2 || again.length < 1) return null;

  const { attempt, corrected, meaning, explanation } = pick.say;
  const { removed, added } = diffRanges(attempt, corrected, target);
  let from = 0;
  const parts = pick.say.parts.flatMap(([word, sense, gloss]) => {
    const at = place(corrected, word, from);
    if (!at) return [];
    from = at.end;
    return [{ ...at, meaning: sense, gloss: place(meaning, gloss) }];
  });
  return {
    label: labels.get(pattern.functionId)?.[native] ?? "",
    rain,
    again,
    memo: pick.memo,
    say: {
      intent: meaning,
      attempt,
      corrected,
      reading: readingFor(corrected, target),
      meaning,
      removed,
      added,
      explanation,
      parts,
      audio: { src: audioUrl(corrected, target), fallback: null },
    },
  };
}
