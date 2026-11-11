import assert from "node:assert/strict";
import { test } from "node:test";
import { buildNetwork, layoutNetwork } from "../src/lib/network-core.ts";

const now = Date.parse("2026-11-12T03:00:00Z");
const DAY = 86_400_000;
const piece = (text, sub, base, kind = "word", meaning = null) => {
  const start = text.indexOf(sub);
  return { start, end: start + sub.length, base, kind, meaning };
};
const sentence = (id, text, pieces, marks, extra = {}) => ({ id, text, gloss: "", pieces, marks, times: 2, lastAt: now - 3 * DAY, ...extra });

const a = "밥 먹고 싶어";
const b = "같이 영화 보고 싶어";
const seen = [
  sentence("a", a, [piece(a, "밥", "밥", "word", "ごはん"), piece(a, "먹고", "먹다", "word", "食べ"), piece(a, "싶어", "싶다")], [
    { patternId: "ko-want", start: a.indexOf("고 싶어"), end: a.length },
  ]),
  sentence("b", b, [piece(b, "같이", "같이"), piece(b, "영화", "영화"), piece(b, "보고", "보다"), piece(b, "싶어", "싶다")], [
    { patternId: "ko-want", start: b.indexOf("고 싶어"), end: b.length },
  ], { times: 1, lastAt: now - 60_000 }),
];
const forms = new Map([["ko-want", "したいことを言う"]]);

test("ways of saying join the words around them, and words the words next to them", () => {
  const net = buildNetwork(seen, [], forms, { now, maxNodes: 50 });
  const ids = net.nodes.map((n) => n.id).sort();
  // 싶어 lies inside the way of saying's part, so it is not a word of its own.
  assert.deepEqual(ids, ["form:ko-want", "word:같이", "word:먹다", "word:밥", "word:보다", "word:영화"]);
  assert.equal(net.nodes.find((n) => n.id === "form:ko-want").label, "고 싶어");
  assert.equal(net.nodes.find((n) => n.id === "form:ko-want").weight, 2);
  const has = (x, y) => net.edges.some((e) => (e.a === x && e.b === y) || (e.a === y && e.b === x));
  assert.ok(has("form:ko-want", "word:밥"));
  assert.ok(has("word:밥", "word:먹다"));
  assert.ok(!has("word:밥", "word:영화"));
});

test("a line first met today lights up; an older one does not", () => {
  const net = buildNetwork(seen, [], forms, { now, maxNodes: 50 });
  const edge = (x, y) => net.edges.find((e) => (e.a === x && e.b === y) || (e.a === y && e.b === x));
  assert.equal(edge("word:같이", "word:영화").fresh, true);
  assert.equal(edge("word:밥", "word:먹다").fresh, false);
  assert.equal(edge("word:밥", "word:먹다").daysAgo, 3);
});

test("the learner's own sentence makes its words and lines solid, found by how they were written in the rain", () => {
  const net = buildNetwork(seen, [{ text: "영화 보고 싶어", patternIds: ["ko-want"] }], forms, { now, maxNodes: 50 });
  const edge = (x, y) => net.edges.find((e) => (e.a === x && e.b === y) || (e.a === y && e.b === x));
  assert.equal(net.nodes.find((n) => n.id === "word:영화").said, true);
  assert.equal(net.nodes.find((n) => n.id === "word:밥").said, false);
  assert.equal(edge("form:ko-want", "word:영화").said, true);
  assert.equal(edge("word:영화", "word:보다").said, true);
  assert.equal(edge("word:밥", "word:먹다").said, false);
});

test("only the points met most are kept, with the lines among them", () => {
  const net = buildNetwork(seen, [], forms, { now, maxNodes: 1 });
  assert.deepEqual(net.nodes.map((n) => n.id), ["form:ko-want"]);
  assert.equal(net.edges.length, 0);
});

test("the layout is the same every time and stays inside the frame", () => {
  const net = buildNetwork(seen, [], forms, { now, maxNodes: 50 });
  const one = layoutNetwork(net.nodes, net.edges, 360, 280);
  const two = layoutNetwork(net.nodes, net.edges, 360, 280);
  assert.deepEqual([...one], [...two]);
  for (const { x, y } of one.values()) assert.ok(x >= 24 && x <= 336 && y >= 24 && y <= 256);
});
