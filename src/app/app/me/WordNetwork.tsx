"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { langClass, type Lang } from "@/lib/langs";
import { fitView, seedNodes, simulate, type Network, type SimNode } from "@/lib/network-core";
import styles from "./network.module.css";

const ALPHA_DECAY = 0.0228; // as d3-force: about 300 steps from lively to still
const ALPHA_MIN = 0.003;
const NAMED_AT_FIRST = 14; // names shown before zooming in: the points met most
const NAMED_ALL_FROM = 1.5; // the zoom from which every name shows
const TAP_SLOP = 6; // px a finger may move and still be a tap
const NEARBY = 16; // what a pressed point came with, the ones met most
const ZOOM = { min: 0.3, max: 4 };

type View = { k: number; x: number; y: number };
type Gesture =
  | { kind: "node"; i: number; x0: number; y0: number; moved: boolean }
  | { kind: "pan"; x0: number; y0: number; v0: View; moved: boolean }
  | { kind: "pinch"; d0: number; mid0: { x: number; y: number }; v0: View };

/**
 * ことばの網, drawn as a living web (in the manner of Obsidian's graph): small points that push apart and lines that pull
 * them together, settling as it opens. Points can be dragged and the web panned and zoomed (pinch, or the wheel with
 * ctrl on a PC and plain in the full view); a point under the pointer or pressed lights up with its neighbours while
 * the rest fades. Names show for the points met most until the learner zooms in. All in the language learned; a
 * pressed point shows what it means, what it came with and the sentences below. A thin line is heard, a solid one said
 * in their own sentence, one in the colour of a word met again first met today; one not met for a while is fainter.
 */
