// C. アプリの画面で、ひとめぐり。左に映像の言葉、右にアプリ（電話の幅：アプリの枠のいちばん広い 560px）。
//   浴びる：雨の最初の画面で 浴びる を押すと、同じかたち（誘う）の4つの文が、置き場の声で一つずつ降る。
//   気づく：「共通しているところは？」で、文と訳の同じところに色が付く。共通していたところ：誘う。
//   メモ：주말에 영화 볼래? を押して、語のシート。「주말」を自分で打ってメモする。
//   言ってみる：「これで言ってみる」。さっきの雨が欄の上に残る。使い方の例の文で、直してもらう。
//   直った：あなたの文と直した文（メモした 주말 は紫の点線）、コピー、詳しく解説で 갈래 と「行かない？」が光る。
//   また出会う：3日後、前にも降ったかたちが、まだ出会っていない4つの文で降る。주말 が紫の点線で、その知らせ。
//   3つの言葉：はじめの画面で選べる 韓国語・英語・中国語。同じ文（今日カラオケ行かない？）が、それぞれの声で。
//   続ける：使い方の最後の画面。電車の窓の前で、いつ浴びるかを決める。
import type { CSSProperties, ReactNode } from "react";
import { fall, mix, mixColor, prog, rainFall, rise, SOFT } from "../anim";
import LIB from "../library.json";
import { MEMO_KEYS, MEMO_PER, sounding, startOf, T, TYPE_PER, type ClipId } from "../timeline";
import { C, FONT, fontOf, type Lang } from "../theme";
import { BottomNav, Btn, Caret, Icon, label, Logo, note, PlayButton, Press, Rain, Sent, Sky, SolidSpeak, Sources, Toolbar, TopBar, type HL } from "../ui";
import { Captions, type Cap } from "./Caption";

/** 映像の言葉。 */
const CAPS: Cap[] = [
  { from: T.rain.cap, door: "rain", main: [["同じかたちの文が、"], ["音声付きで降ってくる。"]], sub: [["覚えようとしなくて大丈夫。"], ["聞きながら、見比べる。"]] },
  {
    from: T.notice.cap,
    door: "notice",
    main: [["共通しているところに、"], ["自分で気づく。"]],
    sub: [["答え合わせは、文と訳の同じところに"], ["色が付くだけ。"]],
    subAt: T.notice.press,
  },
  { from: T.memo.cap, door: "memo", main: [["知らない語は、"], ["自分の指で打ってメモ。"]], sub: [["見返さなくていいし、忘れていい。"]] },
  { from: T.tri.cap, door: "say", main: [["浴びたかたちで、"], ["自分のことを言ってみる。"]], sub: [["分からないところは、日本語のままで大丈夫。"]] },
  {
    from: T.fixed.cap,
    door: "say",
    main: [["AI が直して、"], ["理由を説明してくれる。"]],
    sub: [["直った文は、コピーしてそのまま送れる。"], ["語を押すと、文と訳の対応するところが光る。"]],
  },
  {
    from: T.again.cap,
    door: "again",
    main: [["忘れたころに、"], ["また降ってくる。"]],
    sub: [["浴びたかたちは、日をあけて新しい文で。"], ["メモした語も、その中でまた出会う。"]],
    more: (frame) => <Days frame={frame} />,
  },
  {
    from: T.langs.cap,
    door: "langs",
    main: [["韓国語・英語・中国語を、"], ["日本語から。"]],
    sub: [["例文は、4つの言葉でそろえてある。"], ["中国語には、ピンインが付く。"]],
  },
  { from: T.habit.cap, door: "habit", main: [["毎日のあとに、"], ["ひと雨。"]], sub: [["ひと雨は1分ほど。連続記録はありません。"]] },
];

/** 日が進む（使い方の .days：今日・1日後・2日後・3日後。過ぎた日は薄い紫、いまの日は紫）。 */
function Days({ frame }: { frame: number }) {
  const a = T.again;
  const day = frame >= a.d3 ? 3 : frame >= a.d2 ? 2 : frame >= a.d1 ? 1 : 0;
  const at = [a.cap, a.d1, a.d2, a.d3];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, width: 560, marginTop: 44, ...fall(frame, a.cap + 14, 10, 14) }}>
      {["今日", "1日後", "2日後", "3日後"].map((d, i) => {
        const on = i === day;
        const past = i < day;
        const p = prog(frame, at[i], 9);
        return (
          <span key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, fontSize: 25, fontFamily: FONT.ja, color: on ? C.again : past ? C.muted : C.faint, fontWeight: on ? 600 : 400 }}>
            <i
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: on ? mixColor(C.line2, C.again, p) : past ? mixColor(C.paper, C.again, 0.35) : C.line2,
                transform: `scale(${on ? 1 + 0.25 * p : 1})`,
              }}
            />
            {d}
          </span>
        );
      })}
    </div>
  );
}

