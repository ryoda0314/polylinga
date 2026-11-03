// Pure helpers for the admin's usage pages (/admin, /admin/users), kept free of runtime imports so tests can load them
// directly. Days are YYYY-MM-DD in Japan, like the daily limits and the database functions (pl_admin_*).

import type { Lang } from "@/lib/langs";

/** A learner (an account with ことのあめ settings) and how much of each part they have used. */
export type Learner = {
  id: string;
  name: string | null;
  email: string | null;
  /** How the account signs in: "email" or "google". */
  provider: string;
  createdAt: string;
  lastSignInAt: string | null;
  native: Lang;
  target: Lang;
  tutorialSeen: boolean;
  rainCue: boolean;
  shareRain: boolean;
  /** Left out of the numbers (the admin's own, a test account). */
  excluded: boolean;
  /** Days with a finished rain, a sentence said, a correction or a memo word. */
  activeDays: number;
  firstActive: string | null;
  lastActive: string | null;
  rains: number;
  minnaRains: number;
  patterns: number;
  sayings: number;
  corrections: number;
  explained: number;
  words: number;
  shared: number;
  hearts: number;
};

/** One day of the whole app. The metered counts (aiCorrections, tts, emails) are the whole service's. */
export type DayRow = {
  day: string;
  joined: number;
  active: number;
  firstTime: number;
  rains: number;
  sayings: number;
  corrections: number;
  words: number;
  aiCorrections: number;
  tts: number;
  emails: number;
};

/** One learner's active day. */
export type LearnerDay = {
  day: string;
  rains: number;
  minnaRains: number;
  newPatterns: number;
  sayings: number;
  corrections: number;
  words: number;
};

const DAY_MS = 86_400_000;
// Japan keeps no summer time, so its day is always nine hours ahead of UTC.
const TOKYO_OFFSET_MS = 9 * 3_600_000;

/** The day in Japan of a moment. */
export function tokyoDay(at: Date | string = new Date()): string {
  return new Date(new Date(at).getTime() + TOKYO_OFFSET_MS).toISOString().slice(0, 10);
}

/** `day` moved by `n` days. */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** "今日", "昨日", "3日前" */
export function ago(day: string, today: string): string {
  const n = daysBetween(day, today);
  return n <= 0 ? "今日" : n === 1 ? "昨日" : `${n}日前`;
}

