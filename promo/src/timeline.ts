// いつ何が起きるか（秒で決めて、コマにする）。ナレーションの長さはクリップの長さ（src/voice.json：scripts/voice.mjs が
// 書く）から、例文の声は src/clips.json（scripts/assets.mjs）から。声が言い終わってから、次のできごとへ進む。例文の声は、
// ナレーションと重ならない所で鳴らす。ナレーションの中の言葉に合わせるところ（「答え合わせは」で押す、など）は、
// クリップの中の息つぎの位置（秒）で決めてある：声を作り直したら、ここも確かめる。
//
// 見る人：文法は分かるのに、使えない人と、はじめたばかりの人。似た文を浴びて、共通しているところに自分で気づき、そのかたち
// で言ってみて直してもらい、忘れてもまた出会う。その流れ（使い方 /tutorial と同じ順）を、アプリの画面と、ライブラリの本物の
// 例文と声で見せる。言ってみて直してもらうところを見せてから「でも、言葉を知らなかったら？」に答える：材料は浴びた4つの文、
// どれがどの意味かは文を押して語を選べば、ほかの文を見比べて予測できる。そのまま使って、違っていたら直してもらえばいい。
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

  // C3. 言ってみる：「これで言ってみる」。さっきの雨が欄の上に残り、そこから組んだ文（今日は韓国でいちご食べたい）を打って、
  // 直してもらう。
  const tri = { start: notice.end, cap: 0, press: 0, open: 0, type: 0, typed: 0, send: 0, end: 0 };
  tri.cap = tri.start + 0.4;
  tri.press = tri.start + 0.75;
  tri.open = tri.press + 0.15;
  const v06 = say("V06", tri.start + 0.5);
  tri.type = tri.open + 0.85;
  tri.typed = tri.type + [...LIB.say.attempt].length * TYPE_PER;
  tri.send = Math.max(tri.typed + 0.4, v06 + 0.15);
  // 「直しています…」のあいだ（使い方と同じ 1.1 秒）。
  tri.end = tri.send + 1.1;

  // C4. 直った：あなたの文と直した文（에 に 서 を足した）。「どこを」で、どこを直したか。言い終わったら、コピー。
  const fixed = { start: tri.end, cap: 0, why: 0, copy: 0, end: 0 };
  fixed.cap = fixed.start + 0.4;
  const v24 = fixed.start + 0.5;
  fixed.why = v24 + 1.7;
  fixed.copy = say("V24", v24) + 0.25;
  fixed.end = fixed.copy + 1.0;

  // C5. 問い（全面）：添削を見せたあとで「でも、言葉を知らなかったら？」。材料は、いま浴びた4つの文（右に大きく）。「今日は」で
  // 言いたいこと（今日は韓国でいちご食べたい）が出て、「言葉は」で文と訳の中の同じ言葉が光る。「どれが、どの意味」で
  // 三文目の語に「？」。
  const ask = { start: fixed.end, q: 0, mat: 0, want: 0, lit: 0, lit2: 0, which: 0, q1: 0, q2: 0, q3: 0, q4: 0, end: 0 };
  ask.q = ask.start + 0.3;
  const v13 = ask.start + 0.5;
  ask.mat = say("V13", v13) + 0.45;
  const v14 = ask.mat + 0.35;
  const v26 = say("V14", v14) + 0.3;
  ask.want = v26 + 1.3;
  ask.lit = v26 + 4.55;
  ask.lit2 = ask.lit + 0.45;
  const v16 = say("V26", v26) + 0.45;
  ask.which = v16 - 0.1;
  ask.q1 = v16 + 0.95;
  ask.q2 = ask.q1 + 0.22;
  ask.q3 = ask.q2 + 0.22;
  ask.q4 = ask.q3 + 0.22;
  ask.end = say("V16", v16) + 0.5;

  // C6. 予測する：「文を押して」で三文目を押すと語のシート、「単語を選ぶ」で 오늘은 を選ぶと、ほかの文が5つ（少し送って、
  // 5つとも見せる）。「見比べて」で、どの訳にもある「今日は」が光り、「意味を予測する」で、たぶん「今日は」。言い終わったら閉じる。
  const guess = { start: ask.end, cap: 0, tap: 0, sheet: 0, pick: 0, others: 0, slide: 0, predict: 0, compare: 0, guessed: 0, sure: 0, close: 0, end: 0 };
  guess.cap = guess.start + 0.4;
  const v17 = guess.start + 0.5;
  guess.tap = v17 + 1.3;
  guess.sheet = guess.tap + 0.15;
  guess.pick = v17 + 2.68;
  guess.others = guess.pick + 0.3;
  guess.slide = guess.others + 0.7;
  const v18 = say("V17", v17) + 0.25;
  const v19 = say("V18", v18) + 0.4;
  guess.predict = v19 - 0.1;
  guess.compare = v19 + 0.05;
  guess.guessed = v19 + 1.36;
  guess.sure = v19 + 3.5;
  guess.close = say("V19", v19) + 0.2;
  guess.end = guess.close + 0.45;

  // C7. そのまま使って、違っていたら直してもらう：さっきの直った文に戻る（直した文の 서 に線）。「違っていたら」で詳しく解説、
  // 「直してもらえば」で 오늘은 を押すと、오늘은 と「今日は」が光る（予測は合っていた）。
  const back = { start: guess.end, cap: 0, explain: 0, pick: 0, end: 0 };
  back.cap = back.start + 0.3;
  const v23 = back.start + 0.5;
  back.explain = v23 + 1.9;
  back.pick = back.explain + 1.25;
  back.end = Math.max(say("V23", v23) + 0.4, back.pick + 1.8);

  // C8. また出会う：「日をあけて」で日が進み、3日後の雨（前にも降ったかたち）。まだ出会っていない4つの文で。
  const again = { start: back.end, cap: 0, d1: 0, d2: 0, d3: 0, back: 0, press: 0, s1: 0, s2: 0, s3: 0, s4: 0, end: 0 };
  again.cap = again.start + 0.4;
  const v22 = again.start + 0.5;
  again.d1 = v22 + 1.45;
  again.d2 = again.d1 + 0.42;
  again.d3 = again.d2 + 0.42;
  again.back = again.d3 + 0.45;
  again.press = say("V22", v22) + 0.25;
  again.s1 = again.press + 0.3;
  again.s2 = play("again1", again.s1) + GAP;
  again.s3 = play("again2", again.s2) + GAP;
  again.s4 = play("again3", again.s3) + GAP;
  again.end = play("again4", again.s4) + 0.7;

  // C9. 韓国語・英語・中国語：はじめの画面で選べる3つ（言うのに合わせて選ぶ）。同じ文が、それぞれの声で。
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

  return { hook, title, rain, notice, tri, fixed, ask, guess, back, again, langs, habit, end };
}

const S = make();
const frames = <T extends Record<string, number>>(o: T) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)])) as { [K in keyof T]: number };

export const T = {
  hook: frames(S.hook),
  title: frames(S.title),
  rain: frames(S.rain),
  notice: frames(S.notice),
  tri: frames(S.tri),
  fixed: frames(S.fixed),
  ask: frames(S.ask),
  guess: frames(S.guess),
  back: frames(S.back),
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
