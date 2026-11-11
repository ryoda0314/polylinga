// Pure helpers for the shower, kept free of imports so tests can load them directly.

export type Span = { start: number; end: number };

/** Days until a pattern returns to the shower, by how many times the learner has bathed in it. */
export const RETURN_DAYS = [1, 3, 7, 14, 30, 60];

export function nextReturn(times: number, now = new Date()): string {
  const days = RETURN_DAYS[Math.min(Math.max(times - 1, 0), RETURN_DAYS.length - 1)];
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

/**
 * Rains (clusters bathed in, in this language) until a pattern returns, by how many times the learner has bathed in it.
 * Someone who bathes a lot meets a new pattern again within the same sitting; the day count above still brings it back
 * to someone who comes once a day. Whichever comes first.
 */
export const RETURN_RAINS = [3, 8, 20, 50, 120];

export function returnAfterRain(times: number, rainsSoFar: number): number {
  return rainsSoFar + RETURN_RAINS[Math.min(Math.max(times - 1, 0), RETURN_RAINS.length - 1)];
}

/** Whether a pattern is due to rain again: its day has come, or enough other rains have fallen since. */
export function isDue(e: { next_at: string | null; return_after: number | null }, rainsSoFar: number, now = Date.now()): boolean {
  if (e.return_after != null && rainsSoFar >= e.return_after) return true;
  return Boolean(e.next_at) && new Date(e.next_at!).getTime() <= now;
}

/** How long a sentence reads, to put shorter ones first: its words, or its characters in Chinese and Japanese. */
export function sentenceLength(text: string, lang: string): number {
  const bare = text.replace(/[\p{P}\p{S}]/gu, " ").trim();
  if (lang === "zh" || lang === "ja") return Array.from(bare.replace(/\s+/g, "")).length;
  return bare.split(/\s+/).filter(Boolean).length;
}

export type RainCandidate = {
  /** What else in the sentence a beginner would not know yet besides its way of saying (0 = plain); null = not judged. */
  extra: number | null;
  length: number;
  /** When the learner last saw it, or null if never. */
  lastSeen: number | null;
  /** It carries a word from the learner's memo. */
  memo?: boolean;
};

/**
 * The order a way of saying's sentences rain in. Ones the learner has not seen come first: the plainest (an unjudged
 * one counts as carrying one other thing), among equally plain ones those with a memo word (so a word typed in comes
 * back in the rain), then the shorter, then by chance. Seen ones follow, longest ago first. So a way of saying is met
 * first in its plainest sentences, and richer ones come as it returns.
 */
export function rainOrder<T extends RainCandidate>(candidates: T[], random: () => number = Math.random): T[] {
  return candidates
    .map((c) => ({ c, chance: random() }))
    .sort((a, b) => {
      if (a.c.lastSeen !== null || b.c.lastSeen !== null) {
        if (a.c.lastSeen === null) return -1;
        if (b.c.lastSeen === null) return 1;
        return a.c.lastSeen - b.c.lastSeen;
      }
      return (
        (a.c.extra ?? 1) - (b.c.extra ?? 1) ||
        Number(Boolean(b.c.memo)) - Number(Boolean(a.c.memo)) ||
        a.c.length - b.c.length ||
        a.chance - b.chance
      );
    })
    .map(({ c }) => c);
}

/** A piece of a sentence (語のまとまり) as far as finding memo words goes: where it is and its dictionary form. */
export type BasedSpan = Span & { base: string };

/**
 * A piece of a library sentence as a learner picks it out: its dictionary form, whether it is a small grammar piece
 * (hard to guess by comparing), what it means in this sentence and its part of the translation, in the learner's
 * language (null where not written yet).
 */
export type SentencePart = BasedSpan & { kind: "word" | "function"; meaning: string | null; gloss: Span | null };

/**
 * Where the learner's memo words are in a sentence: each word's text as typed, and every piece whose dictionary form
 * is a memo word's (so 먹다, picked from 먹을래, is met again in 먹었어). Overlaps keep the earlier, longer span.
 */
export function memoSpans(text: string, parts: BasedSpan[] | null, words: { text: string; base: string | null }[]): Span[] {
  const bases = new Set(words.flatMap((w) => (w.base ? [w.base.toLowerCase()] : [])));
  const all = [
    ...findMemoHits(text, words.map((w) => w.text)),
    ...(parts ?? []).filter((p) => bases.has(p.base.toLowerCase())).map((p) => ({ start: p.start, end: p.end })),
  ].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Span[] = [];
  for (const s of all) if (!out.length || s.start >= out[out.length - 1].end) out.push(s);
  return out;
}

/** What a rain is keyed by in the browser's history and in drafts: its pattern, or for ことばの雨 its word. */
export function rainKey(rain: { patternId: string; word: string | null }): string {
  return rain.word ? `word:${rain.word}` : rain.patternId;
}

/** ことばの雨 falls as every third rain: two of ways of saying, then one of a word, so the two grow together. */
export const WORD_RAIN_EVERY = 3;

/** Whether the next rain is ことばの雨, by how many rains (ways of saying and words) the learner has had so far. */
export function wordRainTurn(rainsSoFar: number): boolean {
  return rainsSoFar % WORD_RAIN_EVERY === WORD_RAIN_EVERY - 1;
}

/** Every place one of the memo words occurs in the text (case-insensitive for Latin script). */
export function findMemoHits(text: string, words: string[]): Span[] {
  const hay = text.toLowerCase();
  const hits: Span[] = [];
  for (const w of words) {
    const needle = w.trim().toLowerCase();
    if (!needle) continue;
    let from = 0;
    for (;;) {
      const at = hay.indexOf(needle, from);
      if (at === -1) break;
      hits.push({ start: at, end: at + needle.length });
      from = at + needle.length;
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

/**
 * Memo stage: はじめて → 前に見た → 使った. Whether its meaning is known is the learner's own guess (note) and whether they
 * could make one (stuck_at), not a stage; the old 意味が分かる mark is no longer asked for.
 */
export function wordStage(w: { encounters: number; uses: number }): "new" | "seen" | "used" {
  if (w.uses > 0) return "used";
  if (w.encounters > 1) return "seen";
  return "new";
}
