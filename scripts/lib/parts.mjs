// 語のまとまり: how library sentences are split into the pieces a learner picks out and memo, shared by
// prepare-parts.mjs (which writes the rules into every batch), check-parts.mjs and, later, the step that stores them.

const COMMON = [
  "Split each sentence into the pieces a Japanese-speaking beginner would pick out to look up or note down, in order, covering every word and leaving out punctuation and spaces. Each piece's text is an exact substring of the sentence.",
  '"base" is its dictionary form.',
  '"meaning" says in Japanese what the piece itself means in this sentence, in a few plain words with no grammar terms (no part-of-speech or tense names). Take it from the piece, not from a loose translation: 고기 is 肉 even when the translation says 焼肉. For a piece that only adds a feeling or a small function, say it plainly (〜に, 〜も, 〜した, 〜？).',
  '"gloss" is the exact substring of the Japanese translation that expresses this very piece, and only it. A Japanese word may be cut where its parts carry different pieces: 食べ | たい for 먹고 | 싶어, 聴 | こう for listen … Let\'s, 食べ | ないで for eat … Don\'t. When the translation says it another way or leaves it out, "" — never a word that does something else (에 is not the は of 週末は).',
  '"kind" is "function" for a particle, an ending or a small grammar word whose meaning is hard to guess by comparing sentences (에, 도, 了, 吗, the, to), and "word" for everything else.',
];

export const RULES = {
  ko: [
    ...COMMON,
    "Separate a particle from the word before it (집 | 에, 헬스장 | 도, 지금 | 이, 친구 | 를). Its base is the particle as written.",
    "Keep a verb or adjective together with its ending as one part (먹을래, 봤어, 중요해), its base the dictionary form (먹다, 보다, 중요하다). A verb written apart from the verb it helps stays its own part (알려 | 줄래 → 알리다, 주다).",
    "Keep a set phrase together when its words mean little apart (고마워, 괜찮아). Never split inside a syllable block.",
  ],
  zh: [
    ...COMMON,
    "Split into words as a dictionary lists them: 我 | 还 | 没 | 睡, 那 | 部 | 电影, 好多 | 人, 冰淇淋. A measure word and a particle (了, 过, 吗, 吧, 的) are parts of their own.",
    "The base is the word itself (Chinese words do not change form).",
  ],
  en: [
    ...COMMON,
    "Keep together a phrasal verb or a fixed expression that means one thing as a whole (stay up, hang up, go for a walk, grab a drink, ice cream, a little, right now, of course), and a contraction (don't, I'm, Let's). Otherwise one word per part.",
    "Never group a preposition or an article with the words after it: at | the | station, on | my | phone | too, in | the | fridge, How | was. A phrasal verb split by its object becomes separate parts (pick | me | up), the verb's base being the whole phrasal verb (pick up).",
    "The base is the dictionary form (saw → see, pictures → picture, better → good); for a contraction, its full form (don't → do not).",
  ],
};

/** The answer a batch expects in <batch>.out.json, as the batch file states it. */
export const ANSWER = '[{ "n": <item number>, "parts": [{ "text": "", "base": "", "meaning": "", "gloss": "", "kind": "word" | "function" }] }]';

/** First place of `needle` in `hay` that no taken range overlaps. */
function freeIndexOf(hay, needle, taken) {
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + 1)) {
    if (!taken.some((r) => at < r.end && at + needle.length > r.start)) return at;
  }
  return -1;
}

/**
 * Place an answer's parts in the sentence in order and their glosses in the translation, and say what does not fit:
 * a part not in the sentence, words skipped or left over, a gloss not in the translation, an empty base or meaning.
 */
export function place(item, rawParts) {
  const problems = [];
  const parts = [];
  const glossTaken = [];
  let from = 0;
  for (const p of rawParts ?? []) {
    const text = String(p.text ?? "").trim();
    const at = text ? item.text.indexOf(text, from) : -1;
    if (at === -1) {
      problems.push(`not in the sentence: ${text}`);
      continue;
    }
    if (item.text.slice(from, at).replace(/[\p{P}\p{S}\s]/gu, "")) problems.push(`skipped: ${item.text.slice(from, at)}`);
    from = at + text.length;
    const base = String(p.base ?? "").trim();
    const meaning = String(p.meaning ?? "").trim();
    if (!base || !meaning) problems.push(`no base or meaning: ${text}`);
    const g = String(p.gloss ?? "").trim();
    const gAt = g ? freeIndexOf(item.ja, g, glossTaken) : -1;
    const gloss = gAt === -1 ? null : { start: gAt, end: gAt + g.length };
    if (gloss) glossTaken.push(gloss);
    else if (g) problems.push(`gloss not in the translation: ${g}`);
    parts.push({ text, start: at, end: at + text.length, base, meaning, gloss, kind: p.kind === "function" ? "function" : "word" });
  }
  if (item.text.slice(from).replace(/[\p{P}\p{S}\s]/gu, "")) problems.push(`left over: ${item.text.slice(from)}`);
  return { parts, problems };
}

/** A batch with its answer, for reading: each piece with its base, its meaning here and its part of the translation. */
export function markdown(title, items) {
  const lines = [`# ${title}（${items.length}文）`, "", "各行：まとまり（元の形）この文での意味 ←訳の中の対応　［部品］は比べても意味をつかみにくいもの", ""];
  items.forEach((item) => {
    lines.push(`## ${item.n}. ${item.text}`, item.ja, "");
    for (const p of item.parts ?? []) {
      const base = p.base && p.base !== p.text ? `（${p.base}）` : "";
      const gloss = p.gloss ? ` ←「${item.ja.slice(p.gloss.start, p.gloss.end)}」` : "";
      lines.push(`- **${p.text}**${base} ${p.meaning}${gloss}${p.kind === "function" ? "　［部品］" : ""}`);
    }
    if (item.problems?.length) lines.push(`- ⚠ ${item.problems.join(" / ")}`);
    if (!item.parts) lines.push("- ⚠ まだ答えがありません");
    lines.push("");
  });
  return lines.join("\n");
}
