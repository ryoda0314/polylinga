// ことのあめ の画面を、映像のために描き直したもの（../src/**/*.module.css、../src/app/globals.css）。大きさはアプリの px
// のまま、画面は CSS の拡大で大きく見せる。ひとりでには動かない：どの変化もコマで決まる。
import type { CSSProperties, ReactNode } from "react";
import { Img, staticFile } from "remotion";
import { mixColor } from "./anim";
import { C, FONT, fontOf, type Lang } from "./theme";

// ---- アイコン（../src/components/Icon.tsx。eye・sprout・globe は映像の見出しだけ） ------------------------------

const PATHS = {
  speaker: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  back: <path d="M15 18l-6-6 6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  pencil: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  shower: (
    <>
      <path d="M7 13.5h10a3.5 3.5 0 0 0 .2-7A5 5 0 0 0 7.7 7.6 3 3 0 0 0 7 13.5z" />
      <path d="M9 17v2.5" />
      <path d="M12 16.5v4" />
      <path d="M15 17v2.5" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 21v-9" />
      <path d="M12 12c0-4-3-6.5-7.5-6.5 0 4.2 3 6.5 7.5 6.5z" />
      <path d="M12 14.5c0-4 2.8-6.5 7.5-6.5 0 4.2-3 6.5-7.5 6.5z" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.4 2.4 3.6 5.3 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.3-3.6-8.5s1.2-6.1 3.6-8.5z" />
    </>
  ),
};
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, color = "currentColor", stroke = 1.8 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
      {PATHS[name]}
    </svg>
  );
}

export const rgba = (hex: string, a: number) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;

// ---- 小さな部品 ------------------------------------------------------------------------------------------------------

/** 指で押したところ：輪が寄って、離れる。`t` は押してからのコマ（前なら負）。 */
export function Press({ t, x = "50%", y = "50%", size = 46 }: { t: number; x?: number | string; y?: number | string; size?: number }) {
  if (t < -8 || t > 16) return null;
  const inP = Math.min(1, (t + 8) / 8);
  const outP = t > 0 ? Math.min(1, t / 16) : 0;
  return (
    <span
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: "50%",
        background: rgba(C.ink, 0.14 * inP * (1 - outP)),
        border: `2px solid ${rgba(C.ink, 0.32 * inP * (1 - outP))}`,
        transform: `scale(${1.25 - 0.25 * inP + 0.5 * outP})`,
        pointerEvents: "none",
        zIndex: 5,
      }}
    />
  );
}

/** 鳴っている間、ボタンから広がる波紋（shower.module.css の .playOn：1.6 秒ごと、二つ目は 0.8 秒遅れ）。 */
export function Ripple({ t, color = C.accent }: { t: number; color?: string }) {
  if (t < 0) return null;
  return (
    <>
      {[0, 24].map((d) => {
        if (t < d) return null;
        const p = ((((t - d) % 48) + 48) % 48) / 48;
        return (
          <span key={d} style={{ position: "absolute", inset: -1, borderRadius: "50%", border: `1.5px solid ${color}`, opacity: 0.55 * (1 - p), transform: `scale(${1 + 0.9 * p})` }} />
        );
      })}
    </>
  );
}

