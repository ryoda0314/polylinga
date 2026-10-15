import "server-only";
import { GoogleGenAI } from "@google/genai";
import { clipExists, storeClip, VOICE } from "@/lib/audio";
import { LANG_LOCALE, type Lang } from "@/lib/langs";

const TTS_MODEL = "gemini-2.5-pro-preview-tts";

// An unhurried, everyday pace. Gemini's pace changes from one generation to the next (the same sentence once came out in
// 0.8 s and the next time in 1.2 s), so each clip is also measured and made again when it is outside the range. (Asking
// for "a pace for learners" overshoots: Flash then speaks at half speed.)
const PACE = "Say this the way a friend would in a relaxed chat, at a natural pace:\n";

// Speech units per second. Above the range a clip sounds rushed (about the fastest tenth of the library's clips);
// below it, it drags or something besides the sentence was read. Keep in step with scripts/generate-audio.mjs.
const PACE_RANGE: Record<Lang, [number, number]> = { ko: [3, 6.5], zh: [2, 4.6], en: [1.5, 3.5], ja: [3, 9] };

/** Syllables for Korean, characters for Chinese and Japanese, words for English. */
function speechUnits(text: string, lang: Lang): number {
  if (lang === "ko") return (text.match(/[가-힣]/g) ?? []).length;
  if (lang === "zh") return (text.match(/[一-鿿]/g) ?? []).length;
  if (lang === "ja") return (text.match(/[ぁ-ヿ一-鿿]/g) ?? []).length;
  return text.split(/\s+/).filter(Boolean).length;
}

/** How far outside the learner's pace a clip is (0 inside it). Very short sentences are not judged. */
function offPace(text: string, lang: Lang, seconds: number | null): number {
  const units = speechUnits(text, lang);
  if (!seconds || units < 4) return 0;
  const speed = units / seconds;
  const [slow, fast] = PACE_RANGE[lang];
  if (speed > fast) return speed / fast - 1;
  if (speed < slow) return slow / speed - 1;
  return 0;
}

function googleAuthOptions() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return undefined; // local: Application Default Credentials
  try {
    return { credentials: JSON.parse(Buffer.from(raw, "base64").toString("utf-8")) };
  } catch {
    return { credentials: JSON.parse(raw.replace(/\\n/g, "\n")) };
  }
}

let client: GoogleGenAI | null = null;
function gemini() {
  if (!client) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    if (!project) throw new Error("GOOGLE_CLOUD_PROJECT is not set");
    client = new GoogleGenAI({
      vertexai: true,
      project,
      location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
      googleAuthOptions: googleAuthOptions(),
    });
  }
  return client;
}

/** One generation, as a WAV file, with its length in seconds when it can be told. */
async function generate(text: string, lang: Lang): Promise<{ wav: Uint8Array; seconds: number | null }> {
  const response = await gemini().models.generateContent({
    model: TTS_MODEL,
    contents: [{ role: "user", parts: [{ text: PACE + text }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        languageCode: LANG_LOCALE[lang],
        voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  const data = part?.inlineData?.data;
  const mimeType = part?.inlineData?.mimeType ?? "";
  if (!data) throw new Error("no audio returned");

  const bytes = new Uint8Array(Buffer.from(data, "base64"));
  if (!/pcm|l16/i.test(mimeType)) return { wav: bytes, seconds: null };
  const rate = sampleRate(mimeType);
  return { wav: pcm16ToWav(bytes, rate), seconds: bytes.length / (rate * 2) };
}

/**
 * Synthesize speech and return it as a WAV file. With more than one try, a rushed clip is made again, and the one
 * closest to a learner's pace is kept.
 */
export async function synthesize(text: string, lang: Lang, tries = 1): Promise<Uint8Array> {
  let best: { wav: Uint8Array; off: number } | null = null;
  for (let i = 0; i < tries; i++) {
    const { wav, seconds } = await generate(text, lang);
    const off = offPace(text, lang, seconds);
    if (off === 0) return wav;
    if (!best || off < best.off) best = { wav, off };
  }
  return best!.wav;
}

/** Make and store the clip for this text unless it is there already: for sentences about to be played (a correction). */
export async function ensureClip(text: string, lang: Lang): Promise<void> {
  if (await clipExists(text, lang)) return;
  await storeClip(text, lang, await synthesize(text, lang, 3));
}

function sampleRate(mimeType: string): number {
  const rate = Number(mimeType.match(/rate=(\d+)/i)?.[1]);
  return Number.isFinite(rate) && rate > 0 ? rate : 24000;
}

function pcm16ToWav(pcm: Uint8Array, rate: number, channels = 1): Uint8Array {
  const blockAlign = channels * 2;
  const buffer = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(buffer);
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, pcm.length, true);
  new Uint8Array(buffer, 44).set(pcm);
  return new Uint8Array(buffer);
}
