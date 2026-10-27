// 名前：アプリのアイコンと、明朝の ことのあめ。一字ずつ降ってくる。下に一行。
import type { ReactNode } from "react";
import { Img, staticFile } from "remotion";
import { fall, prog } from "../anim";
import { C, FONT } from "../theme";

const kana = (s: string) => <span style={{ fontFamily: FONT.mincho, fontWeight: 700, letterSpacing: "0.04em" }}>{s}</span>;

/** はじめの頁（../src/app/page.tsx）の大見出し。言の葉・言の雨は明朝で。 */
export const TAGLINE = (
  <>
    {kana("言の葉")}は、{kana("言の雨")}に育まれる。
  </>
);

export function NameMark({
  frame,
  icon,
  word,
  lead,
  line,
  size,
  top,
  wordSize,
  leadSize,
}: {
  frame: number;
  icon: number;
  word: number;
  lead: number;
  line: ReactNode;
  size: number;
  top: number;
  wordSize: number;
  leadSize: number;
}) {
  const shown = prog(frame, icon, 15);
  return (
    <>
      <div style={{ position: "absolute", left: 960 - size / 2, top, width: size, height: size, opacity: shown, transform: `scale(${0.96 + 0.04 * shown})` }}>
        <Img src={staticFile("app/icon.png")} style={{ width: size, height: size }} />
      </div>
      <p
        style={{
          position: "absolute",
          top: top + size + wordSize * 0.42,
          left: 0,
          right: 0,
          margin: 0,
          textAlign: "center",
          fontFamily: FONT.mincho,
          fontWeight: 700,
          fontSize: wordSize,
          letterSpacing: "0.06em",
          lineHeight: 1.2,
          color: C.ink,
        }}
      >
        {[..."ことのあめ"].map((ch, i) => (
          <span key={i} style={{ display: "inline-block", ...fall(frame, word + i * 3, wordSize * 0.18, 16) }}>
            {ch}
          </span>
        ))}
      </p>
      <p
        style={{
          position: "absolute",
          top: top + size + wordSize * 1.95,
          left: 0,
          right: 0,
          margin: 0,
          textAlign: "center",
          fontFamily: FONT.ja,
          fontWeight: 600,
          fontSize: leadSize,
          lineHeight: 1.45,
          color: C.ink,
          ...fall(frame, lead, 14, 18),
        }}
      >
        {line}
      </p>
    </>
  );
}
