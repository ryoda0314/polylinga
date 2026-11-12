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
/** pending: sentences bathed in whose words are not in the web yet (not split into 語のまとまり so far). */
export type Network = { nodes: NetNode[]; edges: NetEdge[]; sentences: NetSentence[]; pending: number };

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

  // What each way of saying is called: its usual part. A word written just like one (吃 of N + 吃, 去 of N + 去) is the
  // same point, not a second one beside it.
  const known = (s: SeenSentence) => s.marks.filter((m) => forms.has(m.patternId));
  for (const s of seen) {
    for (const m of known(s)) labels.set(formId(m.patternId), [...(labels.get(formId(m.patternId)) ?? []), s.text.slice(m.start, m.end).trim()]);
  }
  const formOf = new Map<string, string>();
  for (const [id, names] of labels) formOf.set((mostCommon(names) ?? "").toLowerCase(), id);
  const pointOf = (base: string) => formOf.get(base.toLowerCase()) ?? wordId(base);

  for (const s of seen) {
    const marks = known(s);
    const inMark = (p: NetPiece) => marks.some((m) => p.start >= m.start && p.end <= m.end);
    const words = s.pieces.filter((p) => p.kind === "word" && !inMark(p)).sort((a, b) => a.start - b.start);
    const here = new Set<string>(marks.map((m) => formId(m.patternId)));
    for (const p of words) {
      const id = pointOf(p.base);
      if (id.startsWith("word:")) {
        labels.set(id, [...(labels.get(id) ?? []), p.base]);
        if (p.meaning) meanings.set(id, [...(meanings.get(id) ?? []), p.meaning]);
      }
      surfaces.set(s.text.slice(p.start, p.end).toLowerCase(), id);
      here.add(id);
    }
    for (const id of here) weight.set(id, (weight.get(id) ?? 0) + 1);
    for (const m of marks) for (const p of words) join(formId(m.patternId), pointOf(p.base), s);
    for (let i = 1; i < marks.length; i++) join(formId(marks[i - 1].patternId), formId(marks[i].patternId), s);
    for (let i = 1; i < words.length; i++) join(pointOf(words[i - 1].base), pointOf(words[i].base), s);
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
    pending: 0,
  };
}

/** A point as the web settles: where it is, how it moves, its size; fx/fy hold it where a finger holds it. */
export type SimNode = { x: number; y: number; vx: number; vy: number; r: number; fx: number | null; fy: number | null };
export type SimLink = { i: number; j: number; w: number };

const CHARGE = 260; // how hard points push apart
const LINK_DISTANCE = 46; // the length a line pulls towards
const GRAVITY = 0.035; // the pull towards the middle, so the web stays together
const VELOCITY_DECAY = 0.4; // how much of its speed a point loses each step
const PADDING = 6; // room kept between two points

/** Where the points start: a spiral by their order (most met first, in the middle), so the same web starts the same. */
export function seedNodes(radii: number[]): SimNode[] {
  return radii.map((r, i) => {
    const d = 18 * Math.sqrt(i + 0.5);
    const a = i * 2.399963; // the golden angle
    return { x: d * Math.cos(a), y: d * Math.sin(a), vx: 0, vy: 0, r, fx: null, fy: null };
  });
}

/**
 * One step of the web settling, around (0, 0): points push apart, lines pull their ends to a length (weaker for a
 * point with many lines), everything drifts to the middle, and points never overlap. alpha (1 → 0) is how lively it
 * still is. The same model as d3-force, small enough to run here for a few dozen points.
 */
export function simulate(nodes: SimNode[], links: SimLink[], alpha: number): void {
  const n = nodes.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x || 0.01 * (j - i);
      const dy = b.y - a.y || 0.01;
      const d2 = dx * dx + dy * dy;
      const f = (CHARGE * alpha) / d2;
      a.vx -= dx * f;
      a.vy -= dy * f;
      b.vx += dx * f;
      b.vy += dy * f;
    }
  }
  const degree = new Array<number>(n).fill(0);
  for (const l of links) {
    degree[l.i]++;
    degree[l.j]++;
  }
  for (const l of links) {
    const a = nodes[l.i], b = nodes[l.j];
    const dx = b.x + b.vx - a.x - a.vx;
    const dy = b.y + b.vy - a.y - a.vy;
    const d = Math.hypot(dx, dy) || 0.01;
    const strength = Math.min(1, 0.6 / Math.min(degree[l.i], degree[l.j])) * Math.min(1 + Math.log(l.w) * 0.3, 1.6);
    const f = ((d - LINK_DISTANCE) / d) * alpha * strength;
    const share = degree[l.i] / (degree[l.i] + degree[l.j]); // the point with more lines moves less
    b.vx -= dx * f * share;
    b.vy -= dy * f * share;
    a.vx += dx * f * (1 - share);
    a.vy += dy * f * (1 - share);
  }
  for (const p of nodes) {
    p.vx -= p.x * GRAVITY * alpha;
    p.vy -= p.y * GRAVITY * alpha;
  }
  for (const p of nodes) {
    if (p.fx !== null && p.fy !== null) {
      p.x = p.fx;
      p.y = p.fy;
      p.vx = 0;
      p.vy = 0;
    } else {
      p.vx *= 1 - VELOCITY_DECAY;
      p.vy *= 1 - VELOCITY_DECAY;
      p.x += p.vx;
      p.y += p.vy;
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const min = a.r + b.r + PADDING;
      if (d >= min) continue;
      const push = (min - d) / d / 2;
      const aHeld = a.fx !== null, bHeld = b.fx !== null;
      if (!aHeld) {
        a.x -= dx * push * (bHeld ? 2 : 1);
        a.y -= dy * push * (bHeld ? 2 : 1);
      }
      if (!bHeld) {
        b.x += dx * push * (aHeld ? 2 : 1);
        b.y += dy * push * (aHeld ? 2 : 1);
      }
    }
  }
}

/** The zoom and offset that show the whole web in a box of this size, with a margin, at most life size × 1.6. */
export function fitView(nodes: { x: number; y: number; r: number }[], width: number, height: number, margin = 36) {
  if (nodes.length === 0) return { k: 1, x: width / 2, y: height / 2 };
  const minX = Math.min(...nodes.map((p) => p.x - p.r)), maxX = Math.max(...nodes.map((p) => p.x + p.r));
  const minY = Math.min(...nodes.map((p) => p.y - p.r)), maxY = Math.max(...nodes.map((p) => p.y + p.r));
  const k = Math.min((width - 2 * margin) / Math.max(maxX - minX, 1), (height - 2 * margin) / Math.max(maxY - minY, 1), 1.6);
  return { k, x: width / 2 - ((minX + maxX) / 2) * k, y: height / 2 - ((minY + maxY) / 2) * k };
}
