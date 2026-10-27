// 映像に要るものを public/ と src/ に集める。どれもアプリそのものから：
//   - アプリのアイコンと芽の絵（../public/icons/icon-512.png、../public/illustrations/sprout.png）
//   - 例文：アプリと同じライブラリ（pl_sentences・pl_sentence_patterns・pl_functions）を、公開の鍵（anon）で読むだけ。
//     公開済みの文は誰でも読める（RLS：status = 'approved'）。書き込みはしない。→ src/library.json
//   - 例文の声：アプリの公開の置き場（pl-audio、名前は文の sha256：../src/lib/audio.ts）からそのまま。大きさだけ
//     ナレーションにそろえて（山は -1 dBFS まで）WAV に → public/app/<key>.wav、長さは src/clips.json
//   - 言ってみるの例：使い方（/tutorial）の韓国語の例そのまま（../src/lib/tutorial.ts の PICKS.ko）。直したところは
//     アプリの diff（../src/lib/diff.ts）で
//   - 字（IBM Plex Sans JP・IBM Plex Sans KR・Noto Sans SC・しっぽり明朝）。映像に出てくる字だけに切る（Python の fontTools）
//   node scripts/assets.mjs        (npm run assets)
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { diffRanges } from "../../src/lib/diff.ts";

const APP = "..";
const WHOLE = "node_modules/.cache/fonts";
const RAW = "node_modules/.cache/audio";
for (const d of ["public/app", "public/fonts", WHOLE, RAW]) mkdirSync(d, { recursive: true });
copyFileSync(`${APP}/public/icons/icon-512.png`, "public/app/icon.png");
copyFileSync(`${APP}/public/illustrations/sprout.png`, "public/app/sprout.png");

// ---- 例文（使い方の韓国語の雨と同じ：誘う） -----------------------------------------------------------------------

/** 使い方（../src/lib/tutorial.ts の PICKS.ko）の雨、また降ってくる文、メモした語、言ってみるの例。 */
const RAIN = ["내일 카페 갈래?", "주말에 영화 볼래?", "같이 밥 먹을래?", "오늘 노래방 갈래?"];
const AGAIN = ["주말에 바다 갈래?", "불꽃놀이 보러 갈래?"];
const MEMO = "주말";
const SAY = {
  attempt: "주말에 영화 보러 가을래?",
  corrected: "주말에 영화 보러 갈래?",
  meaning: "週末、映画見に行かない？",
  explanation: "「가다」には「을래」ではなく「ㄹ래」が付いて、「갈래」になります。",
  parts: [
    ["주말에", "週末に", "週末"],
    ["영화", "映画", "映画"],
    ["보러", "見に", "見に"],
    ["갈래", "行かない？（誘い）", "行かない？"],
  ],
};
// アプリの例と同じであることを確かめる（アプリの方が変わったら、ここも合わせる）。
const tutorialSource = readFileSync(`${APP}/src/lib/tutorial.ts`, "utf8");
for (const s of [...RAIN, ...AGAIN, MEMO, SAY.attempt, SAY.corrected, SAY.meaning, SAY.explanation, ...SAY.parts.flat()]) {
  if (!tutorialSource.includes(s)) throw new Error(`使い方の例に無い：${s}`);
}
/**
 * 本物の雨は4文（../src/lib/shower.ts の CLUSTER_SIZE）。数日後の雨は、まだ出会っていない同じかたちの文から4つ：使い方の
 * 2文に、ライブラリの同じかたち（ko-eullae）の文を2つ足す。並びは、メモした語の入った文から。
 */
const LATER = [AGAIN[0], "오늘 밤 라멘 먹을래?", AGAIN[1], "이따가 같이 산책할래?"];
const PATTERN = "ko-eullae";
/** 3つの言葉で見せる文（今日カラオケ行かない？）。 */
const KARAOKE = "오늘 노래방 갈래?";

function readEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = readEnv(`${APP}/.env.local`);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!BASE || !ANON) throw new Error("../.env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY が要る");
const read = async (path) => {
  const res = await fetch(`${BASE}/rest/v1/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};
const list = (xs) => encodeURIComponent(`(${xs.map((x) => `"${x}"`).join(",")})`);

const wanted = [...new Set([...RAIN, ...LATER, KARAOKE])];
const rows = await read(`pl_sentences?select=id,ja,en,ko,zh,zh_pinyin&ko=in.${list(wanted)}`);
const byKo = new Map(rows.map((r) => [r.ko, r]));
for (const k of wanted) if (!byKo.has(k)) throw new Error(`ライブラリに無い（公開されていない）：${k}`);
const marks = await read(`pl_sentence_patterns?select=sentence_id,pattern_id,lang,start_index,end_index&sentence_id=in.(${rows.map((r) => r.id).join(",")})`);
for (const k of wanted) {
  if (!marks.some((m) => m.sentence_id === byKo.get(k).id && m.pattern_id === PATTERN)) throw new Error(`${PATTERN} の文ではない：${k}`);
}
const [fn] = await read("pl_functions?select=id,label&id=eq.invite");
const markOf = (id, lang) => {
  const m = marks.find((x) => x.sentence_id === id && x.lang === lang);
  return m ? [m.start_index, m.end_index] : null;
};

// ---- 例文の声 -------------------------------------------------------------------------------------------------------

/** アプリの置き場の声の名前（../src/lib/audio.ts の audioPath と同じ）。 */
const hashOf = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const audioUrl = (text, lang) => `${BASE}/storage/v1/object/public/pl-audio/Kore/${lang}/${hashOf(text)}.wav`;
/**
 * 例文の声の大きさをナレーションにそろえる：声のある所の RMS を -15.5 dBFS（ナレーションの中ほど）に。ただし山は -1 dBFS を
 * 越えさせない（置き場の声には、もう 0 dBFS に届いているものがある：一律に上げると割れる）。
 */
const LEVEL = -15.5;
const CEILING = -1;
/** WAV（16bit・モノ）を読む：かたまりを順に見て fmt と data を探す。 */
function readWav(file) {
  const wav = readFileSync(file);
  let at = 12;
  let rate = 0;
  let bits = 0;
  let channels = 0;
  while (at + 8 <= wav.length) {
    const id = wav.toString("ascii", at, at + 4);
    const size = wav.readUInt32LE(at + 4);
    if (id === "fmt ") {
      channels = wav.readUInt16LE(at + 10);
      rate = wav.readUInt32LE(at + 12);
      bits = wav.readUInt16LE(at + 22);
    }
    if (id === "data") {
      if (bits !== 16 || channels !== 1) throw new Error(`${file}：16bit・モノではない（${bits}bit・${channels}ch）`);
      const pcm = new Int16Array(size / 2);
      for (let i = 0; i < pcm.length; i++) pcm[i] = wav.readInt16LE(at + 8 + i * 2);
      return { rate, pcm };
    }
    at += 8 + size + (size % 2);
  }
  throw new Error(`${file}：data が無い`);
}
function writeWav(file, rate, pcm) {
  const out = Buffer.alloc(44 + pcm.length * 2);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + pcm.length * 2, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) out.writeInt16LE(pcm[i], 44 + i * 2);
  writeFileSync(file, out);
}
const dB = (x) => 20 * Math.log10(Math.max(x, 1e-9));
/** 声のある所（50ms ごとの RMS が -40 dBFS より上）の RMS と、山（dBFS）。 */
function levels(pcm, rate) {
  const hop = Math.round(rate * 0.05);
  let sum = 0;
  let n = 0;
  let peak = 0;
  for (let i = 0; i + hop <= pcm.length; i += hop) {
    let s = 0;
    for (let j = i; j < i + hop; j++) s += (pcm[j] / 32768) ** 2;
    if (dB(Math.sqrt(s / hop)) > -40) {
      sum += s;
      n += hop;
    }
  }
  for (const v of pcm) peak = Math.max(peak, Math.abs(v) / 32768);
  return { rms: dB(Math.sqrt(sum / Math.max(n, 1))), peak: dB(peak) };
}
function level(from, to) {
  const { rate, pcm } = readWav(from);
  const { rms, peak } = levels(pcm, rate);
  const gain = Math.min(LEVEL - rms, CEILING - peak);
  const k = 10 ** (gain / 20);
  writeWav(to, rate, pcm.map((v) => Math.max(-32768, Math.min(32767, Math.round(v * k)))));
  return Math.round((pcm.length / rate) * 1000) / 1000;
}
const clips = {};
async function voice(key, text, lang) {
  // 取ってきた声は、文ごとに（同じ名前の key が別の文になっても取り違えない）。
  const raw = `${RAW}/${lang}-${hashOf(text)}.wav`;
  if (!existsSync(raw)) {
    const res = await fetch(audioUrl(text, lang));
    if (!res.ok) throw new Error(`${text} の声が置き場に無い（${res.status}）`);
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  }
  clips[key] = level(raw, `public/app/${key}.wav`);
  return `app/${key}.wav`;
}

/** 一文：文・訳・光るところ（文と訳）・中国語ならピンイン（字ごと）・声。 */
async function sentence(key, ko, lang = "ko") {
  const r = byKo.get(ko);
  const text = r[lang];
  const pinyin = lang === "zh" && r.zh_pinyin ? readingOf(text, r.zh_pinyin) : null;
  return { key, lang, text, gloss: r.ja, mark: markOf(r.id, lang), glossMark: markOf(r.id, "ja"), reading: pinyin, audio: await voice(key, text, lang) };
}
/** 確かめたピンインを漢字に一つずつ（アプリの readingFor と同じ考え）。 */
function readingOf(text, pinyin) {
  const syl = pinyin.trim().split(/\s+/);
  let k = 0;
  return [...text].map((ch) => (/\p{Script=Han}/u.test(ch) ? (syl[k++] ?? "") : ""));
}

const library = {
  label: fn?.label?.ja ?? "",
  rain: await Promise.all(RAIN.map((ko, i) => sentence(`rain${i + 1}`, ko))),
  again: await Promise.all(LATER.map((ko, i) => sentence(`again${i + 1}`, ko))),
  memo: MEMO,
  karaoke: {
    ko: await sentence("karaoke-ko", KARAOKE, "ko"),
    en: await sentence("karaoke-en", KARAOKE, "en"),
    zh: await sentence("karaoke-zh", KARAOKE, "zh"),
  },
};

// 言ってみるの例：直したところ（アプリの diff）と、詳しく解説の語（使い方と同じ置き方）。
const { removed, added } = diffRanges(SAY.attempt, SAY.corrected, "ko");
let from = 0;
const parts = SAY.parts.map(([word, sense, gloss]) => {
  const at = SAY.corrected.indexOf(word, from);
  from = at + word.length;
  const g = SAY.meaning.indexOf(gloss);
  return { start: at, end: at + word.length, meaning: sense, gloss: g >= 0 ? [g, g + gloss.length] : null };
});
// 直した文の「誘う」の印：ライブラリの文と同じく 갈래。
const said = SAY.corrected.indexOf("갈래");
library.say = { ...SAY, removed, added, parts, mark: [said, said + 2] };

writeFileSync("src/library.json", `${JSON.stringify(library, null, 1)}\n`);
writeFileSync("src/clips.json", `${JSON.stringify(clips, null, 1)}\n`);
console.log(`  例文 ${RAIN.length + LATER.length}、3つの言葉、声 ${Object.keys(clips).length}（${library.label}）`);

// ---- 字 -------------------------------------------------------------------------------------------------------------

/** 字の元：Google Fonts の倉庫（OFL）。取れなければ、姉妹の映像が取ってあるもの、この PC の Noto Sans SC。 */
const FONTS = {
  "IBMPlexSansJP-Regular.ttf": "ibmplexsansjp/IBMPlexSansJP-Regular.ttf",
  "IBMPlexSansJP-Medium.ttf": "ibmplexsansjp/IBMPlexSansJP-Medium.ttf",
  "IBMPlexSansJP-SemiBold.ttf": "ibmplexsansjp/IBMPlexSansJP-SemiBold.ttf",
  "IBMPlexSansKR-Regular.ttf": "ibmplexsanskr/IBMPlexSansKR-Regular.ttf",
  "IBMPlexSansKR-Medium.ttf": "ibmplexsanskr/IBMPlexSansKR-Medium.ttf",
  "IBMPlexSansKR-SemiBold.ttf": "ibmplexsanskr/IBMPlexSansKR-SemiBold.ttf",
  "ShipporiMincho-Bold.ttf": "shipporimincho/ShipporiMincho-Bold.ttf",
  "NotoSansSC-VF.ttf": "notosanssc/NotoSansSC%5Bwght%5D.ttf",
};
const ELSEWHERE = ["../../hangul/promo/node_modules/.cache/fonts", "../../english/promo/node_modules/.cache/fonts", "C:/Windows/Fonts"];

async function whole(file, path) {
  const to = `${WHOLE}/${file}`;
  if (existsSync(to)) return;
  try {
    const res = await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${path}`);
    if (!res.ok) throw new Error(String(res.status));
    writeFileSync(to, Buffer.from(await res.arrayBuffer()));
    console.log(`  font ${file}`);
  } catch (e) {
    const there = ELSEWHERE.map((d) => `${d}/${file}`).find((p) => existsSync(p));
    if (!there) throw new Error(`${file} が取れない（${e.message}）`);
    copyFileSync(there, to);
    console.log(`  font ${file}（${there} から）`);
  }
}

// 映像の元と、例文に出てくる字（と、印字できる ASCII すべて）。
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const chars = new Set(Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)));
for (const file of walk("src")) for (const ch of readFileSync(file, "utf8")) if (ch > "\u007f") chars.add(ch);
writeFileSync(`${WHOLE}/chars.txt`, [...chars].join(""));

for (const [file, path] of Object.entries(FONTS)) {
  await whole(file, path);
  const cut = spawnSync(
    "python",
    ["-m", "fontTools.subset", `${WHOLE}/${file}`, `--text-file=${WHOLE}/chars.txt`, `--output-file=public/fonts/${file}`, "--layout-features=*", "--no-hinting"],
    { encoding: "utf8" },
  );
  if (cut.status !== 0) throw new Error(`cutting ${file} (pip install fonttools): ${cut.stderr}`);
}
console.log(`  fonts cut to ${chars.size} characters`);
