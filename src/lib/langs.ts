export const LANGS = ["ja", "en", "ko", "zh"] as const;
export type Lang = (typeof LANGS)[number];

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

/** Each language named in its own script, for pickers. */
export const LANG_NATIVE_NAME: Record<Lang, string> = {
  ja: "日本語",
  en: "English",
  ko: "한국어",
  zh: "中文",
};

/** Language names as used in prompts. */
export const LANG_ENGLISH_NAME: Record<Lang, string> = {
  ja: "Japanese",
  en: "English",
  ko: "Korean",
  zh: "Simplified Chinese (Mandarin)",
};

export const LANG_CODE_LABEL: Record<Lang, string> = {
  ja: "JA",
  en: "EN",
  ko: "KO",
  zh: "ZH",
};

/** BCP-47 locale for speech synthesis. */
export const LANG_LOCALE: Record<Lang, string> = {
  ja: "ja-JP",
  en: "en-US",
  ko: "ko-KR",
  zh: "zh-CN",
};

/** CSS class that switches to the right typeface for a language. */
export function langClass(lang: Lang): string {
  return `t-${lang}`;
}

export const ACCENTS = ["pen", "ink", "pine", "brick"] as const;
export type Accent = (typeof ACCENTS)[number];

export const ACCENT_LABEL: Record<Accent, string> = {
  pen: "ペン",
  ink: "墨",
  pine: "松",
  brick: "煉瓦",
};

export function isAccent(value: unknown): value is Accent {
  return typeof value === "string" && (ACCENTS as readonly string[]).includes(value);
}