/** 例文の再生ボタン（.play / .playOn）。`play`：鳴りはじめてからのコマ（鳴っていなければ負）。 */
export function PlayButton({ play = -1, size = 44 }: { play?: number; size?: number }) {
  const on = play >= 0;
  return (
    <span
      style={{
        position: "relative",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: "50%",
        border: `1px solid ${on ? C.accent : C.line2}`,
        background: on ? C.accent : C.paper,
        color: on ? "#fff" : C.ink,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name="speaker" size={20} />
      <Ripple t={play} />
    </span>
  );
}

/** 直した文の読み上げ（SpeakButton の solid）。 */
export function SolidSpeak() {
  return (
    <span style={{ flexShrink: 0, width: 44, height: 44, borderRadius: "50%", border: `1px solid ${C.accent}`, background: C.accent, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <Icon name="speaker" size={20} />
    </span>
  );
}

/** ボタン（globals.css の .btn / .btn-quiet：どちらも 52px）。`done`：押したあとの .btn[data-done]。 */
export function Btn({ children, quiet = false, press = -99, done = false, full = false, style }: { children: ReactNode; quiet?: boolean; press?: number; done?: boolean; full?: boolean; style?: CSSProperties }) {
  const pressed = press >= 0 && press < 6;
  return (
    <span
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 52,
        padding: quiet ? "0 20px" : "0 24px",
        borderRadius: 12,
        border: `1px solid ${done ? C.tint : quiet ? C.line2 : C.accent}`,
        background: done ? C.tint : quiet ? C.paper : C.accent,
        color: done ? C.accent : quiet ? C.ink : "#fff",
        fontSize: quiet ? 15 : 16,
        fontWeight: quiet ? 500 : 600,
        fontFamily: FONT.ui,
        transform: pressed ? "scale(0.97)" : undefined,
        alignSelf: full ? "stretch" : "flex-start",
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
      <Press t={press} />
    </span>
  );
}

/** 小さなラベル（globals.css の .label）。 */
export const label: CSSProperties = { margin: 0, fontSize: 13, fontWeight: 600, color: C.muted, fontFamily: FONT.ui };
export const note: CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.7, color: C.muted, fontFamily: FONT.ui };

/** アイコンと、明朝の ことのあめ（../src/components/Logo.tsx。sm：28px と 17px、lg：88px と 40px を縦に）。 */
export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const lg = size === "lg";
  const px = lg ? 88 : 28;
  return (
    <span style={{ display: "inline-flex", flexDirection: lg ? "column" : "row", alignItems: lg ? "flex-start" : "center", gap: lg ? 20 : 10, color: C.ink }}>
      <Img src={staticFile("app/icon.png")} style={{ display: "block", width: px, height: px }} />
      <span style={{ fontFamily: FONT.mincho, fontWeight: 700, fontSize: lg ? 40 : 17, letterSpacing: "0.06em", lineHeight: 1.2 }}>ことのあめ</span>
    </span>
  );
}

/** 打っているところ（使い方の .caret：2px、1.06 秒で点滅）。 */
export function Caret({ frame, color = C.accent }: { frame: number; color?: string }) {
  const on = Math.floor(frame / 16) % 2 === 0;
  return <i style={{ display: "inline-block", width: 2, height: "1.1em", marginLeft: 1, verticalAlign: "-0.15em", background: color, opacity: on ? 1 : 0 }} />;
}

/** 雨の最初の画面の空（shower.module.css の .introSky）：アイコンの雨が、芽に降る。 */
export function Sky({ frame, height = 200 }: { frame: number; height?: number }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", height, borderRadius: 16, background: C.surface, display: "flex", alignItems: "flex-end", justifyContent: "center", flexShrink: 0 }}>
      <Rain frame={frame} />
      <Img src={staticFile("app/sprout.png")} style={{ position: "relative", width: 80, height: "auto", marginBottom: 14 }} />
    </div>
  );
}

/** 浴びるの上：名前と、言葉の組（app.module.css の .topbar と .pair）。 */
export function TopBar({ target = "한국어", targetLang = "ko" }: { target?: string; targetLang?: Lang }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 20px 0" }}>
      <Logo />
      <span style={{ minHeight: 44, padding: "0 16px", border: `1px solid ${C.line2}`, borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: C.ink }}>
        <span style={{ fontFamily: FONT.ja }}>日本語</span>
        <Icon name="arrow" size={16} />
        <span style={{ fontFamily: fontOf(targetLang) }}>{target}</span>
      </span>
    </div>
  );
}

