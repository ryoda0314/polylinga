// いつ何が起きるか（秒で決めて、コマにする）。ナレーションの長さはクリップの長さ（src/voice.json：scripts/voice.mjs が
// 書く）から、例文の声は src/clips.json（scripts/assets.mjs）から。声が言い終わってから、次のできごとへ進む。例文の声は、
// ナレーションと重ならない所で鳴らす。ナレーションの中の言葉に合わせるところ（「答え合わせは」で押す、など）は、
// クリップの中の息つぎの位置（秒）で決めてある：声を作り直したら、ここも確かめる。
//
// 見る人：文法は分かるのに、使えない人。似た文を浴びて、共通しているところに自分で気づき、そのかたちで言ってみて直して
// もらい、忘れてもまた出会う。その流れ（使い方 /tutorial と同じ順）を、アプリの画面と、ライブラリの本物の例文と声で見せる。
import { f } from "./anim";
import CLIPS from "./clips.json";
import LIB from "./library.json";
import VOICE from "./voice.json";

type VoiceId = keyof typeof VOICE;
export type ClipId = keyof typeof CLIPS;
/** クリップの末尾の余白（声が消えてから残した 250ms と、足した 120ms）。次の声やできごとは、ここに重ねてよい。 */
const TAIL = 0.37;
const said = (id: VoiceId) => VOICE[id] - TAIL;
/** ナレーションを置いた時（秒）。 */
const cues: { id: VoiceId; at: number }[] = [];
const say = (id: VoiceId, at: number) => {
  cues.push({ id, at });
  return at + said(id);
};
/** 例文の声（アプリの置き場のもの）を鳴らす時。 */
const clips: { id: ClipId; at: number }[] = [];
const play = (id: ClipId, at: number) => {
  clips.push({ id, at });
  return at + CLIPS[id];
};
/** 雨の文と文のあいだ（ShowerPlayer の GAP_MS）。 */
const GAP = 0.7;
/** 例の文が欄に一字ずつ入る速さ（使い方の SayStep：85ms）。 */
export const TYPE_PER = 0.085;
/** メモの欄に打つ語：韓国語のキーボードで、字母を一つずつ組み立てていく。 */
export const MEMO_KEYS = ["ㅈ", "주", "줌", "주마", "주말"];
export const MEMO_PER = 0.17;

