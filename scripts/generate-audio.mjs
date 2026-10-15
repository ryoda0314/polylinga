// Pre-generate audio for approved example sentences, so learners never wait on TTS in the shower.
// Uses the same bucket, path layout and pace check as src/lib/audio.ts and src/lib/tts.ts. Clips that already exist are
// skipped (the bucket is listed once per language). Languages run in the order given, so the first is ready first.
// Japanese is only a gloss language for now. Missing clips are still generated on first play.
// Runs on the Flash TTS model by default: Pro allows only about 10 clips a minute per project, and the app's own
// generation (a missing clip, a learner's correction) needs that quota; a bulk run on Pro starves it. Flash, same voice,
// has its own (in practice about 10 clips a minute too, so the whole library takes most of a day).
//   node --env-file=.env.local scripts/generate-audio.mjs                       # ko, en, zh
//   node --env-file=.env.local scripts/generate-audio.mjs --langs=zh,ko,en      # only these, in this order
//   node --env-file=.env.local scripts/generate-audio.mjs --all                 # ja too
//   node --env-file=.env.local scripts/generate-audio.mjs --redo-fast           # also remake stored clips that are rushed
//   node --env-file=.env.local scripts/generate-audio.mjs --concurrency=4       # more at once (Vertex quota permitting)
//   node --env-file=.env.local scripts/generate-audio.mjs --model=pro           # Pro instead (only while nobody is using the app)
//   node --env-file=.env.local scripts/generate-audio.mjs --dry-run             # only count what would be made
import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { fetchAll } from "./lib/library.mjs";

const ALL = ["ko", "en", "zh", "ja"];
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const LANGS = process.argv.includes("--all")
  ? ALL
  : arg("langs")
    ? arg("langs").split(",").filter((l) => ALL.includes(l))
    : ["ko", "en", "zh"];
const REDO_FAST = process.argv.includes("--redo-fast");
const DRY_RUN = process.argv.includes("--dry-run");
const CONCURRENCY = Math.max(1, Number(arg("concurrency")) || 2);
const LOCALE = { ja: "ja-JP", en: "en-US", ko: "ko-KR", zh: "zh-CN" };
const BUCKET = "pl-audio";
const VOICE = "Kore";
const MODELS = { flash: "gemini-2.5-flash-preview-tts", pro: "gemini-2.5-pro-preview-tts" };
const MODEL = MODELS[arg("model") ?? "flash"] ?? MODELS.flash;
const RATE_LIMIT_WAIT_MS = 10_000; // Vertex TTS quota is per minute: wait a little and try again, staying close to it
const OFFLINE_WAIT_MS = 30_000; // the connection dropped (the PC slept): wait for it instead of failing every job at once
const TRIES = 3;
const CACHE_SECONDS = String(7 * 24 * 60 * 60);

// Pace, as in src/lib/tts.ts: the instruction, speech units per second outside which a clip is made again.
const PACE = "Say this the way a friend would in a relaxed chat, at a natural pace:\n";
const PACE_RANGE = { ko: [3, 6.5], zh: [2, 4.6], en: [1.5, 3.5], ja: [3, 9] };
function speechUnits(text, lang) {
  if (lang === "ko") return (text.match(/[가-힣]/g) ?? []).length;
  if (lang === "zh") return (text.match(/[一-鿿]/g) ?? []).length;
  if (lang === "ja") return (text.match(/[ぁ-ヿ一-鿿]/g) ?? []).length;
  return text.split(/\s+/).filter(Boolean).length;
}
function offPace(text, lang, seconds) {
  const units = speechUnits(text, lang);
  if (!seconds || units < 4) return 0;
  const speed = units / seconds;
  const [slow, fast] = PACE_RANGE[lang];
  if (speed > fast) return speed / fast - 1;
  if (speed < slow) return slow / speed - 1;
  return 0;
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
let credentials;
try {
  credentials = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
} catch {
  credentials = JSON.parse(raw.replace(/\\n/g, "\n"));
}
const gemini = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
  googleAuthOptions: { credentials },
});

