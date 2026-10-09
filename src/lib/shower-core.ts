// Pure helpers for the shower, kept free of imports so tests can load them directly.

export type Span = { start: number; end: number };

/** Days until a pattern returns to the shower, by how many times the learner has bathed in it. */
export const RETURN_DAYS = [1, 3, 7, 14, 30, 60];

export function nextReturn(times: number, now = new Date()): string {
  const days = RETURN_DAYS[Math.min(Math.max(times - 1, 0), RETURN_DAYS.length - 1)];
  return new Date(now.getTime() + days * 86_400_000).toISOString();
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

/** Memo stage, from the learner's notes: はじめて → 前に見た → 意味が分かる → 使った. */
export function wordStage(w: { encounters: number; uses: number; understood: boolean }): "new" | "seen" | "understood" | "used" {
  if (w.uses > 0) return "used";
  if (w.understood) return "understood";
  if (w.encounters > 1) return "seen";
  return "new";
}
