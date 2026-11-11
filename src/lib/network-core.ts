// ことばの網: the learner's own web of words and ways of saying, as the rain has grown it. Pure helpers, kept free of
// imports so tests can load them directly (the loader is network.ts, the drawing WordNetwork.tsx).
//
// What a native speaker has and a learner grows here is not rules but company: which words come with which ways of
// saying, and with which other words (먹고 싶어, 같이 가자). So a point is a word (by its dictionary form) or a way of
// saying (by its part as it appears in sentences), and a line joins two that came together in a sentence the learner
// bathed in. Everything is in the language learned; meanings are there only for when a point is pressed.

const DAY = 86_400_000;

/** A piece of a sentence the learner bathed in (語のまとまり, or the browser's split where there is none yet). */
export type NetPiece = { start: number; end: number; base: string; kind: "word" | "function"; meaning: string | null };
/** Where a way of saying is in that sentence. */
export type NetMark = { patternId: string; start: number; end: number };
export type SeenSentence = {
  id: string;
  text: string;
  gloss: string;
  pieces: NetPiece[];
  marks: NetMark[];
  /** How often the learner has had it, and when last (ms). */
  times: number;
  lastAt: number;
};
/** One of the learner's own corrected sentences: its text and the ways of saying the correction found in it. */
export type SaidSentence = { text: string; patternIds: string[] };

export type NetNode = {
  id: string;
  kind: "form" | "word";
  /** As it appears in the language learned: a word's dictionary form, a way of saying's usual part (고 싶어). */
  label: string;
  /** For when it is pressed: what the word means, or what the way of saying does, in the learner's language. */
  meaning: string | null;
  /** The sentences it was in. */
  weight: number;
  /** The learner has used it in a sentence of their own. */
  said: boolean;
  /** For a way of saying, its pattern (its page in 自分). */
  patternId: string | null;
};
export type NetEdge = {
  a: string;
  b: string;
  /** Sentences they were in together. */
  weight: number;
  /** Together in a sentence of the learner's own: the line is solid. */
  said: boolean;
  /** First came together today: the line lights up. */
  fresh: boolean;
  /** Whole days since they last came together, so a line not met for a while is fainter (never gone). */
  daysAgo: number;
};
export type NetSentence = { text: string; gloss: string; nodes: string[] };
export type Network = { nodes: NetNode[]; edges: NetEdge[]; sentences: NetSentence[] };

const formId = (patternId: string) => `form:${patternId}`;
const wordId = (base: string) => `word:${base.toLowerCase()}`;
const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function sameDay(a: number, b: number) {
  // Days are the learner's days in Japan, as everywhere in 自分.
  const day = (ms: number) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10);
  return day(a) === day(b);
}

/** The most common of some values, the first one met on a tie. */
function mostCommon(values: string[]): string | null {
  const count = new Map<string, number>();
  for (const v of values) count.set(v, (count.get(v) ?? 0) + 1);
  let best: string | null = null;
  for (const [v, n] of count) if (best === null || n > count.get(best)!) best = v;
  return best;
}

/**
 * Build the web from the sentences the learner bathed in and the ones they said. A way of saying joins every word of
 * the sentence (outside its own part), and each word joins the word next to it; the small grammar pieces are left to
 * the ways of saying. Only the `maxNodes` points met most are kept, with the lines among them.
 */
