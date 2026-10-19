"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { correctSentence, explainSentence, type CorrectionResult, type ExplainedPart } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { approvedPatterns, searchCorpus } from "@/lib/corpus";
import { getDict } from "@/lib/i18n";
import { isAccent, isLang, type Lang } from "@/lib/langs";
import { consume, LIMITS, refund } from "@/lib/metering";
import { LAUNCH_NATIVE, LAUNCH_TARGETS, requireSettings } from "@/lib/settings";
import { heartShared, pickMinnaCluster, recordMinna, reportShared, shareCorrection } from "@/lib/minna";
import { withdrawShared } from "@/lib/me";
import { findMemoHits, pickCluster, recordCluster, sentencesWith, type ShowerCluster } from "@/lib/shower";
import { createAdminClient } from "@/lib/supabase/server";
import { ensureClip } from "@/lib/tts";

const MAX_TEXT = 200;

// Zero-width and bidi control characters (U+200B-U+200F, U+2028-U+202F, U+FEFF).
function isInvisible(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202f) || c === 0xfeff;
}

function cleanText(value: unknown): string {
  return Array.from(String(value ?? ""))
    .filter((ch) => !isInvisible(ch))
    .join("")
    .trim();
}

export type FormState = { error: string | null };

// ---------------------------------------------------------------------------
// Shower
// ---------------------------------------------------------------------------

/**
 * Record a cluster once all of it has fallen. It counts as bathed in then, whatever the learner does next (move on,
 * try a sentence, or leave), so the same pattern does not come straight back next time.
 */
export async function recordFinished(finished: { patternId: string; sentenceIds: string[] }, source: "library" | "minna" = "library") {
  const { user } = await requireUser();
  const settings = await requireSettings();
  if (typeof finished?.patternId !== "string" || !Array.isArray(finished.sentenceIds)) return;
  const ids = finished.sentenceIds.map(String);
  if (source === "minna") await recordMinna(user.id, finished.patternId, ids.filter((id) => UUID.test(id)));
  else await recordCluster(user.id, settings.targetLang, finished.patternId, ids);
}

