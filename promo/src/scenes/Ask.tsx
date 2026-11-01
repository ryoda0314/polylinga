// C5. 問い（全面）：言ってみて直してもらうところを見せたあとで「でも、はじめたばかりで、言葉を知らなかったら？」。材料は、
// いま浴びた4つの文（右に、雨の文を大きく描き直したもの。アプリの画面ではない）。さっき言ってみた文の言いたいこと（今日は
// 韓国でいちご食べたい）の言葉は、もう訳の中にある：同じ色のところが対応する（アプリの答え合わせと同じ見せ方）。「いちご
// 食べたい」は二文目がまるごと、「韓国」は一文目、「今日は」は三文目のどこか。ただ、どれがどの意味かは分からない：三文目の
// 語に「？」。言いたいことの「で」だけは、どの文にも無い（さっき直してもらったところ：한국에 → 한국에서）。
import type { ReactNode } from "react";
import { fall, leave, prog, rainFall, SOFT } from "../anim";
import LIB from "../library.json";
import { T } from "../timeline";
import { C, FONT } from "../theme";
import { Rain, rgba, Sent, type HL } from "../ui";
import { CAP, Parts, type Part } from "./Caption";

/** 言いたいこと（直してもらった文の訳 今日は韓国でいちごを食べたい。の、学習者の言い方）。 */
const WANT = "今日は韓国でいちご食べたい";
/** 言いたいことの言葉と、それが訳に出てくる雨の文（0 から：一文目・二文目・三文目）。 */
const PIECES: [word: string, row: number][] = [
  ["今日は", 2],
  ["韓国", 0],
  ["いちご", 1],
  ["食べたい", 1],
];
/** 語を押す文（三文目）。 */
const ASKED = 2;
const ROWS = LIB.rain;
const LOOK = LIB.look;

const span = (text: string, word: string): [number, number] => {
  const at = text.indexOf(word);
  return [at, at + word.length];
};