function fileName(text) {
  return `${createHash("sha256").update(text, "utf8").digest("hex")}.wav`;
}

function pcmToWav(pcm, rate) {
  const buf = Buffer.alloc(44 + pcm.length);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + pcm.length, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(pcm.length, 40);
  pcm.copy(buf, 44);
  return buf;
}

/** Stored clips of a language, name → seconds (24 kHz 16-bit mono, as Gemini returns them). */
async function storedClips(lang) {
  const clips = new Map();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(`${VOICE}/${lang}`, { limit: 1000, offset });
    if (error) throw new Error(error.message);
    for (const f of data) clips.set(f.name, ((f.metadata?.size ?? 44) - 44) / 48000);
    if (data.length < 1000) break;
  }
  return clips;
}

async function generate(text, lang) {
  const r = await gemini.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: PACE + text }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: { languageCode: LOCALE[lang], voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
    },
  });
  const part = r.candidates?.[0]?.content?.parts?.find((x) => x.inlineData?.data);
  if (!part) throw new Error("no audio");
  const mime = part.inlineData.mimeType ?? "";
  const bytes = Buffer.from(part.inlineData.data, "base64");
  const rate = Number(mime.match(/rate=(\d+)/i)?.[1]) || 24000;
  if (!/pcm|l16/i.test(mime)) return { wav: bytes, seconds: null };
  return { wav: pcmToWav(bytes, rate), seconds: bytes.length / (rate * 2) };
}

async function make({ text, lang }) {
  let best = null;
  for (let i = 0; i < TRIES; i++) {
    const { wav, seconds } = await generate(text, lang);
    const off = offPace(text, lang, seconds);
    if (!best || off < best.off) best = { wav, off };
    if (off === 0) break;
  }
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${VOICE}/${lang}/${fileName(text)}`, best.wav, { contentType: "audio/wav", upsert: true, cacheControl: CACHE_SECONDS });
  if (error) throw new Error(error.message);
  return best.off === 0 ? "made" : "rushed";
}

const sentences = await fetchAll((a, b) =>
  supabase.from("pl_sentences").select("key, ja, en, ko, zh").eq("status", "approved").order("key").range(a, b),
);
const jobs = [];
for (const lang of LANGS) {
  const stored = await storedClips(lang);
  let missing = 0;
  let rushed = 0;
  for (const s of sentences) {
    const text = s[lang];
    if (!text) continue;
    const seconds = stored.get(fileName(text));
    if (seconds === undefined) missing++;
    else if (REDO_FAST && offPace(text, lang, seconds) > 0) rushed++;
    else continue;
    jobs.push({ key: s.key, lang, text });
  }
  console.log(`${lang}: ${missing} missing${REDO_FAST ? `, ${rushed} to make again` : ""}`);
}
if (DRY_RUN) process.exit(0);

const counts = { made: 0, rushed: 0, failed: 0 };
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    for (let attempt = 1; ; attempt++) {
      try {
        counts[await make(job)]++;
        break;
      } catch (err) {
        if (/RESOURCE_EXHAUSTED|429/.test(err.message) && attempt < 30) {
          await new Promise((r) => setTimeout(r, RATE_LIMIT_WAIT_MS));
          continue;
        }
        if (/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up/i.test(err.message) && attempt < 60) {
          await new Promise((r) => setTimeout(r, OFFLINE_WAIT_MS));
          continue;
        }
        counts.failed++;
        console.error(`failed ${job.key}/${job.lang}: ${err.message.slice(0, 200)}`);
        break;
      }
    }
    const done = counts.made + counts.rushed + counts.failed;
    if (done % 50 === 0) console.log(`${done}/${jobs.length} (${job.lang})`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`made ${counts.made}, still rushed after ${TRIES} tries ${counts.rushed}, failed ${counts.failed} (of ${jobs.length})`);
