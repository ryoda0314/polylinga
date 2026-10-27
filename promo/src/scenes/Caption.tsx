// 映像の言葉。アプリの画面の左に：いまどこか（見出し）、短い一文、その下の静かな一文。
// 時が来ると降ってきて、前のものは上がって消える。
import type { ReactNode } from "react";
import { fall, leave, mixColor, prog } from "../anim";
import { C, FONT } from "../theme";
import { Icon, type IconName } from "../ui";

export const CAP = { left: 120, width: 700, kickerTop: 300, mainTop: 372 };
// 見出し：いまどこか（アイコンと名前）。
export const KICKER = { icon: { left: CAP.left, top: 301, size: 34 }, text: { left: CAP.left + 46, top: 300, size: 30 } };

/** 一切れ：ただの字か、色や字体を変えた字（韓国語）。`at`：その字に色が付くコマ（無ければ一文が降りたとき）。 */
export type Part = string | { text: string; color?: string; font?: "ko" | "mincho"; at?: number };
/** いまどこか：使い方の5つ（浴びる・気づく・言ってみる・また出会う・続ける）に、メモと3つの言葉。 */
export type Door = "rain" | "notice" | "memo" | "say" | "again" | "langs" | "habit";
export const DOOR_NAME: Record<Door, string> = {
  rain: "浴びる",
  notice: "気づく",
  memo: "メモ",
  say: "言ってみる",
  again: "また出会う",
  langs: "3つの言葉",
  habit: "続ける",
};
const DOOR_ICON: Record<Door, IconName> = { rain: "shower", notice: "eye", memo: "bookmark", say: "pencil", again: "shower", langs: "globe", habit: "sprout" };
const doorColor = (door: Door) => (door === "again" ? C.again : C.accent);
/** `subAt`：静かな一文が降る時（ふだんは本文のすぐあと）。`more`：その下に置くもの（また出会うの、日が進む帯）。 */
export type Cap = { from: number; door: Door; main: Part[][]; sub?: Part[][]; subAt?: number; more?: (frame: number) => ReactNode };

export function Kicker({ door, style }: { door: Door; style?: React.CSSProperties }) {
  return (
    <>
      <span style={{ position: "absolute", left: KICKER.icon.left, top: KICKER.icon.top, color: doorColor(door), ...style }}>
        <Icon name={DOOR_ICON[door]} size={KICKER.icon.size} stroke={1.7} />
      </span>
      <span
        style={{
          position: "absolute",
          left: KICKER.text.left,
          top: KICKER.text.top,
          fontSize: KICKER.text.size,
          lineHeight: "36px",
          fontWeight: 600,
          color: doorColor(door),
          fontFamily: FONT.ja,
          whiteSpace: "nowrap",
          ...style,
        }}
      >
        {DOOR_NAME[door]}
      </span>
    </>
  );
}

export function Parts({ parts, frame, colorAt }: { parts: Part[]; frame: number; colorAt: number }) {
  return (
    <>
      {parts.map((part, k) => {
        if (typeof part === "string") return <span key={k}>{part}</span>;
        const family = part.font === "ko" ? FONT.ko : part.font === "mincho" ? FONT.mincho : undefined;
        return (
          <span
            key={k}
            style={{
              fontFamily: family,
              fontWeight: part.color || part.font === "mincho" ? (part.font === "mincho" ? 700 : 600) : undefined,
              letterSpacing: part.font === "mincho" ? "0.04em" : undefined,
              color: part.color ? mixColor(C.ink2, part.color, prog(frame, part.at ?? colorAt, 14)) : undefined,
            }}
          >
            {part.text}
          </span>
        );
      })}
    </>
  );
}

/** 一続きの言葉。`from` コマから、次が来るまで。 */
export function Captions({ frame, caps, until }: { frame: number; caps: Cap[]; until: number }) {
  return (
    <>
      {caps.map((c, i) => {
        const next = caps[i + 1]?.from ?? until;
        if (frame < c.from || frame > next + 14) return null;
        const prevDoor = caps[i - 1]?.door;
        const nextDoor = caps[i + 1]?.door;
        // 前の一文が消えて（9 コマ）から、次が降る。二つの文が重ならないように。
        const style = frame >= next ? leave(frame, next, 9, 12) : fall(frame, c.from + 8, 16, 16);
        // 見出しは、同じところの間は残り、変わると入れ替わる。
        const kickerIn = prevDoor === c.door ? { opacity: 1 } : fall(frame, c.from + 8, 10, 12);
        const kickerOut = nextDoor === c.door || !caps[i + 1] ? null : leave(frame, next, 8, 8);
        const kick = frame >= next && kickerOut ? kickerOut : frame >= next ? { opacity: 0 } : kickerIn;
        const subAt = c.subAt ?? c.from + 16;
        return (
          <div key={c.from}>
            <Kicker door={c.door} style={kick} />
            <div style={{ position: "absolute", left: CAP.left, top: CAP.mainTop, width: CAP.width, ...style }}>
              {c.main.map((m, j) => (
                <p key={j} style={{ margin: 0, fontSize: 52, fontWeight: 600, lineHeight: 1.42, letterSpacing: "0.01em", color: C.ink, fontFamily: FONT.ui }}>
                  <Parts parts={m} frame={frame} colorAt={c.from + 8} />
                </p>
              ))}
              {c.sub ? (
                <div style={{ marginTop: 30, ...fall(frame, subAt, 10, 16) }}>
                  {c.sub.map((line, j) => (
                    <p key={j} style={{ margin: 0, fontSize: 27, lineHeight: 1.75, color: C.ink2, fontFamily: FONT.ui }}>
                      <Parts parts={line} frame={frame} colorAt={subAt + 8} />
                    </p>
                  ))}
                </div>
              ) : null}
              {c.more ? c.more(frame) : null}
            </div>
          </div>
        );
      })}
    </>
  );
}
