import assert from "node:assert/strict";
import { test } from "node:test";
import { buildNetwork, fitView, seedNodes, simulate } from "../src/lib/network-core.ts";

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

test("the web settles the same way every time, with no two points on top of each other", () => {
  const net = buildNetwork(seen, [], forms, { now, maxNodes: 50 });
  const index = new Map(net.nodes.map((n, i) => [n.id, i]));
  const links = net.edges.map((e) => ({ i: index.get(e.a), j: index.get(e.b), w: e.weight }));
  const run = () => {
    const nodes = seedNodes(net.nodes.map(() => 6));
    for (let alpha = 1; alpha > 0.01; alpha *= 0.98) simulate(nodes, links, alpha);
    return nodes;
  };
  const one = run();
  assert.deepEqual(one, run());
  for (let i = 0; i < one.length; i++) {
    for (let j = i + 1; j < one.length; j++) assert.ok(Math.hypot(one[i].x - one[j].x, one[i].y - one[j].y) >= 11.9);
  }
});

test("a point held by a finger stays where it is held", () => {
  const nodes = seedNodes([6, 6, 6]);
  nodes[0].fx = 40;
  nodes[0].fy = -20;
  for (let i = 0; i < 50; i++) simulate(nodes, [{ i: 0, j: 1, w: 1 }], 0.5);
  assert.deepEqual([nodes[0].x, nodes[0].y], [40, -20]);
});

test("fitting the view shows every point inside the frame", () => {
  const nodes = [{ x: -100, y: 0, r: 5 }, { x: 300, y: 50, r: 5 }];
  const v = fitView(nodes, 360, 400);
  for (const p of nodes) {
    const sx = p.x * v.k + v.x, sy = p.y * v.k + v.y;
    assert.ok(sx >= 0 && sx <= 360 && sy >= 0 && sy <= 400);
  }
});

test("a word written just like a way of saying's part is the same point (吃 of N + 吃)", () => {
  const x = "我吃苹果", y = "我想吃面";
  const net = buildNetwork(
    [
      sentence("x", x, [piece(x, "我", "我"), piece(x, "吃", "吃"), piece(x, "苹果", "苹果")], [{ patternId: "zh-eat", start: 1, end: 2 }]),
      sentence("y", y, [piece(y, "我", "我"), piece(y, "想", "想"), piece(y, "吃", "吃"), piece(y, "面", "面")], [{ patternId: "zh-want", start: 1, end: 2 }]),
    ],
    [],
    new Map([["zh-eat", "食べる"], ["zh-want", "したい"]]),
    { now, maxNodes: 50 },
  );
  assert.equal(net.nodes.filter((n) => n.label === "吃").length, 1);
  assert.ok(net.edges.some((e) => [e.a, e.b].includes("form:zh-want") && [e.a, e.b].includes("form:zh-eat")));
});
