import { useEffect, useState } from "react";
import { staticFile, useDelayRender } from "remotion";

// ことのあめ の紙と墨と、アクセント（../src/app/globals.css：アイコンから取った色）。紫は、また出会うもの。
export const C = {
  paper: "#fcfbf8",
  surface: "#f1f4f8",
  ink: "#172033",
  ink2: "#3b4558",
  muted: "#5c6578",
  faint: "#8c94a5",
  line: "#e4e7ec",
  line2: "#d4d9e1",
  accent: "#0a64f0",
  tint: "#e6f0ff",
  again: "#6a4fe0",
  againTint: "#efebff",
  // アイコンの雨（飾りだけ：Rain）。
  rainSky: "#4ea7fd",
  rainViolet: "#a792fa",
} as const;

export const FONT = {
  ui: `"PlexJP", "PlexKR", sans-serif`,
  ja: `"PlexJP", sans-serif`,
  ko: `"PlexKR", "PlexJP", sans-serif`,
  zh: `"NotoSC", "PlexJP", sans-serif`,
  en: `"PlexJP", sans-serif`,
  mincho: `"Shippori", serif`,
} as const;

export type Lang = "ko" | "en" | "zh";
export const fontOf = (lang: Lang) => FONT[lang];

// アプリの字。`npm run assets` が public/fonts に置く。
const FACES: [family: string, file: string, weight: string][] = [
  ["PlexJP", "fonts/IBMPlexSansJP-Regular.ttf", "400"],
  ["PlexJP", "fonts/IBMPlexSansJP-Medium.ttf", "500"],
  ["PlexJP", "fonts/IBMPlexSansJP-SemiBold.ttf", "600"],
  ["PlexKR", "fonts/IBMPlexSansKR-Regular.ttf", "400"],
  ["PlexKR", "fonts/IBMPlexSansKR-Medium.ttf", "500"],
  ["PlexKR", "fonts/IBMPlexSansKR-SemiBold.ttf", "600"],
  ["NotoSC", "fonts/NotoSansSC-VF.ttf", "100 900"],
  ["Shippori", "fonts/ShipporiMincho-Bold.ttf", "700"],
];

let loading: Promise<unknown> | null = null;

/** 字が読み終わるまで、どのコマも待たせる（映像の根から呼ぶ）。 */
export function useFonts() {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    loading ??= Promise.all(
      FACES.map(([family, file, weight]) => {
        const face = new FontFace(family, `url(${staticFile(file)})`, { weight });
        document.fonts.add(face);
        return face.load();
      }),
    );
    loading.then(() => continueRender(handle), cancelRender);
  }, [handle, continueRender, cancelRender]);
}