function make() {
  // A. 問い：「分かる」と「できる」のあいだを埋める。似た文が降ってきて、共通しているところが光る。
  const hook = { start: 0, out: 0, s1: 0, s2: 0, s3: 0, mark: 0, end: 0 };
  hook.out = say("V01", 0.5) + 0.3;
  hook.s1 = hook.out + 0.25;
  hook.s2 = hook.s1 + 0.45;
  hook.s3 = hook.s2 + 0.45;
  const v02 = hook.s1 + 0.2;
  // 「共通しているところに」で光る。
  hook.mark = v02 + 2.45;
  hook.end = say("V02", v02) + 0.55;

  // B. ことのあめ。一行は「ことのはは」のところで。
  const title = { start: hook.end, icon: hook.end + 0.3, word: hook.end + 0.7, lead: 0, end: 0 };
  const v03 = title.word - 0.05;
  title.lead = v03 + 2.0;
  title.end = say("V03", v03) + 0.45;

  // C1. 浴びる：雨の最初の画面。少し下を見て、浴びるを押すと、4つの文が一つずつ、その声で降る。
  const rain = { start: title.end - 0.2, cap: 0, look: 0, press: 0, s1: 0, s2: 0, s3: 0, s4: 0, end: 0 };
  rain.cap = rain.start + 0.4;
  rain.look = rain.start + 2.4;
  rain.press = say("V04", rain.start + 0.5) + 0.2;
  rain.s1 = rain.press + 0.3;
  rain.s2 = play("rain1", rain.s1) + GAP;
  rain.s3 = play("rain2", rain.s2) + GAP;
  rain.s4 = play("rain3", rain.s3) + GAP;
  rain.end = play("rain4", rain.s4) + 0.5;

  // C2. 気づく：見比べて、「答え合わせは」で「共通しているところは？」を押すと、文と訳の同じところが光る。
  const notice = { start: rain.end, cap: 0, press: 0, reveal: 0, end: 0 };
  notice.cap = notice.start + 0.4;
  const v05 = notice.start + 0.5;
  notice.press = v05 + 5.2;
  notice.reveal = notice.press + 0.15;
  notice.end = Math.max(say("V05", v05), notice.reveal + 2.6) + 0.35;

  // C3. メモ：気になった文を押すと、語のシート。「自分の指で打って」のところで打って、メモする。
  const memo = { start: notice.end, cap: 0, tap: 0, sheet: 0, type: 0, typed: 0, save: 0, close: 0, end: 0 };
  memo.cap = memo.start + 0.4;
  memo.tap = memo.start + 0.55;
  memo.sheet = memo.tap + 0.15;
  const v08 = memo.start + 0.5;
  memo.type = v08 + 1.65;
  memo.typed = memo.type + MEMO_KEYS.length * MEMO_PER;
  memo.save = memo.typed + 0.45;
  memo.close = Math.max(memo.save + 1.3, say("V08", v08) + 0.1);
  memo.end = memo.close + 0.45;

  // C4. 言ってみる：「これで言ってみる」。さっきの雨が欄の上に残り、例の文が欄に入って、直してもらう。
  const tri = { start: memo.end, cap: 0, press: 0, open: 0, type: 0, typed: 0, send: 0, end: 0 };
  tri.cap = tri.start + 0.4;
  tri.press = tri.start + 0.75;
  tri.open = tri.press + 0.15;
  const v06 = say("V06", tri.start + 0.5);
  tri.type = tri.open + 0.85;
  tri.typed = tri.type + [...LIB.say.attempt].length * TYPE_PER;
  tri.send = Math.max(tri.typed + 0.4, v06 + 0.15);
  // 「直しています…」のあいだ（使い方と同じ 1.1 秒）。
  tri.end = tri.send + 1.1;

  // C5. 直った：あなたの文と直した文、どこを直したか。「そのまま友だちに」でコピー。詳しく解説で、語と訳の対応。
  const fixed = { start: tri.end, cap: 0, why: 0, copy: 0, explain: 0, pick: 0, end: 0 };
  fixed.cap = fixed.start + 0.4;
  const v07 = fixed.start + 0.5;
  fixed.why = v07 + 1.7;
  fixed.copy = v07 + 5.6;
  fixed.explain = say("V07", v07) + 0.3;
  fixed.pick = fixed.explain + 1.25;
  fixed.end = fixed.pick + 1.7;

  // C6. また出会う：「日をあけて」で日が進み、3日後の雨（前にも降ったかたち）。メモした 주말 も、その中に。
  const again = { start: fixed.end, cap: 0, d1: 0, d2: 0, d3: 0, back: 0, press: 0, s1: 0, s2: 0, s3: 0, s4: 0, end: 0 };
  again.cap = again.start + 0.4;
  const v09 = again.start + 0.5;
  again.d1 = v09 + 1.45;
  again.d2 = again.d1 + 0.42;
  again.d3 = again.d2 + 0.42;
  again.back = again.d3 + 0.45;
  again.press = say("V09", v09) + 0.25;
  again.s1 = again.press + 0.3;
  again.s2 = play("again1", again.s1) + GAP;
  again.s3 = play("again2", again.s2) + GAP;
  again.s4 = play("again3", again.s3) + GAP;
  again.end = play("again4", again.s4) + 0.7;

  // C7. 韓国語・英語・中国語：はじめの画面で選べる3つ（言うのに合わせて選ぶ）。同じ文が、それぞれの声で。
  const langs = { start: again.end, cap: 0, en: 0, zh: 0, ko: 0, enRain: 0, zhRain: 0, end: 0 };
  langs.cap = langs.start + 0.4;
  const v10 = langs.start + 0.5;
  langs.en = v10 + 1.39;
  langs.zh = v10 + 2.32;
  langs.ko = say("V10", v10) + 0.45;
  langs.enRain = play("karaoke-ko", langs.ko + 0.2) + 0.65;
  langs.zhRain = play("karaoke-en", langs.enRain + 0.2) + 0.65;
  langs.end = play("karaoke-zh", langs.zhRain + 0.2) + 0.7;

  // C8. 続ける：いつ浴びるか（使い方の最後の画面）。「毎日していることのあとに」で選び、「決めておきます」で決める。
  const habit = { start: langs.end, cap: 0, pick: 0, save: 0, end: 0 };
  habit.cap = habit.start + 0.4;
  const v11 = habit.start + 0.5;
  habit.pick = v11 + 3.15;
  habit.save = v11 + 5.05;
  habit.end = Math.max(say("V11", v11), habit.save + 1.3) + 0.4;

  // D. 終わり：名前と、「今日の雨を、少し浴びてみる。」（言うところで）、はじめ方。
  const end = { start: habit.end, icon: habit.end + 0.3, word: habit.end + 0.7, lead: 0, rest: 0, end: 0 };
  const v12 = end.word + 0.05;
  end.lead = v12 + 2.05;
  end.rest = end.lead + 0.6;
  end.end = Math.max(end.start + 6, say("V12", v12) + 1.6);

  return { hook, title, rain, notice, memo, tri, fixed, again, langs, habit, end };
}

const S = make();
const frames = <T extends Record<string, number>>(o: T) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)])) as { [K in keyof T]: number };

export const T = {
  hook: frames(S.hook),
  title: frames(S.title),
  rain: frames(S.rain),
  notice: frames(S.notice),
  memo: frames(S.memo),
  tri: frames(S.tri),
  fixed: frames(S.fixed),
  again: frames(S.again),
  langs: frames(S.langs),
  habit: frames(S.habit),
  end: frames(S.end),
};

export const TOTAL = f(S.end.end);

/** ナレーション：クリップと、鳴らしはじめるコマ・声が消えるコマ（音楽はこの間だけ下がる）。 */
export const VOICE_AT = cues.map((c) => ({ id: c.id, from: f(c.at), until: f(c.at + said(c.id)) }));

/** 例文の声：どの声を、どのコマから。 */
export const CLIP_AT = clips.map((c) => ({ id: c.id, from: f(c.at), until: f(c.at + CLIPS[c.id]) }));

/** `id` の声が `frame` に鳴っていれば、鳴りはじめてからのコマ（なければ -1）。 */
export function sounding(frame: number, id: ClipId): number {
  for (const c of CLIP_AT) if (c.id === id && frame >= c.from && frame < c.until) return frame - c.from;
  return -1;
}

/** `id` の声が鳴りはじめるコマ（雨の文は、このとき降ってくる）。 */
export function startOf(id: ClipId): number {
  return CLIP_AT.find((c) => c.id === id)?.from ?? Infinity;
}

/** 音楽の区切り（秒）。scripts/music.py に渡す。 */
export const MUSIC_MARKS = { title: S.title.start, story: S.rain.start, later: S.again.start, end: S.end.start, total: S.end.end };