export function Ask({ frame }: { frame: number }) {
  const a = T.ask;
  /** 言葉が光る時：今日は・韓国が先、いちご・食べたい（二文目まるごと）があと。 */
  const litAt = (row: number) => (row === 1 ? a.lit2 : a.lit);
  const marks = (text: string, row: number): HL[] =>
    PIECES.filter(([, r]) => r === row).map(([w]) => {
      const [start, end] = span(text, w);
      return { start, end, kind: "mark", p: prog(frame, litAt(row), 15, SOFT) };
    });
  const wantMarks: HL[] = PIECES.map(([w, row]) => {
    const [start, end] = span(WANT, w);
    return { start, end, kind: "mark", p: prog(frame, litAt(row), 15, SOFT) };
  });
  const dim = 1 - 0.68 * prog(frame, a.lit, 14, SOFT);
  return (
    <>
      <Rain frame={frame} scale={1.7} fade={0.3} />

      {/* 問い */}
      {frame < a.mat + 14 ? (
        <div style={frame >= a.mat ? leave(frame, a.mat, 12) : undefined}>
          <p style={{ position: "absolute", left: 0, right: 0, top: 420, margin: 0, textAlign: "center", fontSize: 72, fontWeight: 600, lineHeight: 1.45, color: C.ink, ...fall(frame, a.q, 18, 20) }}>
            でも、はじめたばかりで、
            <br />
            言葉を知らなかったら？
          </p>
        </div>
      ) : null}

      {frame >= a.mat ? (
        <>
          {/* 左：映像の言葉。材料は → どれがどの意味？ */}
          <Say frame={frame} from={a.mat + 8} to={a.which} main={[["材料は、"], ["いま浴びた4つの文。"]]} sub={[["言いたいことの言葉は、もうこの中に。"]]} subAt={a.lit} />
          <Say
            frame={frame}
            from={a.which + 8}
            to={Infinity}
            main={[["ただ、どれが、"], ["どの意味？"]]}
            sub={[["「今日は」は、", ...LOOK.words.flatMap((w, i): Part[] => [...(i ? ["・"] : []), { text: w, font: "ko" }]), " のどれ？"]]}
            subAt={a.q1}
          />
          <div style={{ position: "absolute", left: CAP.left, top: 650, width: 740, display: "flex", flexDirection: "column", gap: 10, ...fall(frame, a.want, 14, 16) }}>
            <span style={{ fontSize: 26, fontWeight: 600, color: C.muted }}>言いたいこと</span>
            <span style={{ fontSize: 48, fontWeight: 600, lineHeight: 1.4, color: C.ink, whiteSpace: "nowrap" }}>
              <Sent text={WANT} hl={wantMarks} />
            </span>
          </div>

          {/* 右：いま浴びた4つの文 */}
          <ol style={{ position: "absolute", left: 900, top: 206, width: 860, margin: 0, padding: 0, listStyle: "none", borderTop: `1.5px solid ${C.line}` }}>
            {ROWS.map((s, i) => {
              const at = a.mat + 4 + i * 4;
              const fell = rainFall(frame, at);
              // 二文目は、まるごと「いちご食べたい」（文の終わりの点は除く）。
              const koMarks: HL[] = i === 1 ? [{ start: 0, end: s.text.length - 1, kind: "mark", p: prog(frame, a.lit2, 15, SOFT) }] : [];
              return (
                <li key={s.key} style={{ display: "flex", alignItems: "stretch", gap: 26, padding: "22px 0", borderBottom: `1.5px solid ${C.line}`, ...fell, opacity: Number(fell.opacity) * (i === 3 ? dim : 1) }}>
                  <span style={{ width: 4, margin: "8px 0", borderRadius: 2, background: C.line2, transformOrigin: "top", transform: `scaleY(${prog(frame, at + 7, 13)})` }} />
                  <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontFamily: FONT.ko, fontSize: 46, fontWeight: 500, lineHeight: 1.6, color: C.ink }}>
                      {i === ASKED ? <Asked frame={frame} text={s.text} /> : <Sent text={s.text} hl={koMarks} />}
                    </span>
                    <span style={{ fontFamily: FONT.ja, fontSize: 25, lineHeight: 1.55, color: C.muted }}>
                      <Sent text={s.gloss} color={C.muted} hl={marks(s.gloss, i)} />
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </>
  );
}

/** 三文目：語ごとに、どれが「今日は」なのか分からない（点線と「？」が、一つずつ）。 */
function Asked({ frame, text }: { frame: number; text: string }) {
  const a = T.ask;
  const at = [a.q1, a.q2, a.q3, a.q4];
  const out: ReactNode[] = [];
  let from = 0;
  LOOK.words.forEach((w, k) => {
    const i = text.indexOf(w, from);
    if (i > from) out.push(text.slice(from, i));
    const p = prog(frame, at[k], 10);
    out.push(
      <span
        key={w}
        style={{ position: "relative", display: "inline-block", textDecoration: p > 0 ? `underline dashed ${rgba(C.accent, 0.75 * p)}` : undefined, textDecorationThickness: 3, textUnderlineOffset: "0.22em" }}
      >
        {w}
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "-0.78em",
            textAlign: "center",
            fontFamily: FONT.ja,
            fontSize: "0.8em",
            fontWeight: 700,
            lineHeight: 1,
            color: C.accent,
            opacity: p,
            transform: `translateY(${(1 - p) * 10}px) scale(${0.7 + 0.3 * p})`,
          }}
        >
          ？
        </span>
      </span>,
    );
    from = i + w.length;
  });
  out.push(text.slice(from));
  return <>{out}</>;
}

/** 左の言葉（Caption の本文と静かな一文と同じ大きさ。見出しは無い）。`from` で降り、`to` で上がって消える。 */
function Say({ frame, from, to, main, sub, subAt }: { frame: number; from: number; to: number; main: Part[][]; sub: Part[][]; subAt: number }) {
  if (frame < from - 8 || frame > to + 14) return null;
  const style = frame >= to ? leave(frame, to, 9, 12) : fall(frame, from, 16, 16);
  return (
    <div style={{ position: "absolute", left: CAP.left, top: 300, width: CAP.width, ...style }}>
      {main.map((m, j) => (
        <p key={j} style={{ margin: 0, fontSize: 52, fontWeight: 600, lineHeight: 1.42, letterSpacing: "0.01em", color: C.ink, fontFamily: FONT.ui }}>
          <Parts parts={m} frame={frame} colorAt={from} />
        </p>
      ))}
      <div style={{ marginTop: 30, ...fall(frame, subAt, 10, 16) }}>
        {sub.map((line, j) => (
          <p key={j} style={{ margin: 0, fontSize: 27, lineHeight: 1.75, color: C.ink2, fontFamily: FONT.ui }}>
            <Parts parts={line} frame={frame} colorAt={subAt + 8} />
          </p>
        ))}
      </div>
    </div>
  );
}
