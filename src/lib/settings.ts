import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { isAccent, isLang, type Accent, type Lang } from "@/lib/langs";

export type Settings = {
  nativeLang: Lang;
  targetLang: Lang;
  accent: Accent;
  speechRate: number;
  /** Let corrected sentences rain on other learners (みんなの雨). */
  shareRain: boolean;
  /** When the learner last heard that one of their sentences reached someone. */
  reachedSeenAt: string | null;
  /** Their plan for when they bathe in the rain (電車に乗ったら), if they made one. */
  rainCue: string | null;
  /** Whether they have been asked for that plan (asked once, after their first rain). */
  rainCueAsked: boolean;
};

// Launch scope: Japanese speakers learning Korean, English or Chinese.
export const LAUNCH_NATIVE: Lang = "ja";
export const LAUNCH_TARGETS: readonly Lang[] = ["ko", "en", "zh"];

export function isLaunchPair(native: unknown, target: unknown): boolean {
  return native === LAUNCH_NATIVE && isLang(target) && LAUNCH_TARGETS.includes(target);
}

/** The learner's settings, or null before they have chosen a language. */
export const getSettings = cache(async (): Promise<Settings | null> => {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("pl_settings")
    .select("native_lang, target_lang, accent, speech_rate, share_rain, reached_seen_at, rain_cue, rain_cue_asked")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data || !isLaunchPair(data.native_lang, data.target_lang)) return null;
  return {
    nativeLang: data.native_lang as Lang,
    targetLang: data.target_lang as Lang,
    accent: isAccent(data.accent) ? data.accent : "rain",
    speechRate: typeof data.speech_rate === "number" ? data.speech_rate : 1,
    shareRain: data.share_rain === true,
    reachedSeenAt: (data.reached_seen_at as string | null) ?? null,
    rainCue: (data.rain_cue as string | null) ?? null,
    rainCueAsked: data.rain_cue_asked === true,
  };
});

/** Settings for pages inside the app; sends first-time learners to /start. */
export async function requireSettings(): Promise<Settings> {
  const settings = await getSettings();
  if (!settings) redirect("/start");
  return settings;
}