/** The next cluster, avoiding the pattern the learner just had. */
export async function nextCluster(avoidPatternId: string | null, source: "library" | "minna" = "library"): Promise<ShowerCluster | null> {
  const { user } = await requireUser();
  const settings = await requireSettings();
  const avoid = typeof avoidPatternId === "string" ? avoidPatternId : null;
  if (source === "minna") return pickMinnaCluster(user.id, settings.targetLang, settings.nativeLang, avoid);
  return pickCluster(user.id, settings.targetLang, settings.nativeLang, avoid);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 「これ言いたかった」 for another learner's sentence in みんなの雨. */
export async function heartMinna(sharedId: string) {
  const { user } = await requireUser();
  if (typeof sharedId === "string" && UUID.test(sharedId)) await heartShared(user.id, sharedId);
}

/** Report a sentence in みんなの雨: it stops raining at once. */
export async function reportMinna(sharedId: string) {
  const { user } = await requireUser();
  if (typeof sharedId === "string" && UUID.test(sharedId)) await reportShared(user.id, sharedId);
}

/** A plan for when to bathe in the rain (電車に乗ったら), or none. Either way they have been asked. */
export async function setRainCue(cue: string | null) {
  const { supabase, user } = await requireUser();
  const text = typeof cue === "string" ? cleanCue(cue) : null;
  await supabase.from("pl_settings").update({ rain_cue: text, rain_cue_asked: true }).eq("user_id", user.id);
}

/** A plan as the learner wrote it, without a trailing comma or full stop (the page adds 「、ひと雨。」). */
function cleanCue(value: unknown): string | null {
  const text = cleanText(value).replace(/[、。,.\s]+$/u, "").slice(0, 30);
  return text || null;
}

/** The learner has seen that their sentences reached someone. */
export async function markReachedSeen() {
  const { supabase, user } = await requireUser();
  await supabase.from("pl_settings").update({ reached_seen_at: new Date().toISOString() }).eq("user_id", user.id);
}

/** Other sentences with the word, for the word sheet. */
export async function findSentencesWith(word: string, currentSentenceId: string | null) {
  const settings = await requireSettings();
  const w = cleanText(word).slice(0, 40);
  if (!w) return [];
  return sentencesWith(w, settings.targetLang, settings.nativeLang, currentSentenceId);
}

// ---------------------------------------------------------------------------
// Memo: words the learner types in themselves
// ---------------------------------------------------------------------------

export type WordState = { error: string | null; saved: string | null };

export async function saveWord(_prev: WordState, formData: FormData): Promise<WordState> {
  const settings = await requireSettings();
  const t = getDict(settings.nativeLang);
  const { supabase, user } = await requireUser();
  const text = cleanText(formData.get("word"));
  const note = cleanText(formData.get("note")) || null;
  if (!text) return { error: t.words.needWord, saved: null };
  if (text.length > 40 || (note && note.length > 120)) return { error: t.words.tooLong, saved: null };

  const { data: existing } = await supabase
    .from("pl_words")
    .select("id, memo_count, encounters, note")
    .eq("user_id", user.id)
    .eq("lang", settings.targetLang)
    .eq("text", text)
    .maybeSingle();

  // Typing the same word again is welcome: it is one more meeting.
  const { error } = existing
    ? await supabase
        .from("pl_words")
        .update({
          memo_count: existing.memo_count + 1,
          encounters: existing.encounters + 1,
          note: note ?? existing.note,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
    : await supabase.from("pl_words").insert({ user_id: user.id, lang: settings.targetLang, text, note });
  if (error) return { error: t.words.failed, saved: null };

  revalidatePath("/app/memo");
  return { error: null, saved: existing ? t.words.savedAgain(text, existing.memo_count + 1) : t.words.saved(text) };
}

export async function setUnderstood(wordId: string, understood: boolean) {
  const { supabase, user } = await requireUser();
  await supabase.from("pl_words").update({ understood }).eq("id", wordId).eq("user_id", user.id);
  revalidatePath("/app/memo");
}

export async function deleteWord(wordId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("pl_words").delete().eq("id", wordId).eq("user_id", user.id);
  revalidatePath("/app/memo");
}

/** Change what the learner wrote beside a word (empty clears it). */
export async function updateWordNote(wordId: string, raw: string): Promise<{ error: string | null }> {
  const settings = await requireSettings();
  const t = getDict(settings.nativeLang);
  const { supabase, user } = await requireUser();
  const note = cleanText(raw) || null;
  if (note && note.length > 120) return { error: t.words.tooLong };
  const { error } = await supabase.from("pl_words").update({ note }).eq("id", wordId).eq("user_id", user.id);
  if (error) return { error: t.words.failed };
  revalidatePath("/app/memo");
  return { error: null };
}

/** Where a memo word lives: library sentences that contain it, and the learner's own corrected sentences that used it. */
export async function wordPlaces(word: string) {
  const settings = await requireSettings();
  const { supabase, user } = await requireUser();
  const w = cleanText(word).slice(0, 40);
  if (!w) return { rain: [], mine: [] };
  const needle = w.replace(/[%_\\]/g, (c) => `\\${c}`);
  const [rain, { data: mine }] = await Promise.all([
    sentencesWith(w, settings.targetLang, settings.nativeLang, null),
    supabase
      .from("pl_corrections")
      .select("id, saying_id, corrected, created_at")
      .eq("user_id", user.id)
      .eq("target_lang", settings.targetLang)
      .ilike("corrected", `%${needle}%`)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  return {
    rain,
    mine: (mine ?? []).map((c) => ({
      id: String(c.id),
      sayingId: c.saying_id ? String(c.saying_id) : null,
      text: String(c.corrected),
      hits: findMemoHits(String(c.corrected), [w]),
    })),
  };
}

// ---------------------------------------------------------------------------
// Writing and corrections
// ---------------------------------------------------------------------------

type SayingRow = { id: string; intent: string | null; native_lang: Lang; target_lang: Lang; pattern_id: string | null };

/** One correction for a saying, with metering, refunds on failure and memo-word "used" counting. */
async function runCorrection(userId: string, saying: SayingRow, text: string): Promise<FormState> {
  const native = saying.native_lang;
  const target = saying.target_lang;
  const t = getDict(native);

  const use = await consume(userId, "corrections");
  if (!use.ok) {
    if (use.reason === "user") return { error: t.saying.outOfUses(LIMITS.corrections.user) };
    if (use.reason === "service") return { error: t.saying.serviceFull };
    return { error: t.saying.failed };
  }

  let result: CorrectionResult;
  try {
    const patterns = await approvedPatterns(target);
    const practicing = saying.pattern_id ? (patterns.find((p) => p.id === saying.pattern_id)?.form ?? null) : null;
    result = await correctSentence({
      text,
      intent: saying.intent,
      practicing,
      nativeLang: native,
      targetLang: target,
      patterns: patterns.map((p) => ({ id: p.id, form: p.form, meaning: p.meaning[native] ?? p.meaning.en ?? "" })),
    });
  } catch (err) {
    console.error("[correction]", err);
    await refund(userId, "corrections");
    return { error: t.saying.failed };
  }

  // Written with the service role: correction text is what /api/tts will agree to read aloud.
  const admin = createAdminClient();
  const { data: saved, error } = await admin.from("pl_corrections").insert({
    user_id: userId,
    saying_id: saying.id,
    native_lang: native,
    target_lang: target,
    intent: saying.intent,
    input: text,
    corrected: result.corrected,
    result,
  }).select("id").single();
  if (error || !saved) {
    console.error("[correction] save", error?.message);
    await refund(userId, "corrections");
    return { error: t.saying.failed };
  }

  // The corrected sentence is the one they will play next (here and in みんなの雨): its audio is made once the page is
  // on its way, so the speaker does not wait for it. Corrections are already limited per day, so this is not counted.
  after(() =>
    ensureClip(result.corrected, target).catch((err) => console.error("[tts] after correction", err instanceof Error ? err.message : err)),
  );

  // Learners who share let the corrected sentence rain on others (みんなの雨); never let that hold the correction up.
  await shareCorrection({ userId, correctionId: String(saved.id), target, native, result }).catch((err) =>
    console.error("[minna]", err),
  );

  // A memo word that made it into the learner's own corrected sentence has been used.
  const { data: words } = await admin.from("pl_words").select("id, text, uses").eq("user_id", userId).eq("lang", target);
  await Promise.all(
    (words ?? [])
      .filter((w) => findMemoHits(result.corrected, [String(w.text)]).length > 0)
      .map((w) => {
        const now = new Date().toISOString();
        return admin.from("pl_words").update({ uses: w.uses + 1, last_seen_at: now, last_met_at: now }).eq("id", w.id);
      }),
  );
  return { error: null };
}

/** "書いてみる": record what the learner wants to say, look for close examples once, open its page. */
export async function startSaying(_prev: FormState, formData: FormData): Promise<FormState> {
  const settings = await requireSettings();
  const t = getDict(settings.nativeLang);
  const intent = cleanText(formData.get("intent"));
  if (!intent) return { error: t.write.empty };
  if (intent.length > MAX_TEXT) return { error: t.write.tooLong };

  const { supabase, user } = await requireUser();
  let matches: { sentence_id: string; similarity: number }[] = [];
  try {
    matches = await searchCorpus(intent, settings.nativeLang, settings.targetLang);
  } catch (err) {
    // Hints are a bonus; the learner can still write and get a correction.
    console.error("[search]", err);
  }

  const { data, error } = await supabase
    .from("pl_sayings")
    .insert({ user_id: user.id, native_lang: settings.nativeLang, target_lang: settings.targetLang, intent, matches })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[saying]", error?.message);
    return { error: t.write.failed };
  }
  redirect(`/app/s/${data.id}`);
}

/** "これで言ってみる" from the shower: write a sentence with the pattern just bathed in, and get it corrected. */
export async function tryPattern(patternId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const settings = await requireSettings();
  const t = getDict(settings.nativeLang);
  const text = cleanText(formData.get("text"));
  if (!text) return { error: t.saying.empty };
  if (text.length > MAX_TEXT) return { error: t.write.tooLong };

  const { supabase, user } = await requireUser();
  const { data: pattern } = await supabase.from("pl_patterns").select("id").eq("id", patternId).maybeSingle();
  if (!pattern) return { error: t.saying.failed };

  const { data: saying, error } = await supabase
    .from("pl_sayings")
    .insert({
      user_id: user.id,
      native_lang: settings.nativeLang,
      target_lang: settings.targetLang,
      intent: null,
      pattern_id: pattern.id,
    })
    .select("id, intent, native_lang, target_lang, pattern_id")
    .single();
  if (error || !saying) return { error: t.saying.failed };

  const res = await runCorrection(user.id, saying as SayingRow, text);
  if (res.error) {
    await supabase.from("pl_sayings").delete().eq("id", saying.id);
    return res;
  }
  redirect(`/app/s/${saying.id}`);
}

/**
 * 詳しく解説 for one of the learner's own corrections: made by the AI the first time they ask, then kept with the
 * correction, so each correction costs at most one more call.
 */
export async function explainCorrection(correctionId: string): Promise<{ parts: ExplainedPart[] | null; error: string | null }> {
  const { supabase, user } = await requireUser();
  const t = getDict(LAUNCH_NATIVE);
  if (typeof correctionId !== "string" || !UUID.test(correctionId)) return { parts: null, error: t.saying.explainFailed };
  // RLS: a learner reads only their own corrections.
  const { data: row } = await supabase
    .from("pl_corrections")
    .select("id, corrected, result, native_lang, target_lang")
    .eq("id", correctionId)
    .maybeSingle();
  if (!row || !isLang(row.native_lang) || !isLang(row.target_lang)) return { parts: null, error: t.saying.explainFailed };
  const result = row.result as CorrectionResult;
  if (result.breakdown?.length) return { parts: result.breakdown, error: null };

  let parts: ExplainedPart[];
  try {
    parts = await explainSentence({
      text: String(row.corrected),
      translation: result.meaning ?? "",
      nativeLang: row.native_lang,
      targetLang: row.target_lang,
    });
  } catch (err) {
    console.error("[explain]", err);
    return { parts: null, error: getDict(row.native_lang).saying.explainFailed };
  }
  // Kept with the correction (written with the service role, like the correction itself).
  const { error } = await createAdminClient()
    .from("pl_corrections")
    .update({ result: { ...result, breakdown: parts } })
    .eq("id", row.id)
    .eq("user_id", user.id);
  if (error) console.error("[explain] save", error.message);
  return { parts, error: null };
}

/**
 * Delete one thing the learner wrote, with its corrections (and so anything of it raining in みんなの雨). `leave`
 * goes back to 書いてみる afterwards, for when they delete it from its own page.
 */
export async function deleteSaying(sayingId: string, leave = false) {
  const { supabase, user } = await requireUser();
  if (typeof sayingId !== "string" || !UUID.test(sayingId)) return;
  await supabase.from("pl_sayings").delete().eq("id", sayingId).eq("user_id", user.id);
  revalidatePath("/app/write");
  revalidatePath("/app/me");
  if (leave === true) redirect("/app/write");
}

/** Delete everything the learner has written in the language they are learning now. */
export async function deleteAllSayings() {
  const { supabase, user } = await requireUser();
  const settings = await requireSettings();
  await supabase.from("pl_sayings").delete().eq("user_id", user.id).eq("target_lang", settings.targetLang);
  revalidatePath("/app/write");
  revalidatePath("/app/me");
}

/** Correct one more attempt for an existing saying. The page re-renders from the stored correction. */
export async function correctSaying(sayingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const { data: saying } = await supabase
    .from("pl_sayings")
    .select("id, intent, native_lang, target_lang, pattern_id")
    .eq("id", sayingId)
    .maybeSingle();
  const native: Lang = isLang(saying?.native_lang) ? saying.native_lang : LAUNCH_NATIVE;
  const t = getDict(native);
  if (!saying || !isLang(saying.target_lang)) return { error: t.saying.failed };

  const text = cleanText(formData.get("text"));
  if (!text) return { error: t.saying.empty };
  if (text.length > MAX_TEXT) return { error: t.write.tooLong };

  const res = await runCorrection(user.id, saying as SayingRow, text);
  if (!res.error) revalidatePath(`/app/s/${saying.id}`);
  return res;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type SettingsState = { message: string | null; error: boolean };

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { supabase, user } = await requireUser();
  const t = getDict(LAUNCH_NATIVE);
  const target = formData.get("target_lang");
  const accent = formData.get("accent");
  const rate = Number(formData.get("speech_rate"));
  if (!isLang(target) || !LAUNCH_TARGETS.includes(target) || !isAccent(accent)) {
    return { message: t.me.invalid, error: true };
  }

  const { error } = await supabase.from("pl_settings").upsert({
    user_id: user.id,
    native_lang: LAUNCH_NATIVE,
    target_lang: target,
    accent,
    speech_rate: [0.75, 1, 1.25].includes(rate) ? rate : 1,
    share_rain: formData.get("share_rain") === "on",
    rain_cue: cleanCue(formData.get("rain_cue")),
    rain_cue_asked: true,
    updated_at: new Date().toISOString(),
  });
  if (error) return { message: t.me.saveFailed, error: true };

  revalidatePath("/app", "layout");
  return { message: t.me.saved, error: false };
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/");
}

/** Stop one of the learner's own sentences raining in みんなの雨. */
export async function withdrawMine(sharedId: string) {
  const { user } = await requireUser();
  if (typeof sharedId !== "string" || !UUID.test(sharedId)) return;
  await withdrawShared(user.id, sharedId);
  revalidatePath("/app/me");
}