const PANEL = { left: 880, top: 40, width: 900, height: 1000 };
/** 電話の幅：アプリの枠（app.module.css の .shell）のいちばん広い幅。 */
const PW = 560;
const K = PANEL.width / PW;
const PH = PANEL.height / K;
/** 下のタブ（4 + 50 + 8、上の線）。 */
const NAV = 63;
/** タブの上に見えている高さ。 */
const VIEW = PH - NAV;

export function Story({ frame }: { frame: number }) {
  return (
    <>
      <Captions frame={frame} caps={CAPS} until={T.end.start} />
      <Panel frame={frame} />
    </>
  );
}

function Panel({ frame }: { frame: number }) {
  const cuts = [T.fixed.start, T.again.back, T.langs.start, T.habit.start];
  const w = (i: number) => (i === 0 ? 1 : prog(frame, cuts[i - 1], 12, SOFT)) * (i === cuts.length ? 1 : 1 - prog(frame, cuts[i], 12, SOFT));
  const screens = [RainScreen, FixScreen, AgainScreen, LangsScreen, HabitScreen];
  return (
    <div style={{ position: "absolute", ...PANEL, borderRadius: 28, border: `1.5px solid ${C.line2}`, overflow: "hidden", background: C.paper, ...fall(frame, T.rain.start, 24, 18) }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: PW, height: PH, transform: `scale(${K})`, transformOrigin: "0 0", fontFamily: FONT.ui, color: C.ink, fontSize: 16, lineHeight: 1.6 }}>
        {screens.map((Screen, i) =>
          w(i) > 0 ? (
            <div key={i} style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: w(i), background: C.paper }}>
              <Screen frame={frame} />
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

// ---- 部品 -----------------------------------------------------------------------------------------------------------

/** 画面を下へ送る：[いつ, どこまで, 何コマで] を順に。 */
function glide(frame: number, steps: [at: number, to: number, dur?: number][]): number {
  let v = 0;
  for (const [at, to, dur = 18] of steps) v = mix(v, to, prog(frame, at, dur, SOFT));
  return v;
}

/** 送られる頁（下のタブの分だけ、下にあき：app.module.css の .main）。 */
function Scroll({ y, children, bottom = NAV }: { y: number; children: ReactNode; bottom?: number }) {
  return <div style={{ position: "absolute", left: 0, right: 0, top: 0, paddingBottom: bottom, transform: `translateY(${-y}px)` }}>{children}</div>;
}

/** 浴びるの頁：名前と言葉の組、雨の種類、そして雨（.body：上下 32px、左右 20px、間 32px）。 */
function ShowerPage({ target = "한국어", targetLang = "ko", children }: { target?: string; targetLang?: Lang; children: ReactNode }) {
  return (
    <>
      <TopBar target={target} targetLang={targetLang} />
      <div style={{ display: "flex", flexDirection: "column", gap: 32, padding: "32px 20px 32px" }}>
        <div style={{ marginBottom: -12 }}>
          <Sources />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>{children}</div>
      </div>
    </>
  );
}

/** 雨の最初の画面（.intro）：空、雨が来ています、何文か、メモした語、案内、浴びる。 */
function Intro({ frame, memo, press }: { frame: number; memo?: string; press: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "8px 0 24px" }}>
      <Sky frame={frame} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ margin: 0, fontFamily: FONT.mincho, fontSize: 26, fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1.6 }}>雨が来ています</p>
        <p style={{ margin: 0, fontSize: 15, color: C.ink2 }}>4つの文が、音声付きで降ってきます</p>
        {memo ? <p style={memoNote}>メモした「<span style={{ fontFamily: FONT.ko }}>{memo}</span>」も降ってきます</p> : null}
      </div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: C.ink2 }}>聞きながら見比べて、共通しているところを探してみてください。答え合わせは最後に。</p>
      <Btn full press={frame - press}>
        <Icon name="shower" size={22} />
        浴びる
      </Btn>
    </div>
  );
}

const memoNote: CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.7, color: C.again, fontWeight: 500 };

type Rained = { key: string; lang: string; text: string; gloss: string; mark: number[] | null; glossMark: number[] | null; reading: string[] | null };