export function WordNetwork({
  net,
  native,
  target,
  labels,
}: {
  net: Network;
  native: Lang;
  target: Lang;
  labels: {
    title: string;
    legendForm: string;
    legendWord: string;
    legendHeard: string;
    legendSaid: string;
    legendToday: string;
    pick: string;
    with: string;
    sentences: string;
    formPage: string;
    full: string;
    close: string;
    fit: string;
    howTo: string;
  };
}) {
  const index = useMemo(() => new Map(net.nodes.map((node, i) => [node.id, i])), [net]);
  const links = useMemo(() => net.edges.map((e) => ({ i: index.get(e.a)!, j: index.get(e.b)!, w: e.weight })), [net, index]);
  const neighbours = useMemo(() => {
    const out = net.nodes.map(() => new Set<number>());
    for (const l of links) {
      out[l.i].add(l.j);
      out[l.j].add(l.i);
    }
    return out;
  }, [net, links]);
  const maxWeight = Math.max(1, ...net.nodes.map((n) => n.weight));
  // The web settled most of the way before it is first drawn; the rest it does in view.
  const [nodes] = useState<SimNode[]>(() => {
    const seeded = seedNodes(net.nodes.map((n) => 3.5 + 6 * Math.sqrt(n.weight / maxWeight)));
    for (let a = 1; a > 0.12; a *= 1 - ALPHA_DECAY) simulate(seeded, links, a);
    return seeded;
  });
  const named = useMemo(
    () => new Set([...net.nodes.keys()].sort((a, b) => net.nodes[b].weight - net.nodes[a].weight).slice(0, NAMED_AT_FIRST)),
    [net],
  );

  const [full, setFull] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [partner, setPartner] = useState<number | null>(null);
  const focus = hover ?? picked;
  const lit = useMemo(() => (focus === null ? null : new Set([focus, ...neighbours[focus]])), [focus, neighbours]);

  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const pointRefs = useRef<(SVGGElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const view = useRef<View>({ k: 1, x: 0, y: 0 });
  const alpha = useRef(0.12);
  const frame = useRef(0);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const still = useRef(false); // prefers-reduced-motion: the web is drawn settled and does not drift

  // Positions go straight to the drawing, not through React: a few dozen points move smoothly on a phone.
  const draw = useCallback(() => {
    const v = view.current;
    worldRef.current?.setAttribute("transform", `translate(${v.x} ${v.y}) scale(${v.k})`);
    worldRef.current?.style.setProperty("--k", String(v.k));
    svgRef.current?.toggleAttribute("data-near", v.k >= NAMED_ALL_FROM);
    nodes.forEach((p, i) => pointRefs.current[i]?.setAttribute("transform", `translate(${p.x} ${p.y})`));
    links.forEach((l, e) => {
      const el = lineRefs.current[e];
      if (!el) return;
      el.setAttribute("x1", String(nodes[l.i].x));
      el.setAttribute("y1", String(nodes[l.i].y));
      el.setAttribute("x2", String(nodes[l.j].x));
      el.setAttribute("y2", String(nodes[l.j].y));
    });
  }, [nodes, links]);

  const run = useCallback(() => {
    if (frame.current) return;
    const step = () => {
      simulate(nodes, links, alpha.current);
      alpha.current *= 1 - ALPHA_DECAY;
      draw();
      frame.current = alpha.current > ALPHA_MIN || gesture.current?.kind === "node" ? requestAnimationFrame(step) : 0;
    };
    frame.current = requestAnimationFrame(step);
  }, [nodes, links, draw]);

  const reheat = useCallback(
    (to: number) => {
      if (still.current) {
        for (let a = to; a > ALPHA_MIN; a *= 1 - ALPHA_DECAY) simulate(nodes, links, a);
        draw();
        return;
      }
      alpha.current = Math.max(alpha.current, to);
      run();
    },
    [nodes, links, draw, run],
  );

  const fit = useCallback(() => {
    const box = stageRef.current;
    if (!box) return;
    view.current = fitView(nodes, box.clientWidth, box.clientHeight);
    draw();
  }, [nodes, draw]);

  // Fitted to its box when it opens, when the box changes size (turned, the full view), and settling in view.
  useLayoutEffect(() => {
    still.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    fit();
    const box = stageRef.current;
    if (!box) return;
    const watch = new ResizeObserver(() => fit());
    watch.observe(box);
    reheat(0.12);
    return () => {
      watch.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [fit, reheat]);

  // Drawn again after React has changed what is lit (it never touches the positions).
  useLayoutEffect(() => draw(), [draw, focus, full]);

  // The full view covers the page: the page underneath does not scroll, and Escape closes it.
  useEffect(() => {
    if (!full) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", onKey);
    };
  }, [full]);

  const zoomAt = useCallback(
    (sx: number, sy: number, k: number) => {
      const v = view.current;
      const next = Math.min(ZOOM.max, Math.max(ZOOM.min, k));
      const wx = (sx - v.x) / v.k, wy = (sy - v.y) / v.k;
      view.current = { k: next, x: sx - wx * next, y: sy - wy * next };
      draw();
    },
    [draw],
  );

  // The wheel zooms in the full view; on the page it zooms only with ctrl (a trackpad's pinch), so the page still scrolls.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (!full && !e.ctrlKey) return;
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, view.current.k * Math.exp(-e.deltaY * 0.0015));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [full, zoomAt]);

  function at(e: React.PointerEvent) {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function choose(i: number | null) {
    setPicked((now) => (i === null || now === i ? null : i));
    setPartner(null);
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const p = at(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      release();
      gesture.current = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y), mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v0: { ...view.current } };
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const hit = (e.target as Element).closest("[data-i]");
    gesture.current = hit
      ? { kind: "node", i: Number(hit.getAttribute("data-i")), x0: p.x, y0: p.y, moved: false }
      : { kind: "pan", x0: p.x, y0: p.y, v0: { ...view.current }, moved: false };
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    const p = at(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch") {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const k = Math.min(ZOOM.max, Math.max(ZOOM.min, (g.v0.k * d) / Math.max(g.d0, 1)));
      const wx = (g.mid0.x - g.v0.x) / g.v0.k, wy = (g.mid0.y - g.v0.y) / g.v0.k;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      view.current = { k, x: mid.x - wx * k, y: mid.y - wy * k };
      draw();
      return;
    }
    if (!g.moved && Math.hypot(p.x - g.x0, p.y - g.y0) < TAP_SLOP) return;
    g.moved = true;
    if (g.kind === "node") {
      const v = view.current;
      nodes[g.i].fx = (p.x - v.x) / v.k;
      nodes[g.i].fy = (p.y - v.y) / v.k;
      reheat(0.3);
    } else {
      view.current = { ...g.v0, x: g.v0.x + p.x - g.x0, y: g.v0.y + p.y - g.y0 };
      draw();
    }
  }

  function release() {
    const g = gesture.current;
    if (g?.kind === "node") {
      nodes[g.i].fx = null;
      nodes[g.i].fy = null;
      reheat(0.08);
    }
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g?.kind === "node" && !g.moved) choose(g.i);
    else if (g?.kind === "pan" && !g.moved) choose(null);
    release();
    gesture.current = null;
  }

  const node = picked === null ? null : net.nodes[picked];
  const nearby =
    picked === null ? [] : [...neighbours[picked]].sort((a, b) => net.nodes[b].weight - net.nodes[a].weight).slice(0, NEARBY);
  const shown =
    node === null
      ? []
      : net.sentences
          .filter((s) => s.nodes.includes(node.id) && (partner === null || s.nodes.includes(net.nodes[partner].id)))
          .slice(0, 3);

  return (
    <div className={full ? `${styles.net} ${styles.full}` : styles.net} role={full ? "dialog" : undefined} aria-modal={full || undefined} aria-label={full ? labels.title : undefined}>
      <div className={styles.bar}>
        <span className={styles.howTo}>{labels.howTo}</span>
        <button type="button" className={styles.barButton} onClick={fit}>
          {labels.fit}
        </button>
        <button type="button" className={styles.barButton} onClick={() => setFull((f) => !f)} aria-pressed={full}>
          {full ? (
            <>
              <Icon name="close" size={16} />
              {labels.close}
            </>
          ) : (
            labels.full
          )}
        </button>
      </div>

      <div ref={stageRef} className={styles.stage}>
        <svg
          ref={svgRef}
          className={styles.svg}
          data-focus={lit ? "" : undefined}
          role="group"
          aria-label={labels.title}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <g ref={worldRef}>
            {net.edges.map((e, k) => {
              const l = links[k];
              const on = lit !== null && (l.i === focus || l.j === focus);
              const cls = [
                styles.line,
                e.said ? styles.lineSaid : "",
                e.fresh ? styles.lineFresh : "",
                on ? styles.on : lit ? styles.off : "",
              ].join(" ");
              return (
                <line
                  key={`${e.a}|${e.b}`}
                  ref={(el) => {
                    lineRefs.current[k] = el;
                  }}
                  className={cls}
                  style={{ opacity: lit ? undefined : e.daysAgo <= 7 ? 1 : e.daysAgo <= 30 ? 0.65 : 0.4 }}
                />
              );
            })}
            {net.nodes.map((n, i) => {
              const cls = [
                styles.point,
                n.kind === "form" ? styles.form : n.said ? styles.said : styles.word,
                named.has(i) ? styles.named : "",
                lit?.has(i) ? styles.on : lit ? styles.off : "",
                i === picked ? styles.picked : "",
              ].join(" ");
              return (
                <g
                  key={n.id}
                  ref={(el) => {
                    pointRefs.current[i] = el;
                  }}
                  data-i={i}
                  className={cls}
                  role="button"
                  tabIndex={0}
                  aria-label={n.label}
                  aria-pressed={i === picked}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setHover(i)}
                  onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      choose(i);
                    }
                  }}
                >
                  <circle r={nodes[i].r} />
                  <text y={nodes[i].r + 4} className={`${styles.name} ${langClass(target)}`} textAnchor="middle" dominantBaseline="hanging">
                    {n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <ul className={styles.legend}>
        <li>
          <span className={styles.keyForm} aria-hidden="true" />
          {labels.legendForm}
        </li>
        <li>
          <span className={styles.keyWord} aria-hidden="true" />
          {labels.legendWord}
        </li>
        <li>
          <span className={styles.keyLine} aria-hidden="true" />
          {labels.legendHeard}
        </li>
        <li>
          <span className={styles.keySaid} aria-hidden="true" />
          {labels.legendSaid}
        </li>
        <li>
          <span className={styles.keyToday} aria-hidden="true" />
          {labels.legendToday}
        </li>
      </ul>

      {node ? (
        <section className={styles.panel} aria-live="polite">
          <p className={`${styles.panelWord} ${langClass(target)}`}>{node.label}</p>
          {node.meaning ? <p className={`${styles.panelMeaning} ${langClass(native)}`}>{node.meaning}</p> : null}
          {nearby.length ? (
            <>
              <h3 className="label">{labels.with}</h3>
              <div className={styles.chips}>
                {nearby.map((j) => (
                  <button
                    key={j}
                    type="button"
                    className={`${styles.chip} ${net.edges.some((e) => e.said && [e.a, e.b].includes(net.nodes[j].id) && [e.a, e.b].includes(node.id)) ? styles.chipSaid : ""} ${langClass(target)}`}
                    aria-pressed={partner === j}
                    onClick={() => setPartner((now) => (now === j ? null : j))}
                  >
                    {net.nodes[j].label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {shown.length ? (
            <>
              <h3 className="label">{labels.sentences}</h3>
              <ul className={styles.sentences}>
                {shown.map((s, i) => (
                  <li key={i}>
                    <span className={langClass(target)}>{s.text}</span>
                    <span className={`${styles.gloss} ${langClass(native)}`}>{s.gloss}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {node.patternId ? (
            <Link href={`/app/me/f/${encodeURIComponent(node.patternId)}`} className={styles.more}>
              {labels.formPage}
            </Link>
          ) : null}
        </section>
      ) : (
        <p className={styles.hint}>{labels.pick}</p>
      )}
    </div>
  );
}
