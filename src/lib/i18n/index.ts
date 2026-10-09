import type { Lang } from "@/lib/langs";
import { ja, type Dict } from "./ja";

// One dictionary per learner language. Only Japanese speakers are served at launch,
// so every language falls back to Japanese until its file is written and reviewed.
const dictionaries: Partial<Record<Lang, Dict>> = { ja };

export function getDict(lang: Lang): Dict {
  return dictionaries[lang] ?? ja;
}

export type { Dict };
