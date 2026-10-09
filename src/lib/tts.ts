import "server-only";
import { GoogleGenAI } from "@google/genai";
import { VOICE } from "@/lib/audio";
import { LANG_LOCALE, type Lang } from "@/lib/langs";

const TTS_MODEL = "gemini-2.5-pro-preview-tts";

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

/** Synthesize speech and return it as a WAV file. */
export async function synthesize(text: string, lang: Lang): Promise<Uint8Array> {
  const response = await gemini().models.generateContent({
    model: TTS_MODEL,
    contents: [{ role: "user", parts: [{ text }] }],
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
  const isPcm = /pcm|l16/i.test(mimeType);
  return isPcm ? pcm16ToWav(bytes, sampleRate(mimeType)) : bytes;
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