/** 雨の種類（shower.module.css の .sources）：ことのあめ・みんなの雨・単語の雨。 */
export function Sources() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", border: `1px solid ${C.line2}`, borderRadius: 12, overflow: "hidden" }}>
      {["ことのあめ", "みんなの雨", "単語の雨"].map((s, i) => (
        <span
          key={s}
          style={{
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: i === 0 ? C.paper : C.ink2,
            background: i === 0 ? C.ink : undefined,
            fontWeight: i === 0 ? 600 : 400,
            borderLeft: i > 0 ? `1px solid ${C.line2}` : undefined,
          }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

/** チェックボックス（accent-color の青）。 */
function Check({ on }: { on: boolean }) {
  return (
    <span style={{ width: 18, height: 18, borderRadius: 3, border: `1.5px solid ${on ? C.accent : C.faint}`, background: on ? C.accent : C.paper, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {on ? <Icon name="check" size={14} stroke={2.6} /> : null}
    </span>
  );
}

/** 雨の上の帯（.toolbar）：どんなかたちか（はじめて／前にも降った）と、自動で流す・訳を隠す。 */
export function Toolbar({ badge, again = false }: { badge: string; again?: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px 16px" }}>
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: again ? C.again : C.muted }}>{badge}</span>
      <span style={{ display: "flex", gap: 16 }}>
        {(
          [
            ["自動で流す", true],
            ["訳を隠す", false],
          ] as const
        ).map(([name, on]) => (
          <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, fontSize: 13, color: C.ink2 }}>
            <Check on={on} />
            {name}
          </span>
        ))}
      </span>
    </div>
  );
}

// ---- 文（../src/components/SentenceText.tsx と globals.css の .mark・.hl-*） -------------------------------------

/** 文の中の印。mark：共通しているところ（`p` は光りはじめの進み 0〜1）。ins・del：直したところ。memo：メモした語。 */
export type HL = { start: number; end: number; kind: "mark" | "ins" | "del" | "memo"; p?: number };

/** `base`：まわりの字の色（.mark は mark-in で、透きとおった地とまわりの色から、色付きへ）。 */
function hlStyle(kinds: HL[], base: string): CSSProperties {
  const s: CSSProperties = {};
  for (const h of kinds) {
    if (h.kind === "mark") {
      const p = h.p ?? 1;
      if (p <= 0) continue;
      s.background = rgba(C.tint, p);
      s.color = mixColor(base, C.accent, p);
      s.borderRadius = "0.15em";
      s.padding = "0 0.1em";
    }
    if (h.kind === "ins") Object.assign(s, { color: C.accent, fontWeight: 600, textDecoration: "underline", textDecorationThickness: 2, textUnderlineOffset: "0.3em" });
    if (h.kind === "del") Object.assign(s, { color: C.faint, textDecoration: "line-through", textDecorationThickness: 1.5 });
    if (h.kind === "memo") Object.assign(s, { textDecoration: `underline dotted ${C.again}`, textDecorationThickness: 2, textUnderlineOffset: "0.28em" });
  }
  return s;
}

/** 文：印と、字ごとの読み（中国語のピンイン、ルビで）。`color`：文の字の色（#rrggbb）。 */
export function Sent({ text, hl = [], reading = null, color }: { text: string; hl?: HL[]; reading?: string[] | null; color?: string }) {
  const valid = hl.filter((h) => h.start >= 0 && h.end <= text.length && h.start < h.end);
  const cuts = new Set([0, text.length]);
  for (const h of valid) {
    cuts.add(h.start);
    cuts.add(h.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const kinds = valid.filter((h) => h.start <= a && h.end >= b);
    const chars: ReactNode[] = [];
    for (let k = a; k < b; k++) {
      const r = reading?.[k];
      chars.push(
        r ? (
          <ruby key={k}>
            {text[k]}
            <rt style={{ fontFamily: FONT.en, fontSize: "0.42em", fontWeight: 400, color: C.muted, letterSpacing: 0 }}>{r}</rt>
          </ruby>
        ) : (
          text[k]
        ),
      );
    }
    out.push(
      <span key={a} style={hlStyle(kinds, color ?? C.ink)}>
        {chars}
      </span>,
    );
  }
  return <span style={{ color }}>{out}</span>;
}

// ---- 下のタブ（BottomNav）と、雨の飾り（Rain） ---------------------------------------------------------------------

export type Tab = "shower" | "write" | "memo" | "me";

export function BottomNav({ active }: { active: Tab }) {
  const items: [Tab, IconName, string][] = [
    ["shower", "shower", "浴びる"],
    ["write", "pencil", "書いてみる"],
    ["memo", "bookmark", "メモ"],
    ["me", "user", "自分"],
  ];
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", background: C.paper, borderTop: `1px solid ${C.line}`, padding: "4px 8px 8px", zIndex: 8 }}>
      {items.map(([id, icon, name]) => (
        <span key={id} style={{ minHeight: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, fontSize: 11, color: id === active ? C.accent : C.muted, fontWeight: id === active ? 600 : 400 }}>
          <Icon name={icon} size={22} />
          {name}
        </span>
      ))}
    </div>
  );
}

// アプリの雨（../src/components/Rain.tsx）：細い線が、同じ傾きで、二つの深さで降る。種を決めてあるので毎回同じ。
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const rand = seeded(7);
const STREAKS = Array.from({ length: 30 }, (_, i) => {
  const near = i % 3 === 0;
  return {
    left: Math.round(rand() * 1000) / 10,
    len: Math.round(near ? 70 + rand() * 60 : 30 + rand() * 30),
    width: near ? 1.5 : 1,
    opacity: Math.round((near ? 0.45 + rand() * 0.2 : 0.22 + rand() * 0.15) * 100) / 100,
    dur: Math.round((near ? 0.75 + rand() * 0.3 : 1.25 + rand() * 0.4) * 100) / 100,
    delay: -Math.round(rand() * 200) / 100,
    color: rand() < 0.8 ? C.rainSky : C.rainViolet,
  };
});

/** 雨の飾り。`frame`：映像のコマ。`scale`：線の長さと速さ（大きな画面では大きく）。`fade`：0〜1。 */
export function Rain({ frame, scale = 1, fade = 1 }: { frame: number; scale?: number; fade?: number }) {
  const t = frame / 30;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", opacity: fade }}>
      <div style={{ position: "absolute", inset: "-20% -15%", transform: "rotate(9deg)" }}>
        {STREAKS.map((s, i) => {
          const travel = (1500 + 160) * scale;
          const p = (((t - s.delay) / s.dur) % 1 + 1) % 1;
          return (
            <span
              key={i}
              style={{
                position: "absolute",
                top: 0,
                left: `${s.left}%`,
                width: s.width * scale,
                height: s.len * scale,
                borderRadius: 2,
                opacity: s.opacity,
                background: `linear-gradient(transparent, ${s.color})`,
                transform: `translateY(${-160 * scale + p * travel}px)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
