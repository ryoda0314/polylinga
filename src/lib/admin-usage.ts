import "server-only";
import type { DayRow, Learner, LearnerDay } from "@/lib/admin-usage-core";
import { requireAdmin } from "@/lib/auth";
import type { Lang } from "@/lib/langs";
import { createAdminClient } from "@/lib/supabase/server";

// 管理 › 利用状況 and 利用者: the counts behind them, from the pl_admin_* functions
// (supabase/migrations/20261101000000_admin_usage.sql), which only the service role may call. Every loader checks the
// admin itself: a page's data must not depend on its layout having run.

type LearnerRow = {
  user_id: string;
  username: string | null;
  email: string | null;
  provider: string;
  created_at: string;
  last_sign_in_at: string | null;
  native_lang: Lang;
  target_lang: Lang;
  tutorial_seen: boolean;
  rain_cue: boolean;
  share_rain: boolean;
  excluded: boolean;
  active_days: number;
  first_active: string | null;
  last_active: string | null;
  rains: number;
  minna_rains: number;
  patterns: number;
  sayings: number;
  corrections: number;
  explained: number;
  words: number;
  shared: number;
  hearts: number;
};

type DaySqlRow = {
  day: string;
  joined: number;
  active: number;
  first_time: number;
  rains: number;
  sayings: number;
  corrections: number;
  words: number;
  ai_corrections: number;
  tts: number;
  emails: number;
};

type LearnerDaySqlRow = {
  day: string;
  rains: number;
  minna_rains: number;
  new_patterns: number;
  sayings: number;
  corrections: number;
  words: number;
};

function toLearner(r: LearnerRow): Learner {
  return {
    id: r.user_id,
    name: r.username,
    email: r.email,
    provider: r.provider,
    createdAt: r.created_at,
    lastSignInAt: r.last_sign_in_at,
    native: r.native_lang,
    target: r.target_lang,
    tutorialSeen: r.tutorial_seen,
    rainCue: r.rain_cue,
    shareRain: r.share_rain,
    excluded: r.excluded,
    activeDays: r.active_days,
    firstActive: r.first_active,
    lastActive: r.last_active,
    rains: r.rains,
    minnaRains: r.minna_rains,
    patterns: r.patterns,
    sayings: r.sayings,
    corrections: r.corrections,
    explained: r.explained,
    words: r.words,
    shared: r.shared,
    hearts: r.hearts,
  };
}

/** Every learner, excluded ones included (each says whether it is), oldest account first. */
export async function loadLearners(): Promise<Learner[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const out: Learner[] = [];
  // Page by page: the API returns at most 1000 rows per request.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .rpc("pl_admin_learners")
      .order("created_at")
      .order("user_id")
      .range(from, from + 999);
    if (error) throw new Error(`[admin-usage] learners: ${error.message}`);
    const rows = (data ?? []) as LearnerRow[];
    out.push(...rows.map(toLearner));
    if (rows.length < 1000) return out;
  }
}

export async function loadLearner(id: string): Promise<Learner | null> {
  await requireAdmin();
  const { data, error } = await createAdminClient().rpc("pl_admin_learners", { only_user: id });
  if (error) throw new Error(`[admin-usage] learner: ${error.message}`);
  const row = ((data ?? []) as LearnerRow[])[0];
  return row ? toLearner(row) : null;
}

/** The last `span` days, oldest first and today last. */
export async function loadDays(span: number, withExcluded: boolean): Promise<DayRow[]> {
  await requireAdmin();
  const { data, error } = await createAdminClient().rpc("pl_admin_days", {
    span_days: span,
    with_excluded: withExcluded,
  });
  if (error) throw new Error(`[admin-usage] days: ${error.message}`);
  return ((data ?? []) as DaySqlRow[]).map((r) => ({
    day: r.day,
    joined: r.joined,
    active: r.active,
    firstTime: r.first_time,
    rains: r.rains,
    sayings: r.sayings,
    corrections: r.corrections,
    words: r.words,
    aiCorrections: r.ai_corrections,
    tts: r.tts,
    emails: r.emails,
  }));
}

/** One learner's active days, newest first. */
export async function loadLearnerDays(id: string): Promise<LearnerDay[]> {
  await requireAdmin();
  const { data, error } = await createAdminClient().rpc("pl_admin_learner_days", { learner: id });
  if (error) throw new Error(`[admin-usage] learner days: ${error.message}`);
  return ((data ?? []) as LearnerDaySqlRow[]).map((r) => ({
    day: r.day,
    rains: r.rains,
    minnaRains: r.minna_rains,
    newPatterns: r.new_patterns,
    sayings: r.sayings,
    corrections: r.corrections,
    words: r.words,
  }));
}
