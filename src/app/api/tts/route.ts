import { type NextRequest, NextResponse } from "next/server";
import { AUDIO_BUCKET, audioPath, audioUrl } from "@/lib/audio";
import { getSession } from "@/lib/auth";
import { isLang, type Lang } from "@/lib/langs";
import { consume, refund } from "@/lib/metering";
import { createAdminClient } from "@/lib/supabase/server";
import { synthesize } from "@/lib/tts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Makes a clip that is missing from storage. Pages link straight to the stored file first;
// this runs only when that file does not exist yet.
//   GET /api/tts?sentence=<uuid>&lang=ko   an approved library sentence
//   GET /api/tts?correction=<uuid>          the signed-in learner's own corrected sentence
//   GET /api/tts?shared=<uuid>              a sentence raining in みんなの雨 (live ones only)
// Only text that already exists in our data can be read aloud, never text from the request.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const { supabase, user } = await getSession();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  let text: string | null = null;
  let lang: Lang | null = null;

  const correctionId = params.get("correction");
  const sentenceId = params.get("sentence");
  const sharedId = params.get("shared");
  if (sharedId && UUID.test(sharedId)) {
    // Shared sentences are read with the service role; only ones still raining can be read aloud.
    const { data } = await createAdminClient()
      .from("pl_shared")
      .select("text, target_lang, status")
      .eq("id", sharedId)
      .maybeSingle();
    if (data && data.status === "live" && isLang(data.target_lang)) {
      text = data.text;
      lang = data.target_lang;
    }
  } else if (correctionId && UUID.test(correctionId)) {
    // RLS: learners can only read their own corrections.
    const { data } = await supabase
      .from("pl_corrections")
      .select("corrected, target_lang")
      .eq("id", correctionId)
      .maybeSingle();
    if (data && isLang(data.target_lang)) {
      text = data.corrected;
      lang = data.target_lang;
    }
  } else if (sentenceId && UUID.test(sentenceId)) {
    const requested = params.get("lang");
    if (isLang(requested)) {
      // RLS: approved sentences only.
      const { data } = await supabase.from("pl_sentences").select("ja, en, ko, zh").eq("id", sentenceId).maybeSingle();
      if (data) {
        text = (data as Record<Lang, string>)[requested];
        lang = requested;
      }
    }
  }
  if (!text || !lang) return NextResponse.json({ error: "読み上げる文が見つかりません" }, { status: 404 });

  // Someone may have generated it since the page was rendered.
  const url = audioUrl(text, lang);
  const head = await fetch(url, { method: "HEAD", cache: "no-store" }).catch(() => null);
  if (head?.ok) return NextResponse.redirect(url, 302);

  const use = await consume(user.id, "tts");
  if (!use.ok) {
    return NextResponse.json({ error: "今日はこれ以上新しい音声を作れません" }, { status: use.reason === "error" ? 503 : 429 });
  }

  let wav: Uint8Array;
  try {
    wav = await synthesize(text, lang);
  } catch (err) {
    console.error("[tts]", err instanceof Error ? err.message : err);
    await refund(user.id, "tts");
    // The client falls back to the browser's own voice.
    return NextResponse.json({ error: "音声を作れませんでした" }, { status: 503 });
  }

  const { error } = await createAdminClient()
    .storage.from(AUDIO_BUCKET)
    .upload(audioPath(text, lang), wav, { contentType: "audio/wav", upsert: true });
  if (error) console.error("[tts] upload", error.message);

  return new NextResponse(Buffer.from(wav), {
    headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=86400" },
  });
}
