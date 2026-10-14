import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

export type MeteredKind = "corrections" | "tts";

function envInt(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// Corrections per learner: enough for a few sentences and their second tries on each train ride of the day.
export const LIMITS: Record<MeteredKind, { user: number; global: number }> = {
  corrections: { user: envInt("PL_USER_CORRECTIONS_PER_DAY", 20), global: envInt("PL_GLOBAL_CORRECTIONS_PER_DAY", 1000) },
  tts: { user: 60, global: envInt("PL_GLOBAL_TTS_PER_DAY", 3000) },
};

export type ConsumeResult = { ok: true; left: number } | { ok: false; reason: "user" | "service" | "error" };

/** Count one use. Runs with the service role; learners cannot call the counter themselves. */
export async function consume(userId: string, kind: MeteredKind): Promise<ConsumeResult> {
  const { data, error } = await createAdminClient().rpc("pl_consume_for", {
    uid: userId,
    kind,
    user_limit: LIMITS[kind].user,
    global_limit: LIMITS[kind].global,
  });
  if (error || typeof data !== "number") {
    console.error("[metering]", error?.message);
    return { ok: false, reason: "error" };
  }
  if (data === -1) return { ok: false, reason: "user" };
  if (data === -2) return { ok: false, reason: "service" };
  return { ok: true, left: data };
}

/** Give one use back when the metered call itself failed. */
export async function refund(userId: string, kind: MeteredKind) {
  const { error } = await createAdminClient().rpc("pl_refund_for", { uid: userId, kind });
  if (error) console.error("[metering] refund", error.message);
}

function tokyoToday() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

export async function usesLeft(userId: string, kind: MeteredKind): Promise<number> {
  const { data } = await createAdminClient()
    .from("pl_daily_usage")
    .select(kind)
    .eq("user_id", userId)
    .eq("day", tokyoToday())
    .maybeSingle();
  const used = (data as Record<string, number> | null)?.[kind] ?? 0;
  return Math.max(LIMITS[kind].user - used, 0);
}