/** "10/26" */
export function shortDay(day: string): string {
  const [, m, d] = day.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** "10/26", or "2025/12/23" for a day of another year than `today`'s. */
export function dayLabel(day: string, today: string): string {
  return day.slice(0, 4) === today.slice(0, 4) ? shortDay(day) : `${day.slice(0, 4)}/${shortDay(day)}`;
}

const WEEKDAYS = "日月火水木金土";

/** "10月26日（日）" */
export function longDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日（${WEEKDAYS[date.getUTCDay()]}）`;
}

/** "10/26 13:05", in Japan. */
export function tokyoTime(at: string): string {
  const shifted = new Date(new Date(at).getTime() + TOKYO_OFFSET_MS).toISOString();
  return `${shortDay(shifted.slice(0, 10))} ${shifted.slice(11, 16)}`;
}

/** "80%", or "–" when there is nothing to divide by. */
export function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–";
}

/** "1,284" */
export function num(n: number): string {
  return n.toLocaleString("ja-JP");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** The numbers at the top of 利用状況, for the learners given (already without the excluded ones, when asked). */
export type Summary = {
  learners: number;
  joinedToday: number;
  joinedWeek: number;
  /** Finished at least one rain (the library's or みんなの雨). */
  bathed: number;
  activeToday: number;
  activeWeek: number;
  activeMonth: number;
  /** Active on two days or more. */
  returned: number;
};

export function summarize(learners: Learner[], today: string): Summary {
  const weekStart = addDays(today, -6);
  const monthStart = addDays(today, -29);
  const joined = learners.map((l) => tokyoDay(l.createdAt));
  const since = (start: string) => learners.filter((l) => l.lastActive !== null && l.lastActive >= start).length;
  return {
    learners: learners.length,
    joinedToday: joined.filter((d) => d === today).length,
    joinedWeek: joined.filter((d) => d >= weekStart).length,
    bathed: learners.filter((l) => l.rains + l.minnaRains > 0).length,
    activeToday: since(today),
    activeWeek: since(weekStart),
    activeMonth: since(monthStart),
    returned: learners.filter((l) => l.activeDays >= 2).length,
  };
}

/** How far learners have come, each step counted over all of them (the steps are not strictly nested). */
export function steps(learners: Learner[]) {
  return {
    started: learners.length,
    bathed: learners.filter((l) => l.rains + l.minnaRains > 0).length,
    said: learners.filter((l) => l.sayings > 0).length,
    twoDays: learners.filter((l) => l.activeDays >= 2).length,
    threeDays: learners.filter((l) => l.activeDays >= 3).length,
  };
}

/** Each part of the app: how many learners used it, and how many times (null where there is nothing to count). */
export function features(learners: Learner[]) {
  const tally = (times: (l: Learner) => number) => ({
    people: learners.filter((l) => times(l) > 0).length,
    times: learners.reduce((n, l) => n + times(l), 0),
  });
  const flag = (on: (l: Learner) => boolean) => ({ people: learners.filter(on).length, times: null });
  return {
    rain: tally((l) => l.rains),
    minna: tally((l) => l.minnaRains),
    said: tally((l) => l.sayings),
    corrections: tally((l) => l.corrections),
    explained: tally((l) => l.explained),
    words: tally((l) => l.words),
    shared: tally((l) => l.shared),
    hearts: tally((l) => l.hearts),
    tutorial: flag((l) => l.tutorialSeen),
    cue: flag((l) => l.rainCue),
    shareOn: flag((l) => l.shareRain),
  };
}

export type Bucket = { from: number; to: number | null; count: number };

/**
 * How many values fall in each range that starts at an edge and runs to the next one: edges [0, 1, 2, 3, 6] make
 * 0, 1, 2, 3–5 and 6 or more.
 */
export function buckets(values: number[], edges: number[]): Bucket[] {
  return edges.map((from, i) => {
    const next = edges[i + 1];
    return {
      from,
      to: next === undefined ? null : next - 1,
      count: values.filter((v) => v >= from && (next === undefined || v < next)).length,
    };
  });
}

/** "0", "3–5", "31+" */
export function bucketLabel(b: Bucket): string {
  if (b.to === null) return `${b.from}+`;
  return b.from === b.to ? String(b.from) : `${b.from}–${b.to}`;
}

/** Learners by the language they learn, most first. */
export function byTarget(learners: Learner[]): { lang: Lang; count: number }[] {
  const counts = new Map<Lang, number>();
  for (const l of learners) counts.set(l.target, (counts.get(l.target) ?? 0) + 1);
  return [...counts].map(([lang, n]) => ({ lang, count: n })).sort((a, b) => b.count - a.count);
}

/** A round top for a count axis and its ticks from 0, in at most `most` whole steps: 0, 10, 20, 30. */
export function niceScale(max: number, most = 4): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const rough = max / most;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? 10 * power);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return { top, ticks };
}

/** How many (people or devices) were there on a weekday (1 Monday … 7 Sunday) at an hour (0–23), Japan time. */
export type WeekHour = { dow: number; hour: number; count: number };

/** Monday first, as the weekdays are read in a week's grid. */
export const WEEKDAY_ROWS = [1, 2, 3, 4, 5, 6, 7].map((dow) => ({ dow, label: "月火水木金土日"[dow - 1] }));

/**
 * The 7 × 24 grid of a week's hours, each cell with its count and its step on a five-step scale (0 when empty, then
 * 1–5 by its share of the busiest cell, rounded up so a single visit still shows).
 */
export function weekGrid(cells: WeekHour[]): { rows: { dow: number; label: string; cells: { hour: number; count: number; level: number }[] }[]; max: number } {
  const counts = new Map(cells.map((c) => [`${c.dow}:${c.hour}`, c.count]));
  const max = Math.max(0, ...cells.map((c) => c.count));
  return {
    max,
    rows: WEEKDAY_ROWS.map(({ dow, label }) => ({
      dow,
      label,
      cells: Array.from({ length: 24 }, (_, hour) => {
        const count = counts.get(`${dow}:${hour}`) ?? 0;
        return { hour, count, level: count > 0 && max > 0 ? Math.max(1, Math.ceil((count / max) * 5)) : 0 };
      }),
    })),
  };
}

/** Which day columns get a date under them, so the labels never crowd on a phone: every k-th from today back. */
export function labelEvery(columns: number): number {
  if (columns <= 14) return 2;
  if (columns <= 31) return 7;
  return 14;
}
