// Pre-generate audio for approved example sentences, so learners never wait on TTS in the shower.
// Uses the same bucket and path layout as src/lib/audio.ts. Clips that already exist are skipped.
// By default only the languages learners study at launch (Korean first, then English, Chinese);
// Japanese is only a gloss language for now. Missing clips are still generated on first play.
//   node --env-file=.env.local scripts/generate-audio.mjs                 # ko, en, zh
//   node --env-file=.env.local scripts/generate-audio.mjs --langs=ko      # only these
//   node --env-file=.env.local scripts/generate-audio.mjs --all           # ja too
import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { fetchAll } from "./lib/library.mjs";

const ALL = ["ko", "en", "zh", "ja"];
const langsArg = process.argv.find((a) => a.startsWith("--langs="));
const LANGS = process.argv.includes("--all")
  ? ALL
  : langsArg
    ? langsArg.slice("--langs=".length).split(",").filter((l) => ALL.includes(l))
    : ["ko", "en", "zh"];
const LOCALE = { ja: "ja-JP", en: "en-US", ko: "ko-KR", zh: "zh-CN" };
const BUCKET = "pl-audio";
const VOICE = "Kore";
const MODEL = "gemini-2.5-pro-preview-tts";
const CONCURRENCY = 2;
const RATE_LIMIT_WAIT_MS = 65_000; // Vertex TTS quota is per minute

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

function path(text, lang) {
  return `${VOICE}/${lang}/${createHash("sha256").update(text, "utf8").digest("hex")}.wav`;
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

async function exists(p) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${p}`;
  const res = await fetch(url, { method: "HEAD" });
  return res.ok;
}

async function make({ text, lang }) {
  const p = path(text, lang);
  if (await exists(p)) return "skip";
  const r = await gemini.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text }] }],
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
  const wav = /pcm|l16/i.test(mime) ? pcmToWav(bytes, rate) : bytes;
  const { error } = await supabase.storage.from(BUCKET).upload(p, wav, { contentType: "audio/wav", upsert: true });
  if (error) throw new Error(error.message);
  return "made";
}

const sentences = await fetchAll((a, b) =>
  supabase.from("pl_sentences").select("key, ja, en, ko, zh").eq("status", "approved").order("key").range(a, b),
);
// Language by language, so the first language is ready to use before the next one starts.
const jobs = LANGS.flatMap((lang) => sentences.map((s) => ({ key: s.key, lang, text: s[lang] })));

const counts = { made: 0, skip: 0, failed: 0 };
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    for (let attempt = 1; ; attempt++) {
      try {
        counts[await make(job)]++;
        break;
      } catch (err) {
        if (/RESOURCE_EXHAUSTED|429/.test(err.message) && attempt < 5) {
          await new Promise((r) => setTimeout(r, RATE_LIMIT_WAIT_MS));
          continue;
        }
        counts.failed++;
        console.error(`failed ${job.key}/${job.lang}: ${err.message.slice(0, 200)}`);
        break;
      }
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`made ${counts.made}, already there ${counts.skip}, failed ${counts.failed} (of ${jobs.length})`);
