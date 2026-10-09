import assert from "node:assert/strict";
import { test } from "node:test";
import { findMemoHits, nextReturn, wordStage } from "../src/lib/shower-core.ts";

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

test("memo stage: はじめて → 前に見た → 意味が分かる → 使った", () => {
  assert.equal(wordStage({ encounters: 1, uses: 0, understood: false }), "new");
  assert.equal(wordStage({ encounters: 3, uses: 0, understood: false }), "seen");
  assert.equal(wordStage({ encounters: 3, uses: 0, understood: true }), "understood");
  assert.equal(wordStage({ encounters: 1, uses: 1, understood: false }), "used");
});
