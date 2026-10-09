export type Range = { start: number; end: number };
export type DiffLang = "ja" | "en" | "ko" | "zh";

type Token = { text: string; start: number };

// English is compared word by word so a changed word is highlighted whole ("go" → "went"),
// the other languages character by character (가을래 → 갈래 shows the one syllable that changed).
function tokenize(text: string, lang: DiffLang): Token[] {
  const tokens: Token[] = [];
  if (lang === "en") {
    for (const m of text.matchAll(/[A-Za-z0-9'’-]+|\s+|[^A-Za-z0-9'’\s-]/g)) {
      tokens.push({ text: m[0], start: m.index ?? 0 });
    }
    return tokens;
  }
  let offset = 0;
  for (const ch of Array.from(text)) {
    tokens.push({ text: ch, start: offset });
    offset += ch.length;
  }
  return tokens;
}

function pushRange(list: Range[], start: number, end: number) {
  const last = list[list.length - 1];
  if (last && last.end === start) last.end = end;
  else list.push({ start, end });
}

/**
 * What was removed from `before` and added in `after`, as UTF-16 ranges into each string.
 * Inputs are single sentences, so the O(n·m) LCS table stays small.
 */
export function diffRanges(before: string, after: string, lang: DiffLang): { removed: Range[]; added: Range[] } {
  const a = tokenize(before, lang);
  const b = tokenize(after, lang);
  const n = a.length;
  const m = b.length;
  const lcs: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i].text === b[j].text ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const removed: Range[] = [];
  const added: Range[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].text === b[j].text) {
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      pushRange(removed, a[i].start, a[i].start + a[i].text.length);
      i++;
    } else {
      pushRange(added, b[j].start, b[j].start + b[j].text.length);
      j++;
    }
  }
  for (; i < n; i++) pushRange(removed, a[i].start, a[i].start + a[i].text.length);
  for (; j < m; j++) pushRange(added, b[j].start, b[j].start + b[j].text.length);

  return { removed: tidy(removed, before), added: tidy(added, after) };
}

// Drop whitespace-only edits and keep surrounding spaces out of the highlight.
function tidy(ranges: Range[], text: string): Range[] {
  const out: Range[] = [];
  for (const r of ranges) {
    let { start, end } = r;
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    if (end > start) out.push({ start, end });
  }
  return out;
}
