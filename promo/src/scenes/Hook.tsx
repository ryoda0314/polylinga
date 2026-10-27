// A. 問い：「分かる」と「できる」のあいだを埋める（はじめの頁の帯の見出し）。似た文が雨のように降ってきて、共通している
// ところに、文と訳の両方で色が付く（ライブラリの文と、その印）。声はナレーションだけ：ここの文は鳴らさない。
import { fall, leave, prog, rainFall } from "../anim";
import LIB from "../library.json";
import { T } from "../timeline";
import { C, FONT } from "../theme";
import { Rain, Sent } from "../ui";

const ROWS = ["rain1", "rain3", "rain4"].map((k) => LIB.rain.find((s) => s.key === k)!);
const caption = { position: "absolute", left: 0, right: 0, margin: 0, textAlign: "center", fontFamily: FONT.ui, fontWeight: 600, color: C.ink } as const;

export function Hook({ frame }: { frame: number }) {
  const h = T.hook;
  const falls = [h.s1, h.s2, h.s3];
  const lit = prog(frame, h.mark, 15);
  return (
    <>
      <Rain frame={frame} scale={1.7} fade={0.55 * prog(frame, 0, 20) * (1 - 0.45 * prog(frame, h.s1, 20))} />

      {/* 「分かる」と「できる」のあいだ */}
      {frame < h.out + 14 ? (
        <div style={frame >= h.out ? leave(frame, h.out, 12) : undefined}>
          <p style={{ ...caption, top: 380, fontSize: 76, lineHeight: 1.45, letterSpacing: "0.01em", ...fall(frame, 9, 18, 20) }}>
            「分かる」と「できる」の
            <br />
            あいだを埋める。
          </p>
        </div>
      ) : null}

      {/* 似た文が降ってきて、共通しているところが光る */}
      {frame >= h.s1 ? (
        <>
          <ol style={{ position: "absolute", left: 650, top: 150, width: 620, margin: 0, padding: 0, listStyle: "none", borderTop: `1.5px solid ${C.line}` }}>
            {ROWS.map((s, i) => (
              <li key={s.key} style={{ display: "flex", alignItems: "stretch", gap: 30, padding: "24px 0", borderBottom: `1.5px solid ${C.line}`, ...rainFall(frame, falls[i]) }}>
                <span style={{ width: 5, margin: "8px 0", borderRadius: 3, background: C.line2, transformOrigin: "top", transform: `scaleY(${prog(frame, falls[i] + 7, 13)})` }} />
                <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontFamily: FONT.ko, fontSize: 58, fontWeight: 500, lineHeight: 1.6 }}>
                    <Sent text={s.text} hl={s.mark ? [{ start: s.mark[0], end: s.mark[1], kind: "mark", p: lit }] : []} />
                  </span>
                  <span style={{ fontFamily: FONT.ja, fontSize: 28, lineHeight: 1.5, color: C.muted }}>
                    <Sent text={s.gloss} color={C.muted} hl={s.glossMark ? [{ start: s.glossMark[0], end: s.glossMark[1], kind: "mark", p: lit }] : []} />
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p style={{ ...caption, top: 800, fontSize: 50, lineHeight: 1.5 }}>
            <span style={{ display: "block", ...fall(frame, h.s1 + 6, 14, 16) }}>似た文を、いくつも浴びて、</span>
            <span style={{ display: "block", ...fall(frame, h.mark, 14, 16) }}>
              <span style={{ color: C.accent }}>共通しているところ</span>に、自分で気づく。
            </span>
          </p>
        </>
      ) : null}
    </>
  );
}