/** 雨の一文（.item）：雨粒、文、訳、再生。`at`：降ってきたコマ。鳴っている間は青く、波紋。 */
function Item({ frame, s, at, revealAt = Infinity, memo, tap = -99 }: { frame: number; s: Rained; at: number; revealAt?: number; memo?: string; tap?: number }) {
  const play = sounding(frame, s.key as ClipId);
  const playing = play >= 0;
  const lit = prog(frame, revealAt, 15, SOFT);
  const lang = s.lang as Lang;
  const memoAt = memo ? s.text.indexOf(memo) : -1;
  const hl: HL[] = [
    ...(memoAt >= 0 ? [{ start: memoAt, end: memoAt + memo!.length, kind: "memo" as const }] : []),
    ...(s.mark ? [{ start: s.mark[0], end: s.mark[1], kind: "mark" as const, p: lit }] : []),
  ];
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0", borderBottom: `1px solid ${C.line}`, ...rainFall(frame, at) }}>
      <span
        style={{
          flexShrink: 0,
          alignSelf: "stretch",
          width: 3,
          margin: "6px 0",
          borderRadius: 2,
          background: mixColor(C.line2, C.accent, playing ? prog(frame, frame - play, 9) : 0),
          transformOrigin: "top",
          transform: `scaleY(${prog(frame, at + 7, 13, (t) => 1 - (1 - t) * (1 - t))})`,
        }}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ position: "relative", alignSelf: "flex-start", fontFamily: fontOf(lang), fontSize: 23, fontWeight: 500, lineHeight: 1.75, color: playing ? C.accent : C.ink, borderRadius: 6 }}>
          <Sent text={s.text} hl={hl} reading={s.reading} color={playing ? C.accent : C.ink} />
          <Press t={frame - tap} size={56} />
        </span>
        <span style={{ fontFamily: FONT.ja, fontSize: 14, color: C.muted }}>
          <Sent text={s.gloss} color={C.muted} hl={s.glossMark ? [{ start: s.glossMark[0], end: s.glossMark[1], kind: "mark", p: lit }] : []} />
        </span>
      </div>
      <PlayButton play={play} />
    </li>
  );
}

/** 共通していたところ（.answer）。 */
function Answer({ frame, at }: { frame: number; at: number }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 6, padding: 18, background: C.surface, borderRadius: 12, ...rise(frame, at, 6, 9) }}>
      <p style={label}>共通していたところ</p>
      <p style={{ margin: 0, fontSize: 19, fontWeight: 600, lineHeight: 1.5 }}>{LIB.label}</p>
      <p style={{ ...note, lineHeight: 1.7 }}>文の中と訳の中で、同じ色のところが対応しています。</p>
    </section>
  );
}

/** フォーカスのある欄（:focus-visible の 2px の輪）。 */
const focusRing = (on: boolean): CSSProperties => (on ? { outline: `2px solid ${C.accent}`, outlineOffset: 2 } : {});

// ---- 浴びる・気づく・メモ・言ってみる（一つの頁） ------------------------------------------------------------------

const RAIN = LIB.rain as Rained[];
/** 雨の頁の高さの目安（px）：一文、文の並びの上、など。画面をどこまで送るかに使う。 */
const LIST_TOP = 208;
const ITEM = 100;
const listBottom = (n: number) => LIST_TOP + 1 + n * ITEM;

function RainScreen({ frame }: { frame: number }) {
  const r = T.rain;
  const n = T.notice;
  const m = T.memo;
  const tr = T.tri;
  const at = [r.press + 3, startOf("rain2"), startOf("rain3"), startOf("rain4")];
  const shown = at.filter((a) => frame >= a).length;
  const all = shown === RAIN.length;
  const revealed = frame >= n.reveal;
  const trying = frame >= tr.open;
  // 画面の送り：浴びるのボタンまで → 降りはじめに上へ → 4つ目に合わせて → 答え合わせのボタン → 答え → これで言ってみる → さっきの雨を欄の上に。
  const afterTop = listBottom(4) + 20;
  const answerEnd = afterTop + 120;
  const tryTop = answerEnd + 12;
  const y = glide(frame, [
    [r.look, 110, 20],
    [r.press + 3, 0, 14],
    [at[3] + 4, listBottom(4) + 16 - VIEW, 20],
    [n.start + 2, afterTop + 52 + 16 - VIEW, 22],
    [n.reveal + 8, answerEnd + 12 - VIEW, 24],
    [tr.start + 1, tryTop + 52 + 16 - VIEW, 14],
    [tr.open + 10, tryTop + 17 - 8, 20],
  ]);
  return (
    <>
      <Scroll y={y}>
        <ShowerPage>
          <Toolbar badge="はじめてのかたち" />
          {shown === 0 ? (
            <Intro frame={frame} press={r.press} />
          ) : (
            <ol style={{ listStyle: "none", margin: 0, padding: 0, borderTop: `1px solid ${C.line}` }}>
              {RAIN.slice(0, shown).map((s, i) => (
                <Item key={s.key} frame={frame} s={s} at={at[i]} revealAt={n.reveal} tap={i === 1 ? m.tap : -99} />
              ))}
            </ol>
          )}
          {all ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {revealed ? (
                <Answer frame={frame} at={n.reveal} />
              ) : (
                <Btn quiet full press={frame - n.press}>
                  共通しているところは？
                </Btn>
              )}
              {trying ? (
                <TryForm frame={frame} />
              ) : (
                <Btn full press={frame - tr.press}>
                  これで言ってみる
                </Btn>
              )}
              <Btn quiet full>
                次の雨
              </Btn>
            </div>
          ) : null}
        </ShowerPage>
      </Scroll>
      <BottomNav active="shower" />
      <WordSheet frame={frame} />
    </>
  );
}

