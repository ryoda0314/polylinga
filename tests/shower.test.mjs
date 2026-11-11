import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findMemoHits,
  isDue,
  memoSpans,
  nextReturn,
  rainOrder,
  returnAfterRain,
  sentenceLength,
  wordRainTurn,
  wordStage,
} from "../src/lib/shower-core.ts";

const DAY = 86_400_000;
const now = new Date("2026-10-09T00:00:00Z");
const daysUntil = (iso) => Math.round((new Date(iso).getTime() - now.getTime()) / DAY);

test("a pattern comes back after 1, 3, 7 ... days, capped at 60", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 20].map((times) => daysUntil(nextReturn(times, now))), [1, 3, 7, 14, 30, 60, 60, 60]);
});

test("memo words are found wherever they occur", () => {
  const text = "같이 밥 먹을래? 아니면 같이 산책할래?";
  assert.deepEqual(
    findMemoHits(text, ["같이"]).map((h) => text.slice(h.start, h.end)),
    ["같이", "같이"],
  );
});

test("Latin-script memo words match regardless of case", () => {
  const text = "Wanna grab lunch? I wanna go.";
  assert.equal(findMemoHits(text, ["wanna"]).length, 2);
});

test("blank memo words never match", () => {
  assert.deepEqual(findMemoHits("明天要不要去咖啡厅？", ["", "  "]), []);
});

test("memo stage: はじめて → 前に見た → 使った", () => {
  assert.equal(wordStage({ encounters: 1, uses: 0 }), "new");
  assert.equal(wordStage({ encounters: 3, uses: 0 }), "seen");
  assert.equal(wordStage({ encounters: 1, uses: 1 }), "used");
});

test("a memo word picked from one inflection is met in another by its dictionary form", () => {
  const text = "어제 친구랑 밥 먹었어.";
  const parts = [{ start: 9, end: 12, base: "먹다" }];
  const words = [{ text: "먹을래", base: "먹다" }];
  assert.deepEqual(memoSpans(text, parts, words).map((h) => text.slice(h.start, h.end)), ["먹었어"]);
  assert.deepEqual(memoSpans(text, null, words), []);
});

test("memo words typed in and found by form never light the same place twice", () => {
  const text = "같이 밥 먹자";
  const spans = memoSpans(text, [{ start: 0, end: 2, base: "같이" }], [{ text: "같이", base: "같이" }]);
  assert.deepEqual(spans, [{ start: 0, end: 2 }]);
});

test("among equally plain unseen sentences, one with a memo word rains first", () => {
  const order = rainOrder(
    [
      { id: "plain-short", extra: 0, length: 2, lastSeen: null },
      { id: "plain-memo", extra: 0, length: 5, lastSeen: null, memo: true },
      { id: "rich-memo", extra: 2, length: 2, lastSeen: null, memo: true },
    ],
    () => 0,
  );
  assert.deepEqual(order.map((c) => c.id), ["plain-memo", "plain-short", "rich-memo"]);
});

test("every third rain is ことばの雨", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(wordRainTurn), [false, false, true, false, false, true]);
});

test("a pattern also comes back after 3, 8, 20, 50 ... other rains, capped at 120", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 9].map((times) => returnAfterRain(times, 10) - 10), [3, 8, 20, 50, 120, 120, 120]);
});

test("due when enough rains have fallen or its day has come, whichever first", () => {
  const later = new Date(now.getTime() + DAY).toISOString(), earlier = new Date(now.getTime() - DAY).toISOString();
  assert.equal(isDue({ next_at: later, return_after: 5 }, 4, now.getTime()), false);
  assert.equal(isDue({ next_at: later, return_after: 5 }, 5, now.getTime()), true);
  assert.equal(isDue({ next_at: earlier, return_after: 50 }, 4, now.getTime()), true);
  assert.equal(isDue({ next_at: later, return_after: null }, 999, now.getTime()), false);
});

test("a sentence's length is its words, or its characters in Chinese", () => {
  assert.equal(sentenceLength("내일 카페 갈래?", "ko"), 3);
  assert.equal(sentenceLength("Wanna grab ramen tonight?", "en"), 4);
  assert.equal(sentenceLength("明天要不要去咖啡厅？", "zh"), 9);
  assert.equal(sentenceLength("캠핑장에 있어. 신호가 약해", "ko"), 4);
});

test("unseen sentences rain first, the plainest and shortest of them first", () => {
  const s = (id, extra, length, lastSeen = null) => ({ id, extra, length, lastSeen });
  const order = rainOrder(
    [s("seen-long-ago", 0, 2, 100), s("two-more", 2, 3), s("plain-long", 0, 5), s("one-more", 1, 2), s("plain", 0, 3), s("seen", 0, 2, 200)],
    () => 0,
  );
  assert.deepEqual(
    order.map((c) => c.id),
    ["plain", "plain-long", "one-more", "two-more", "seen-long-ago", "seen"],
  );
});

test("an unjudged sentence counts as carrying one other thing", () => {
  const order = rainOrder(
    [
      { id: "two", extra: 2, length: 2, lastSeen: null },
      { id: "unjudged", extra: null, length: 9, lastSeen: null },
      { id: "plain", extra: 0, length: 9, lastSeen: null },
    ],
    () => 0,
  );
  assert.deepEqual(order.map((c) => c.id), ["plain", "unjudged", "two"]);
});

test("sentences alike in every way rain in a different order by chance", () => {
  const alike = ["a", "b", "c"].map((id) => ({ id, extra: 0, length: 3, lastSeen: null }));
  const draws = [0.9, 0.1, 0.5];
  let i = 0;
  assert.deepEqual(rainOrder(alike, () => draws[i++]).map((c) => c.id), ["b", "c", "a"]);
});