export function buildNetwork(
  seen: SeenSentence[],
  said: SaidSentence[],
  forms: Map<string, string | null>,
  opts: { now: number; maxNodes: number },
): Network {
  const labels = new Map<string, string[]>();
  const meanings = new Map<string, string[]>();
  const weight = new Map<string, number>();
  const edges = new Map<string, { a: string; b: string; weight: number; lastAt: number; allFirst: boolean }>();
  const surfaces = new Map<string, string>(); // a word as written in a sentence → its point
  const sentences: { text: string; gloss: string; nodes: string[] }[] = [];

  const join = (a: string, b: string, s: SeenSentence) => {
    if (a === b) return;
    const k = edgeKey(a, b);
    const e = edges.get(k) ?? { a, b, weight: 0, lastAt: 0, allFirst: true };
    e.weight++;
    e.lastAt = Math.max(e.lastAt, s.lastAt);
    e.allFirst = e.allFirst && s.times === 1 && sameDay(s.lastAt, opts.now);
    edges.set(k, e);
  };

  for (const s of seen) {
    const marks = s.marks.filter((m) => forms.has(m.patternId));
    const inMark = (p: NetPiece) => marks.some((m) => p.start >= m.start && p.end <= m.end);
    const words = s.pieces.filter((p) => p.kind === "word" && !inMark(p)).sort((a, b) => a.start - b.start);
    const here = new Set<string>();
    for (const m of marks) {
      const id = formId(m.patternId);
      labels.set(id, [...(labels.get(id) ?? []), s.text.slice(m.start, m.end).trim()]);
      here.add(id);
    }
    for (const p of words) {
      const id = wordId(p.base);
      labels.set(id, [...(labels.get(id) ?? []), p.base]);
      if (p.meaning) meanings.set(id, [...(meanings.get(id) ?? []), p.meaning]);
      surfaces.set(s.text.slice(p.start, p.end).toLowerCase(), id);
      here.add(id);
    }
    for (const id of here) weight.set(id, (weight.get(id) ?? 0) + 1);
    for (const m of marks) for (const p of words) join(formId(m.patternId), wordId(p.base), s);
    for (let i = 1; i < marks.length; i++) join(formId(marks[i - 1].patternId), formId(marks[i].patternId), s);
    for (let i = 1; i < words.length; i++) join(wordId(words[i - 1].base), wordId(words[i].base), s);
    sentences.push({ text: s.text, gloss: s.gloss, nodes: [...here] });
  }

  // The learner's own sentences: which points and lines they have used. Words are found by how they were written in
  // the rain, longest first, each place once.
  const saidNodes = new Set<string>();
  const saidEdges = new Set<string>();
  const written = [...surfaces.keys()].sort((a, b) => b.length - a.length);
  for (const s of said) {
    const lower = s.text.toLowerCase();
    const taken: { start: number; end: number; id: string }[] = [];
    for (const w of written) {
      for (let at = lower.indexOf(w); at !== -1; at = lower.indexOf(w, at + 1)) {
        if (!taken.some((t) => at < t.end && at + w.length > t.start)) taken.push({ start: at, end: at + w.length, id: surfaces.get(w)! });
      }
    }
    const words = taken.sort((a, b) => a.start - b.start).map((t) => t.id);
    const fs = s.patternIds.filter((p) => forms.has(p) && weight.has(formId(p))).map(formId);
    for (const id of [...words, ...fs]) saidNodes.add(id);
    for (const f of fs) for (const w of words) saidEdges.add(edgeKey(f, w));
    for (let i = 1; i < words.length; i++) if (words[i] !== words[i - 1]) saidEdges.add(edgeKey(words[i - 1], words[i]));
  }

  const kept = [...weight.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, opts.maxNodes)
    .map(([id]) => id);
  const keep = new Set(kept);
  const nodes: NetNode[] = kept.map((id) => {
    const isForm = id.startsWith("form:");
    const patternId = isForm ? id.slice(5) : null;
    return {
      id,
      kind: isForm ? "form" : "word",
      label: mostCommon(labels.get(id) ?? []) ?? id,
      meaning: isForm ? (forms.get(patternId!) ?? null) : mostCommon(meanings.get(id) ?? []),
      weight: weight.get(id) ?? 0,
      said: saidNodes.has(id),
      patternId,
    };
  });
  return {
    nodes,
    edges: [...edges.entries()]
      .filter(([, e]) => keep.has(e.a) && keep.has(e.b))
      .map(([k, e]) => ({
        a: e.a,
        b: e.b,
        weight: e.weight,
        said: saidEdges.has(k),
        fresh: e.allFirst,
        daysAgo: Math.max(0, Math.floor((opts.now - e.lastAt) / DAY)),
      })),
    sentences: sentences.map((s) => ({ ...s, nodes: s.nodes.filter((id) => keep.has(id)) })),
  };
}

/**
 * Where each point sits: a force layout (points push apart, lines pull together, everything drifts to the middle),
 * started on a spiral by the points' order, so the same web always comes out the same and only grows as it grows.
 */
export function layoutNetwork(
  nodes: { id: string }[],
  edges: { a: string; b: string; weight: number }[],
  width: number,
  height: number,
  iterations = 300,
): Map<string, { x: number; y: number }> {
  const n = nodes.length;
  const pos = nodes.map((_, i) => {
    const r = 12 * Math.sqrt(i + 0.5);
    const a = i * 2.399963; // the golden angle
    return { x: width / 2 + r * Math.cos(a), y: height / 2 + r * Math.sin(a) };
  });
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  const links = edges.flatMap((e) => (index.has(e.a) && index.has(e.b) ? [{ i: index.get(e.a)!, j: index.get(e.b)!, w: e.weight }] : []));
  const k = Math.sqrt((width * height) / Math.max(n, 1)) * 0.75;
  const margin = 24;
  let temperature = width / 8;
  for (let step = 0; step < iterations; step++) {
    const move = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        if (Math.hypot(dx, dy) < 0.01) {
          dx = 0.01 * (i - j);
          dy = 0.01;
        }
        const d = Math.hypot(dx, dy);
        const f = (k * k) / d;
        move[i].x += (dx / d) * f;
        move[i].y += (dy / d) * f;
        move[j].x -= (dx / d) * f;
        move[j].y -= (dy / d) * f;
      }
    }
    for (const { i, j, w } of links) {
      const dx = pos[i].x - pos[j].x;
      const dy = pos[i].y - pos[j].y;
      const d = Math.max(Math.hypot(dx, dy), 0.01);
      const f = ((d * d) / k) * Math.min(1 + Math.log(w), 3) * 0.5;
      move[i].x -= (dx / d) * f;
      move[i].y -= (dy / d) * f;
      move[j].x += (dx / d) * f;
      move[j].y += (dy / d) * f;
    }
    for (let i = 0; i < n; i++) {
      move[i].x += (width / 2 - pos[i].x) * 0.005 * k;
      move[i].y += (height / 2 - pos[i].y) * 0.005 * k;
      const d = Math.max(Math.hypot(move[i].x, move[i].y), 0.01);
      const by = Math.min(d, temperature);
      pos[i].x = Math.min(width - margin, Math.max(margin, pos[i].x + (move[i].x / d) * by));
      pos[i].y = Math.min(height - margin, Math.max(margin, pos[i].y + (move[i].y / d) * by));
    }
    temperature = Math.max(temperature * 0.985, 0.5);
  }
  return new Map(nodes.map((node, i) => [node.id, pos[i]]));
}
