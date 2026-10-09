/** Han characters get one pinyin syllable each; punctuation, Latin letters and digits get none. */
const HAN = /\p{Script=Han}/u;

export function isHan(ch: string): boolean {
  return HAN.test(ch);
}

/** How many syllables `text` needs: its Han characters, counted the way alignPinyin walks the text. */
export function hanCount(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) if (isHan(text[i])) n++;
  return n;
}

/**
 * Spread checked pinyin ("wǒ zhǐ hē le kā fēi": one syllable per Han character, in order) over the UTF-16
 * indexes of `text`. Returns null when the count does not match, so callers can fall back.
 */
export function alignPinyin(text: string, syllables: string): string[] | null {
  const list = syllables.trim().split(/\s+/).filter(Boolean);
  const out = new Array<string>(text.length).fill("");
  let k = 0;
  for (let i = 0; i < text.length; i++) {
    if (!isHan(text[i])) continue;
    if (k === list.length) return null;
    out[i] = list[k++];
  }
  return k === list.length ? out : null;
}
