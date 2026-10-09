import "server-only";
import { customPinyin, pinyin } from "pinyin-pro";
import type { Lang } from "@/lib/langs";
import { alignPinyin } from "@/lib/reading-core";
import words from "@/lib/pinyin-words.json";

// Word readings pinyin-pro gets wrong (店长 diàn zhǎng, 睡不着 shuì bu zháo, 朋友 péng you …), learned from the
// checked library pinyin: each reads the same way everywhere in the library, and none makes a library sentence worse.
customPinyin(words);

/**
 * Per-character reading aids, aligned to UTF-16 indexes of `text` ("" where none).
 * Chinese gets pinyin: the checked pinyin stored with a library sentence (`zh_pinyin`) when there is one,
 * otherwise pinyin-pro's reading. Other languages need none for Japanese-speaking learners.
 */
export function readingFor(text: string, lang: Lang, checked?: string | null): string[] | null {
  if (lang !== "zh") return null;
  if (checked) {
    const aligned = alignPinyin(text, checked);
    if (aligned) return aligned;
  }
  const out = new Array<string>(text.length).fill("");
  let offset = 0;
  for (const item of pinyin(text, { type: "all" })) {
    if (item.isZh && item.origin.length === 1) out[offset] = item.pinyin;
    offset += item.origin.length;
  }
  return out;
}
