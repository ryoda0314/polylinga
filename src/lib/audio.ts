import "server-only";
import { createHash } from "node:crypto";
import type { Lang } from "@/lib/langs";

// Our own bucket: the old app's cleanup job empties tts-audio every week.
export const AUDIO_BUCKET = "pl-audio";
export const VOICE = "Kore";

export function audioPath(text: string, lang: Lang): string {
  const hash = createHash("sha256").update(text, "utf8").digest("hex");
  return `${VOICE}/${lang}/${hash}.wav`;
}

/** Public URL of the clip for this text, whether or not it has been generated yet. */
export function audioUrl(text: string, lang: Lang): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AUDIO_BUCKET}/${audioPath(text, lang)}`;
}
