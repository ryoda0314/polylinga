import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ago,
  addDays,
  bucketLabel,
  buckets,
  byTarget,
  dayLabel,
  daysBetween,
  features,
  isUuid,
  labelEvery,
  longDay,
  niceScale,
  percent,
  steps,
  summarize,
  tokyoDay,
  tokyoTime,
} from "../src/lib/admin-usage-core.ts";

const learner = (over) => ({
  id: "00000000-0000-4000-8000-000000000000",
  name: "a",
  email: "a@example.com",
  provider: "email",
  createdAt: "2026-10-20T03:00:00.000Z",
  lastSignInAt: null,
  native: "ja",
  target: "ko",
  tutorialSeen: false,
  rainCue: false,
  shareRain: false,
  excluded: false,
  activeDays: 0,
  firstActive: null,
  lastActive: null,
  rains: 0,
  minnaRains: 0,
  patterns: 0,
  sayings: 0,
  corrections: 0,
  explained: 0,
  words: 0,
  shared: 0,
  hearts: 0,
  ...over,
});

test("days are Japan's: 0:00 JST is 15:00 UTC the day before", () => {
  assert.equal(tokyoDay("2026-10-31T14:59:59Z"), "2026-10-31");
  assert.equal(tokyoDay("2026-10-31T15:00:00Z"), "2026-11-01");
  assert.equal(tokyoTime("2026-10-26T01:04:00Z"), "10/26 10:04");
});

test("days move across month ends", () => {
  assert.equal(addDays("2026-11-01", -1), "2026-10-31");
  assert.equal(addDays("2026-10-26", 6), "2026-11-01");
  assert.equal(daysBetween("2026-10-26", "2026-11-01"), 6);
});

test("day labels", () => {
  assert.equal(longDay("2026-10-26"), "10月26日（月）");
  assert.equal(longDay("2026-11-01"), "11月1日（日）");
  assert.equal(dayLabel("2026-10-26", "2026-11-01"), "10/26");
  assert.equal(dayLabel("2025-12-23", "2026-11-01"), "2025/12/23");
  assert.deepEqual(["2026-11-01", "2026-10-31", "2026-10-29"].map((d) => ago(d, "2026-11-01")), ["今日", "昨日", "3日前"]);
});

test("percent has nothing to divide by when there is no one", () => {
  assert.equal(percent(40, 50), "80%");
  assert.equal(percent(0, 0), "–");
});

test("summary: joined and active are counted by Japan's day, the week and month include today", () => {
  const today = "2026-11-01";
  const learners = [
    // Joined at 00:30 JST today, bathed today.
    learner({ createdAt: "2026-10-31T15:30:00Z", rains: 3, activeDays: 1, lastActive: "2026-11-01" }),
    // Joined six days ago (inside the week), came back on another day, last active six days ago.
    learner({ createdAt: "2026-10-26T01:00:00Z", rains: 1, minnaRains: 1, activeDays: 2, lastActive: "2026-10-26" }),
    // Joined seven days ago (outside the week); said something, never bathed; active 29 days ago.
    learner({ createdAt: "2026-10-25T01:00:00Z", sayings: 1, activeDays: 1, lastActive: "2026-10-03" }),
    // Never did anything.
    learner({ createdAt: "2026-09-01T01:00:00Z" }),
  ];
  assert.deepEqual(summarize(learners, today), {
    learners: 4,
    joinedToday: 1,
    joinedWeek: 2,
    bathed: 2,
    activeToday: 1,
    activeWeek: 2,
    activeMonth: 3,
    returned: 1,
  });
  assert.deepEqual(steps(learners), { started: 4, bathed: 2, said: 1, twoDays: 1, threeDays: 0 });
});

test("features count the people who used a part and how often", () => {
  const use = features([
    learner({ rains: 5, words: 2, tutorialSeen: true }),
    learner({ rains: 1, sayings: 3, explained: 1, shareRain: true }),
    learner({}),
  ]);
  assert.deepEqual(use.rain, { people: 2, times: 6 });
  assert.deepEqual(use.said, { people: 1, times: 3 });
  assert.deepEqual(use.words, { people: 1, times: 2 });
  assert.deepEqual(use.tutorial, { people: 1, times: null });
  assert.deepEqual(use.shareOn, { people: 1, times: null });
});

test("buckets run from each edge to the next, the last one open", () => {
  const b = buckets([0, 0, 1, 2, 3, 5, 6, 40], [0, 1, 2, 3, 6]);
  assert.deepEqual(
    b.map((x) => [bucketLabel(x), x.count]),
    [
      ["0", 2],
      ["1", 1],
      ["2", 1],
      ["3–5", 2],
      ["6+", 2],
    ],
  );
});

test("languages, most learners first", () => {
  const t = byTarget([learner({ target: "zh" }), learner({ target: "ko" }), learner({ target: "ko" })]);
  assert.deepEqual(t, [
    { lang: "ko", count: 2 },
    { lang: "zh", count: 1 },
  ]);
});

test("axes end on a round number in whole steps", () => {
  assert.deepEqual(niceScale(0), { top: 1, ticks: [0, 1] });
  assert.deepEqual(niceScale(3), { top: 3, ticks: [0, 1, 2, 3] });
  assert.deepEqual(niceScale(21), { top: 30, ticks: [0, 10, 20, 30] });
  assert.deepEqual(niceScale(63), { top: 80, ticks: [0, 20, 40, 60, 80] });
  assert.deepEqual(niceScale(1000), { top: 1000, ticks: [0, 500, 1000] });
});

test("date labels thin out as the period grows", () => {
  assert.deepEqual([14, 30, 90].map(labelEvery), [2, 7, 14]);
});

test("only a UUID names a learner", () => {
  assert.ok(isUuid("c5f0b2e6-1350-400c-aff0-5f0f81924716"));
  assert.ok(!isUuid("c5f0b2e6"));
  assert.ok(!isUuid("../admin"));
});

test("a week's grid: Monday first, empty hours at 0, a single visit still shows, the busiest at 5", async () => {
  const { weekGrid } = await import("../src/lib/admin-usage-core.ts");
  const { rows, max } = weekGrid([
    { dow: 7, hour: 19, count: 100 },
    { dow: 1, hour: 8, count: 1 },
    { dow: 3, hour: 12, count: 50 },
  ]);
  assert.equal(max, 100);
  assert.deepEqual(rows.map((r) => r.label).join(""), "月火水木金土日");
  assert.equal(rows.every((r) => r.cells.length === 24), true);
  assert.equal(rows[6].cells[19].level, 5);
  assert.equal(rows[0].cells[8].level, 1);
  assert.equal(rows[2].cells[12].level, 3);
  assert.equal(rows[0].cells[9].level, 0);
  assert.deepEqual(weekGrid([]).max, 0);
});
