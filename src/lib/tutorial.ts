import "server-only";
import { audioUrl } from "@/lib/audio";
import { getSession } from "@/lib/auth";
import { approvedPatterns, functionLabels, loadSentences, type Audio } from "@/lib/corpus";
import { diffRanges, type Range } from "@/lib/diff";
import type { Lang } from "@/lib/langs";
import { readingFor } from "@/lib/reading";

// The hands-on tutorial (/tutorial) walks a new learner once through the loop with real library sentences of one way of
// saying (〜したい: 가고 싶어／먹고 싶어, the easiest to notice on a first day, with nothing else in the sentences): bathe
// in four, notice the shared part, see a sentence of their own corrected and explained word by word, meet the way of
// saying again days later, and choose when to bathe. The "said" sentence is a sample attempt written for the tutorial
// (no AI is called), with the kind of slip learners of that language make.

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

// Library sentences of 〜したい in each language learned (pl_sentences), all of them judged plain (nothing else a
// beginner would not know yet), and the sample attempt. The memo word is in one sentence of each rain. parts: [word,
// its meaning here, its counterpart in the translation].
const PICKS: Partial<Record<Lang, Pick>> = {
  zh: {
    rain: ["我想去韩国。", "我想吃草莓。", "我今晚想打游戏。", "我想喝冰咖啡。"],
    again: ["我今晚想看那部电影。", "我想学吉他。"],
    memo: "今晚",
    say: {
      attempt: "我周末想电影看。",
      corrected: "我周末想看电影。",
      meaning: "週末、映画見たい。",
      explanation: "中国語では「看」（見る）が先で、「电影」（映画）はそのあとに来ます。",
      parts: [["周末", "週末", "週末"], ["想", "〜したい", "たい"], ["看", "見る", "見"], ["电影", "映画", "映画"]],
    },
  },
  ko: {
    rain: ["한국에 가고 싶어.", "딸기 먹고 싶어.", "오늘은 일찍 자고 싶어.", "아이스커피 마시고 싶어."],
    again: ["오늘 밤엔 게임하고 싶어.", "새 신발 사고 싶어."],
    memo: "오늘",
    say: {
      attempt: "주말에 영화 봐고 싶어.",
      corrected: "주말에 영화 보고 싶어.",
      meaning: "週末、映画見たい。",
      explanation: "「보다」の「다」を取った「보」に「고 싶어」を付けて、「보고 싶어」になります。",
      parts: [["주말에", "週末に", "週末"], ["영화", "映画", "映画"], ["보고 싶어", "見たい", "見たい"]],
    },
  },
  en: {
    rain: ["I want to go to Korea.", "I want to eat strawberries.", "I want to play games tonight.", "I want to buy new shoes."],
    again: ["I want to watch that movie tonight.", "I want to learn the guitar."],
    memo: "tonight",
    say: {
      attempt: "I want to see movie this weekend.",
      corrected: "I want to see a movie this weekend.",
      meaning: "週末、映画見たい。",
      explanation: "「movie」の前に「a」を付けます。",
      parts: [["I want to", "〜したい", "たい"], ["see", "見る", "見"], ["a movie", "映画", "映画"], ["this weekend", "今週末", "週末"]],
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
  const pattern = patterns.find((p) => p.functionId === "want");
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
