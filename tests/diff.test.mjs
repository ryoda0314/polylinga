import assert from "node:assert/strict";
import { test } from "node:test";
import { diffRanges } from "../src/lib/diff.ts";

const pieces = (text, ranges) => ranges.map((r) => text.slice(r.start, r.end));

test("Korean: shows the syllables that changed", () => {
  const before = "내일 같이 카페에 가을래?";
  const after = "내일 같이 카페에 갈래?";
  const { removed, added } = diffRanges(before, after, "ko");
  assert.deepEqual(pieces(before, removed), ["가을"]);
  assert.deepEqual(pieces(after, added), ["갈"]);
});

test("English: a changed word is highlighted whole", () => {
  const before = "I go to school yesterday.";
  const after = "I went to school yesterday.";
  const { removed, added } = diffRanges(before, after, "en");
  assert.deepEqual(pieces(before, removed), ["go"]);
  assert.deepEqual(pieces(after, added), ["went"]);
});

test("English: an inserted word does not drag spaces into the highlight", () => {
  const { removed, added } = diffRanges("I want eat sushi", "I want to eat sushi", "en");
  assert.deepEqual(removed, []);
  assert.deepEqual(pieces("I want to eat sushi", added), ["to"]);
});

test("Japanese: a dropped particle", () => {
  const before = "明日カフェに行かない？";
  const after = "明日カフェ行かない？";
  const { removed, added } = diffRanges(before, after, "ja");
  assert.deepEqual(pieces(before, removed), ["に"]);
  assert.deepEqual(added, []);
});

test("identical sentences have no edits", () => {
  assert.deepEqual(diffRanges("我想去韩国。", "我想去韩国。", "zh"), { removed: [], added: [] });
});

test("whitespace-only edits are ignored", () => {
  assert.deepEqual(diffRanges("내일  카페 갈래?", "내일 카페 갈래?", "ko"), { removed: [], added: [] });
});
