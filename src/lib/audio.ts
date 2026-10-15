import "server-only";
import { createHash } from "node:crypto";
import type { Lang } from "@/lib/langs";
import { createAdminClient } from "@/lib/supabase/server";

// Our own bucket: the old app's cleanup job empties tts-audio every week.
export const AUDIO_BUCKET = "pl-audio";
export const VOICE = "Kore";
// Clips are named by their text, so browsers may keep one a while (a rushed clip made again shows within a week).
const CACHE_SECONDS = String(7 * 24 * 60 * 60);

export function audioPath(text: string, lang: Lang): string {
  const hash = createHash("sha256").update(text, "utf8").digest("hex");
  return `${VOICE}/${lang}/${hash}.wav`;
}

/** Public URL of the clip for this text, whether or not it has been generated yet. */
export function audioUrl(text: string, lang: Lang): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AUDIO_BUCKET}/${audioPath(text, lang)}`;
}

export async function clipExists(text: string, lang: Lang): Promise<boolean> {
  const head = await fetch(audioUrl(text, lang), { method: "HEAD", cache: "no-store" }).catch(() => null);
  return Boolean(head?.ok);
}

export async function storeClip(text: string, lang: Lang, wav: Uint8Array): Promise<void> {
  const { error } = await createAdminClient()
    .storage.from(AUDIO_BUCKET)
    .upload(audioPath(text, lang), wav, { contentType: "audio/wav", upsert: true, cacheControl: CACHE_SECONDS });
  if (error) throw new Error(error.message);
}
