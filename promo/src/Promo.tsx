import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { prog } from "./anim";
import { End } from "./scenes/End";
import { Hook } from "./scenes/Hook";
import { NameMark, TAGLINE } from "./scenes/Mark";
import { Story } from "./scenes/Story";
import { C, FONT, useFonts } from "./theme";
import { CLIP_AT, MEMO_KEYS, MEMO_PER, T, TOTAL, TYPE_PER, VOICE_AT } from "./timeline";
import LIB from "./library.json";
import { Rain } from "./ui";

/** `from` から `to`（コマ）まで見せる。両端は `fade` コマで薄れる。 */
function Window({
  frame,
  from,
  to,
  fade = 12,
  fadeIn = true,
  fadeOut = true,
  children,
}: {
  frame: number;
  from: number;
  to: number;
  fade?: number;
  fadeIn?: boolean;
  fadeOut?: boolean;
  children: React.ReactNode;
}) {
  if (frame < from || frame >= to) return null;
  const opacity = Math.min(fadeIn ? prog(frame, from, fade) : 1, fadeOut ? 1 - prog(frame, to - fade, fade) : 1);
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

/** 映像。 */
export function Promo() {
  useFonts();
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.paper, color: C.ink, fontFamily: FONT.ui, WebkitFontSmoothing: "antialiased" }}>
      <style>{"* { box-sizing: border-box; } ruby { ruby-position: over; }"}</style>
      <Window frame={frame} from={0} to={T.title.start + 8} fadeIn={false} fade={16}>
        <Hook frame={frame} />
      </Window>
      <Window frame={frame} from={T.title.start} to={T.rain.start + 10} fade={14}>
        <Rain frame={frame} scale={1.7} fade={0.32} />
        <NameMark frame={frame} icon={T.title.icon} word={T.title.word} lead={T.title.lead} line={TAGLINE} size={280} top={150} wordSize={104} leadSize={46} />
      </Window>
      <Window frame={frame} from={T.rain.start} to={T.end.start + 10} fade={14}>
        <Story frame={frame} />
      </Window>
      <Window frame={frame} from={T.end.start} to={TOTAL} fade={20} fadeOut={false}>
        <Rain frame={frame} scale={1.7} fade={0.32} />
        <End frame={frame} />
      </Window>
      <Sound />
    </AbsoluteFill>
  );
}

// ---- 音：ナレーション（scripts/voice.mjs）、例文の声（アプリの置き場、public/app）、静かな音楽と小さな音（scripts/music.py） --

const MUSIC = 0.5;
/** 声のあいだ、音楽をどれだけ下げるか（0〜1）。 */
const DUCK = 0.5;

/** 声（ナレーション・例文）が鳴っている所。音楽はここで下がる。 */
const SPEAKING = [...VOICE_AT, ...CLIP_AT];

/** 音楽を下げる度合い（コマごと、0〜1）。声の 4 コマ前から下げはじめ、声が消えてから、ゆっくり戻す。 */
const DUCKING: number[] = (() => {
  const want = new Float32Array(TOTAL);
  for (const v of SPEAKING) for (let i = Math.max(0, v.from - 4); i < Math.min(TOTAL, v.until + 2); i++) want[i] = 1;
  const out: number[] = [];
  let level = 0;
  for (let i = 0; i < TOTAL; i++) {
    level += (want[i] - level) * (want[i] > level ? 0.25 : 0.07);
    out.push(level);
  }
  return out;
})();

function Clip({ from, src, volume = 1, frames }: { from: number; src: string; volume?: number; frames?: number }) {
  return (
    <Sequence from={from} durationInFrames={frames} layout="none">
      <Audio src={staticFile(src)} volume={volume} />
    </Sequence>
  );
}

function Sound() {
  const h = T.hook;
  const r = T.rain;
  const n = T.notice;
  const m = T.memo;
  const tr = T.tri;
  const fx = T.fixed;
  const a = T.again;
  const l = T.langs;
  const hb = T.habit;
  const musicVolume = (frame: number) =>
    MUSIC * interpolate(frame, [0, 20, TOTAL - 75, TOTAL - 4], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * (1 - DUCK * (DUCKING[frame] ?? 0));
  // 冒頭で降ってくる3つの文（鳴らさない文）に、雨粒。
  const drops = [h.s1, h.s2, h.s3];
  const taps = [r.press, n.press, m.tap, m.type - 8, m.save, m.close, tr.press, fx.copy, fx.explain, fx.pick, a.press, l.en, l.zh, hb.pick, hb.save];
  // 打つ：メモの欄に字母を一つずつ、言ってみるの欄に一字ずつ。
  const keys = [
    ...MEMO_KEYS.map((_, k) => m.type + Math.round(k * MEMO_PER * 30)),
    ...[...LIB.say.attempt].map((_, k) => tr.type + Math.round(k * TYPE_PER * 30)),
  ];
  return (
    <>
      <Audio src={staticFile("sound/music.wav")} volume={musicVolume} />
      {VOICE_AT.map((v) => (
        <Clip key={v.id} from={v.from} src={`voice/${v.id}.wav`} />
      ))}
      {CLIP_AT.map((c) => (
        <Clip key={`${c.id}${c.from}`} from={c.from} src={`app/${c.id}.wav`} />
      ))}
      {drops.map((at, i) => (
        <Clip key={`d${at}`} from={at} src={`sound/drop${(i % 3) + 1}.wav`} volume={0.2} />
      ))}
      {[0, 4, 7].map((delay, i) => (
        <Clip key={`t${delay}`} from={T.title.icon + delay + 8} src={`sound/drop${i + 1}.wav`} volume={0.28} />
      ))}
      {[0, 4, 7].map((delay, i) => (
        <Clip key={`e${delay}`} from={T.end.icon + delay + 8} src={`sound/drop${i + 1}.wav`} volume={0.24} />
      ))}
      {taps.map((at) => (
        <Clip key={`p${at}`} from={at - 2} src="sound/tap.wav" volume={0.5} />
      ))}
      {keys.map((at) => (
        <Clip key={`k${at}`} from={at - 1} src="sound/tap.wav" volume={0.3} />
      ))}
      <Clip from={tr.send - 1} src="sound/send.wav" volume={0.32} />
      <Clip from={n.reveal + 2} src="sound/chime.wav" volume={0.24} />
      <Clip from={fx.start + 6} src="sound/chime.wav" volume={0.2} />
    </>
  );
}