/** 気になった語（WordSheet）：주말에 영화 볼래? の語と、自分で打つ欄。下からせり上がり、× で閉じる。 */
function WordSheet({ frame }: { frame: number }) {
  const m = T.memo;
  if (frame < m.sheet || frame >= m.close + 10) return null;
  const up = frame < m.close ? prog(frame, m.sheet, 9) : 1 - prog(frame, m.close, 9, SOFT);
  const s = RAIN[1];
  const k = frame < m.type ? 0 : Math.min(MEMO_KEYS.length, Math.floor((frame - m.type) / (MEMO_PER * 30)) + 1);
  const typed = k > 0 ? MEMO_KEYS[k - 1] : "";
  const saving = frame >= m.save && frame < m.save + 8;
  const done = frame >= m.save + 8;
  const words = ["주말에", "영화", "볼래"];
  const input: CSSProperties = { minHeight: 48, padding: "0 12px", border: `1.5px solid ${C.ink}`, borderRadius: 12, fontSize: 17, background: C.paper, display: "flex", alignItems: "center" };
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 20 }}>
      <div style={{ position: "absolute", inset: 0, background: `rgba(23,32,51,${0.32 * up})` }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: C.paper,
          borderRadius: "16px 16px 0 0",
          padding: "16px 20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          transform: `translateY(${(1 - up) * 105}%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>気になった語</p>
          <span style={{ position: "relative", width: 44, height: 44, marginRight: -10, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="close" size={20} />
            <Press t={frame - m.close} size={44} />
          </span>
        </div>
        <p style={{ margin: 0, fontFamily: FONT.ko, fontSize: 20, fontWeight: 500, lineHeight: 1.6 }}>{s.text}</p>
        <p style={note}>語を選ぶと、ほかの文での使われ方が見られます。</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {words.map((w) => (
            <span key={w} style={{ minHeight: 40, padding: "0 14px", border: `1px solid ${C.line2}`, borderRadius: 999, display: "inline-flex", alignItems: "center", fontFamily: FONT.ko, fontSize: 16 }}>
              {w}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          <p style={label}>自分で打ってメモ</p>
          <div style={{ position: "relative", ...input, fontFamily: FONT.ko, ...focusRing(frame >= m.type - 8 && frame < m.save) }}>
            {typed}
            {frame >= m.type - 8 && frame < m.save ? <Caret frame={frame} color={C.ink} /> : null}
            <Press t={frame - (m.type - 8)} size={48} />
          </div>
          <p style={{ margin: 0, fontSize: 12, color: C.muted }}>意味やメモ（なくても可）</p>
          <div style={input} />
          <p style={note}>見返さなくて大丈夫。また出会うたびに数えます。</p>
          {done ? (
            <p style={{ margin: 0, fontSize: 14, color: C.ink2, ...rise(frame, m.save + 8, 4, 7) }}>
              「<span style={{ fontFamily: FONT.ko }}>{LIB.memo}</span>」をメモしました。
            </p>
          ) : null}
          <Btn full done={done} press={frame - m.save} style={saving ? { opacity: 0.55 } : undefined}>
            {done ? (
              <>
                <Icon name="check" size={20} />
                メモしました
              </>
            ) : saving ? (
              "メモしています…"
            ) : (
              "メモする"
            )}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/** これで言ってみる（TryForm）：さっき降ってきた文（答え合わせのあとなので光ったまま）、欄、直してもらう。 */
function TryForm({ frame }: { frame: number }) {
  const t = T.tri;
  const count = frame < t.type ? 0 : Math.min([...LIB.say.attempt].length, Math.floor((frame - t.type) / (TYPE_PER * 30)) + 1);
  const typed = [...LIB.say.attempt].slice(0, count).join("");
  const sending = frame >= t.send;
  const focused = !sending;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px 0", borderTop: `1px solid ${C.line}`, ...rise(frame, t.open, 4, 6) }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", marginBottom: 4, background: C.surface, borderRadius: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: C.muted }}>さっき降ってきた文</span>
        {/* 26vh まで（PH の 26%）：それより長いと、この中で送る。 */}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: PH * 0.26, overflow: "hidden" }}>
          {RAIN.map((s, i) => (
            <li key={s.key} style={{ display: "flex", flexDirection: "column", padding: "6px 0", borderBottom: i < RAIN.length - 1 ? `1px solid ${C.line}` : undefined }}>
              <span style={{ fontFamily: FONT.ko, fontSize: 17, fontWeight: 500, lineHeight: 1.6 }}>
                <Sent text={s.text} hl={s.mark ? [{ start: s.mark[0], end: s.mark[1], kind: "mark" }] : []} />
              </span>
              <span style={{ fontSize: 12, color: C.muted }}>
                <Sent text={s.gloss} color={C.muted} hl={s.glossMark ? [{ start: s.glossMark[0], end: s.glossMark[1], kind: "mark" }] : []} />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p style={label}>さっきの文みたいに、自分のことを言ってみる</p>
      <div
        style={{
          minHeight: 96,
          padding: 14,
          border: `1.5px solid ${C.ink}`,
          borderRadius: 12,
          fontFamily: FONT.ko,
          fontSize: 18,
          lineHeight: 1.6,
          background: C.paper,
          ...focusRing(focused),
        }}
      >
        {typed}
        {focused ? <Caret frame={frame} color={C.ink} /> : null}
      </div>
      <p style={note}>分からないところは日本語のままで大丈夫です。</p>
      <Btn full press={frame - t.send} style={sending ? { opacity: 0.55 } : undefined}>
        {sending ? "直しています…" : "直してもらう"}
      </Btn>
    </div>
  );
}

// ---- 直った（/app/s/[id]：浴びたかたちで言ってみた） ---------------------------------------------------------------

function FixScreen({ frame }: { frame: number }) {
  const t = T.fixed;
  const say = LIB.say;
  const open = frame >= t.explain;
  const picked = frame >= t.pick;
  const part = say.parts[3];
  const lit = prog(frame, t.pick, 15, SOFT);
  const memoAt = say.corrected.indexOf(LIB.memo);
  const y = glide(frame, [
    [t.why, 24, 18],
    [t.explain + 4, 226, 24],
  ]);
  return (
    <>
      <Scroll y={y}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px 8px 8px", borderBottom: `1px solid ${C.line}` }}>
          <span style={{ width: 44, height: 44, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="back" size={22} />
          </span>
          <p style={{ flex: 1, margin: 0, fontSize: 15, fontWeight: 500 }}>浴びたかたちで言ってみた</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28, padding: "20px 20px 40px" }}>
          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={label}>あなたの文</p>
            <p style={{ margin: 0, fontFamily: FONT.ko, fontSize: 20, lineHeight: 1.7, color: C.muted }}>
              <Sent text={say.attempt} color={C.muted} hl={say.removed.map((r) => ({ ...r, kind: "del" as const }))} />
            </p>
          </section>
          <section style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${C.line}`, paddingTop: 24 }}>
            <p style={label}>直した文</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <p style={{ flex: 1, minWidth: 0, margin: 0, fontFamily: FONT.ko, fontSize: 24, fontWeight: 500, lineHeight: 1.8 }}>
                <Sent
                  text={say.corrected}
                  hl={[...say.added.map((r) => ({ ...r, kind: "ins" as const })), ...(memoAt >= 0 ? [{ start: memoAt, end: memoAt + LIB.memo.length, kind: "memo" as const }] : [])]}
                />
              </p>
              <SolidSpeak />
            </div>
            <p style={{ margin: 0, fontSize: 14, color: C.muted }}>{say.meaning}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Btn quiet press={frame - t.copy}>
                <Icon name="copy" size={18} />
                {frame >= t.copy + 3 ? "コピーしました" : "コピー"}
              </Btn>
              <Btn quiet>
                <Icon name="bookmark" size={18} />
                語をメモ
              </Btn>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Btn quiet full press={frame - t.explain}>
                {open ? "解説を閉じる" : "詳しく解説"}
              </Btn>
              {open ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, border: `1px solid ${C.line2}`, borderRadius: 12, ...rise(frame, t.explain, 10, 12) }}>
                  <p style={{ margin: 0, fontFamily: FONT.ko, fontSize: 20, fontWeight: 500, lineHeight: 1.8 }}>
                    <Sent text={say.corrected} hl={picked ? [{ start: part.start, end: part.end, kind: "mark", p: lit }] : []} />
                  </p>
                  <p style={{ margin: 0, fontSize: 14, color: C.muted }}>
                    <Sent text={say.meaning} color={C.muted} hl={picked && part.gloss ? [{ start: part.gloss[0], end: part.gloss[1], kind: "mark", p: lit }] : []} />
                  </p>
                  <p style={note}>語を押すと、文と訳の対応するところが光ります。</p>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: `1px solid ${C.line}` }}>
                    {say.parts.map((p, i) => (
                      <li
                        key={p.start}
                        style={{
                          position: "relative",
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
                          gap: 12,
                          alignItems: "baseline",
                          padding: "10px 6px",
                          borderBottom: `1px solid ${C.line}`,
                          background: i === 3 && picked ? C.tint : undefined,
                          ...rise(frame, t.explain + Math.round(i * 2.1), 10, 12),
                        }}
                      >
                        <span style={{ fontFamily: FONT.ko, fontSize: 18, fontWeight: 500 }}>{say.corrected.slice(p.start, p.end)}</span>
                        <span style={{ fontSize: 14, lineHeight: 1.6, color: C.ink2 }}>{p.meaning}</span>
                        {i === 3 ? <Press t={frame - t.pick} x="30%" size={52} /> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
          <section style={{ display: "flex", flexDirection: "column", gap: 10, padding: 18, background: C.surface, borderRadius: 12 }}>
            <p style={label}>どこを直したか</p>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75 }}>{say.explanation}</p>
          </section>
        </div>
      </Scroll>
      <BottomNav active="write" />
    </>
  );
}

// ---- また出会う（3日後の雨） ------------------------------------------------------------------------------------------

const LATER = LIB.again as Rained[];

function AgainScreen({ frame }: { frame: number }) {
  const a = T.again;
  const at = [a.press + 3, startOf("again2"), startOf("again3"), startOf("again4")];
  const shown = at.filter((x) => frame >= x).length;
  const all = shown === LATER.length;
  const met = shown > 0;
  // 4つ目のあと、メモした語の知らせが見えるところまで。
  const noteEnd = listBottom(4) + 20 + 22;
  const y = glide(frame, [
    [a.press - 24, 139, 18],
    [a.press + 3, 0, 14],
    [at[2] + 4, listBottom(3) + 20 + 22 + 16 - VIEW, 18],
    [at[3] + 4, noteEnd + 16 - VIEW, 20],
  ]);
  return (
    <>
      <Scroll y={y}>
        <ShowerPage>
          <Toolbar badge="前にも降ったかたち・3日ぶり" again />
          {shown === 0 ? (
            <Intro frame={frame} memo={LIB.memo} press={a.press} />
          ) : (
            <ol style={{ listStyle: "none", margin: 0, padding: 0, borderTop: `1px solid ${C.line}` }}>
              {LATER.slice(0, shown).map((s, i) => (
                <Item key={s.key} frame={frame} s={s} at={at[i]} memo={LIB.memo} />
              ))}
            </ol>
          )}
          {met ? (
            <p style={{ ...memoNote, ...rise(frame, at[0] + 10, 4, 9) }}>
              メモした「<span style={{ fontFamily: FONT.ko }}>{LIB.memo}</span>」が、また降ってきました。
            </p>
          ) : null}
          {all ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Btn quiet full>
                共通しているところは？
              </Btn>
              <Btn full>これで言ってみる</Btn>
              <Btn quiet full>
                次の雨
              </Btn>
            </div>
          ) : null}
        </ShowerPage>
      </Scroll>
      <BottomNav active="shower" />
    </>
  );
}

// ---- 3つの言葉：はじめの画面（/start）と、同じ文の雨 -----------------------------------------------------------------

const TARGETS: [Lang, string, string][] = [
  ["ko", "韓国語", "한국어"],
  ["en", "英語", "English"],
  ["zh", "中国語（ピンイン付き）", "中文"],
];

function LangsScreen({ frame }: { frame: number }) {
  const l = T.langs;
  const parts: [number, ReactNode][] = [
    [l.start, <StartScreen key="start" frame={frame} />],
    [l.ko, <OneRain key="ko" frame={frame} lang="ko" at={l.ko} />],
    [l.enRain, <OneRain key="en" frame={frame} lang="en" at={l.enRain} />],
    [l.zhRain, <OneRain key="zh" frame={frame} lang="zh" at={l.zhRain} />],
  ];
  return (
    <>
      {parts.map(([from, node], i) => {
        const to = parts[i + 1]?.[0] ?? Infinity;
        const o = (i === 0 ? 1 : prog(frame, from, 10, SOFT)) * (1 - prog(frame, to, 10, SOFT));
        return o > 0 ? (
          <div key={i} style={{ position: "absolute", inset: 0, opacity: o, background: C.paper }}>
            {node}
          </div>
        ) : null;
      })}
    </>
  );
}

/** はじめの画面：どの言葉の雨を浴びますか？ 言うのに合わせて、韓国語・英語・中国語と選んでみる。 */
function StartScreen({ frame }: { frame: number }) {
  const l = T.langs;
  const picked = frame >= l.zh ? 2 : frame >= l.en ? 1 : 0;
  // 選ぶところまで少し送る（名前は見えたまま）。
  const y = glide(frame, [[l.start + 30, 62, 22]]);
  return (
    <Scroll y={y} bottom={48}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 16px" }}>
        <div style={{ position: "relative", width: "100%", maxWidth: 460, padding: "56px 4px 32px" }}>
          <Rain frame={frame} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
            <Logo size="lg" />
            <p style={{ margin: 0, fontSize: 17, fontWeight: 500, lineHeight: 1.7 }}>例文の雨を浴びて、使える言葉へ。</p>
          </div>
        </div>
        <div style={{ width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 20, padding: "0 4px" }}>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>どの言葉の雨を浴びますか？</p>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.85, color: C.ink2 }}>
            同じかたちの短い文が、音声付きで雨のように降ってきます。共通しているところに自分で気づいたら、自分でも言ってみて、AI に直してもらう。知らない語は自分で打ってメモ。忘れても、また降ってきます。
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TARGETS.map(([lang, name, native], i) => {
              const on = i === picked;
              return (
                <span
                  key={lang}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 12,
                    minHeight: 60,
                    padding: on ? "15.5px 17.5px" : "16px 18px",
                    border: on ? `1.5px solid ${C.accent}` : `1px solid ${C.line2}`,
                    borderRadius: 12,
                    background: on ? C.tint : C.paper,
                  }}
                >
                  <span style={{ fontSize: 17, color: on ? C.accent : C.ink, fontWeight: on ? 600 : 400 }}>{name}</span>
                  <span style={{ fontFamily: fontOf(lang), fontSize: 15, color: C.muted }}>{native}</span>
                  <Press t={frame - (i === 1 ? l.en : i === 2 ? l.zh : -99)} x="20%" size={50} />
                </span>
              );
            })}
          </div>
          <Btn full>はじめる</Btn>
          <p style={{ ...note, lineHeight: 1.7 }}>いまは日本語を話す人向けです。韓国語・英語・中国語を話す人向けは準備中です。</p>
        </div>
      </div>
    </Scroll>
  );
}

/** その言葉の雨の、最初の一文が降ってきたところ。 */
function OneRain({ frame, lang, at }: { frame: number; lang: Lang; at: number }) {
  const s = LIB.karaoke[lang as "ko" | "en" | "zh"] as Rained;
  const name = TARGETS.find((x) => x[0] === lang)![2];
  return (
    <>
      <Scroll y={0}>
        <ShowerPage target={name} targetLang={lang}>
          <Toolbar badge="はじめてのかたち" />
          <ol style={{ listStyle: "none", margin: 0, padding: 0, borderTop: `1px solid ${C.line}` }}>
            <Item frame={frame} s={s} at={at + 3} />
          </ol>
        </ShowerPage>
      </Scroll>
      <BottomNav active="shower" />
    </>
  );
}

// ---- 続ける（使い方の最後：毎日のあとに、ひと雨） -------------------------------------------------------------------

const CUES = ["電車に乗ったら", "朝起きたら", "お昼を食べたら", "寝る前に"];

/** 電車の窓の町並み（使い方の TOWN と同じ種）。 */
const TOWN = (() => {
  let seed = 5;
  const r = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const out: { x: number; w: number; h: number }[] = [];
  for (let x = 0; x < 98; ) {
    const w = 5 + r() * 9;
    out.push({ x, w, h: 30 + r() * 52 });
    x += w + 1.5 + r() * 2.5;
  }
  return out;
})();

function HabitScreen({ frame }: { frame: number }) {
  const h = T.habit;
  const value = frame >= h.pick ? CUES[0] : null;
  const saved = frame >= h.save + 6;
  const t = frame / 30;
  // 町は 16 秒、柱は 2.6 秒で、窓の幅の半分（200% の帯の半分）を左へ。
  const ride = (secs: number) => `translateX(${-((t / secs) % 1) * 50}%)`;
  const y = glide(frame, [[h.pick + 8, 70, 18]]) * (saved ? 1 - prog(frame, h.save + 6, 12, SOFT) : 1);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <Scroll y={y} bottom={0}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 12px 6px 20px" }}>
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} style={{ height: 4, borderRadius: 2, background: C.accent }} />
                ))}
              </div>
              <span style={{ minHeight: 44, padding: "0 8px", display: "inline-flex", alignItems: "center", fontSize: 13, color: C.muted }}>スキップ</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "14px 20px 28px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: C.accent }}>5　続ける</p>
                <p style={{ margin: 0, fontSize: 25, fontWeight: 600, lineHeight: 1.45 }}>毎日のあとに、ひと雨</p>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: C.ink2 }}>
                  ひと雨は1分ほど。毎日していることのあとに決めておくと、考えなくても続きます。連続記録はありません。
                </p>
              </div>
              <div
                style={{
                  position: "relative",
                  height: 150,
                  overflow: "hidden",
                  borderRadius: 24,
                  border: `10px solid ${mixColor(C.paper, C.ink, 0.08)}`,
                  background: mixColor(C.paper, C.accent, 0.06),
                }}
              >
                <div style={{ position: "absolute", left: 0, bottom: 0, width: "200%", height: "100%", transform: ride(16) }}>
                  {[0, 50].map((off) =>
                    TOWN.map((b, i) => (
                      <i
                        key={`${off}-${i}`}
                        style={{ position: "absolute", bottom: 0, left: `${off + b.x / 2}%`, width: `${b.w / 2}%`, height: `${b.h}%`, borderRadius: "6px 6px 0 0", background: mixColor(C.paper, C.accent, 0.14) }}
                      />
                    )),
                  )}
                </div>
                <div style={{ position: "absolute", left: 0, bottom: 0, width: "200%", height: "100%", transform: ride(2.6) }}>
                  {[0, 25, 50, 75].map((x) => (
                    <i key={x} style={{ position: "absolute", bottom: 0, left: `${x}%`, width: 8, height: "100%", background: mixColor(C.paper, C.ink, 0.12) }} />
                  ))}
                </div>
                {value ? (
                  <p style={{ position: "absolute", left: 16, top: 14, margin: 0, padding: "4px 12px", borderRadius: 999, background: C.paper, fontSize: 15, fontWeight: 600, color: C.accent, ...rise(frame, h.pick, 6, 9) }}>
                    {value}、ひと雨。
                  </p>
                ) : null}
              </div>
              {saved ? (
                <p style={{ margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.7, color: C.accent, ...rise(frame, h.save + 6, 10, 12) }}>
                  「{CUES[0]}、ひと雨」に決めました。自分の設定でいつでも変えられます。
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>いつ浴びることにする？</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {[...CUES, "自分で決める"].map((c, i) => {
                      const on = c === value;
                      return (
                        <span
                          key={c}
                          style={{
                            position: "relative",
                            minHeight: 40,
                            padding: "0 14px",
                            border: `1px solid ${on ? C.accent : C.line2}`,
                            borderRadius: 999,
                            background: on ? C.tint : C.paper,
                            color: on ? C.accent : C.ink2,
                            fontSize: 14,
                            fontWeight: on ? 600 : 400,
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          {c}
                          {i === 0 ? <Press t={frame - h.pick} size={44} /> : null}
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 18px" }}>
                    <Btn quiet press={frame - h.save} style={value ? undefined : { color: C.faint }}>
                      これにする
                    </Btn>
                    <span style={{ minHeight: 44, padding: "0 8px", display: "inline-flex", alignItems: "center", fontSize: 13, color: C.muted }}>今は決めない</span>
                  </div>
                </div>
              )}
            </div>
          </Scroll>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 20px 16px", background: C.paper, borderTop: `1px solid ${C.line}` }}>
          <Btn full>雨を浴びにいく</Btn>
        </div>
      </div>
    </>
  );
}
