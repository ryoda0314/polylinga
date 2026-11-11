"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { langClass, type Lang } from "@/lib/langs";
import { layoutNetwork, type Network } from "@/lib/network-core";
import styles from "./network.module.css";

const W = 360;
const H = 300;

/**
 * ことばの網, drawn: the learner's words and ways of saying, in the language they are learning, joined where they came
 * together in the rain. A thin line is heard, a solid one said in their own sentence, a lit one met for the first time
 * today; one not met for a while is fainter. Pressing a point shows what it means (in the learner's language, only
 * then), what it came with, and the sentences.
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
    legendHeard: string;
    legendSaid: string;
    legendToday: string;
    pick: string;
    with: string;
    sentences: string;
    formPage: string;
  };
}) {
  const pos = useMemo(() => layoutNetwork(net.nodes, net.edges, W, H), [net]);
  const [picked, setPicked] = useState<string | null>(null);
  const [partner, setPartner] = useState<string | null>(null);
  const byId = useMemo(() => new Map(net.nodes.map((n) => [n.id, n])), [net]);
  const maxWeight = Math.max(1, ...net.nodes.map((n) => n.weight));
  const radius = (w: number) => 5 + 9 * Math.sqrt(w / maxWeight);
  const node = picked ? byId.get(picked) : null;
  const neighbours = picked
    ? net.edges
        .filter((e) => e.a === picked || e.b === picked)
        .map((e) => ({ id: e.a === picked ? e.b : e.a, said: e.said }))
        .sort((a, b) => (byId.get(b.id)?.weight ?? 0) - (byId.get(a.id)?.weight ?? 0))
    : [];
  const shown = picked
    ? net.sentences.filter((s) => s.nodes.includes(picked) && (!partner || s.nodes.includes(partner))).slice(0, 3)
    : [];

  function choose(id: string) {
    setPicked((now) => (now === id ? null : id));
    setPartner(null);
  }

  return (
    <div className={styles.net}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="group" aria-label={labels.title}>
        {net.edges.map((e) => {
          const a = pos.get(e.a), b = pos.get(e.b);
          if (!a || !b) return null;
          const touches = picked !== null && (e.a === picked || e.b === picked);
          const faded = picked !== null && !touches;
          const age = e.daysAgo <= 7 ? 1 : e.daysAgo <= 30 ? 0.65 : 0.4;
          return (
            <line
              key={`${e.a}|${e.b}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={e.fresh ? styles.lineFresh : e.said ? styles.lineSaid : styles.line}
              strokeWidth={(e.said ? 2.2 : 1) + Math.min(Math.log(e.weight), 2)}
              opacity={faded ? 0.15 : age}
            />
          );
        })}
        {net.nodes.map((n) => {
          const p = pos.get(n.id);
          if (!p) return null;
          const r = radius(n.weight);
          const on = n.id === picked || n.id === partner;
          return (
            <g
              key={n.id}
              className={styles.point}
              role="button"
              tabIndex={0}
              aria-pressed={n.id === picked}
              aria-label={n.label}
              onClick={() => choose(n.id)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  choose(n.id);
                }
              }}
            >
              {n.kind === "form" ? (
                <rect
                  x={p.x - r}
                  y={p.y - r * 0.7}
                  width={r * 2}
                  height={r * 1.4}
                  rx={r * 0.35}
                  className={[styles.form, n.said ? styles.said : "", on ? styles.on : ""].join(" ")}
                />
              ) : (
                <circle cx={p.x} cy={p.y} r={r * 0.75} className={[styles.word, n.said ? styles.said : "", on ? styles.on : ""].join(" ")} />
              )}
              <text x={p.x} y={p.y + r + 11} className={`${styles.label} ${langClass(target)}`} textAnchor="middle">
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>

      <ul className={styles.legend}>
        <li>
          <span className={styles.keyHeard} aria-hidden="true" />
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
          {neighbours.length ? (
            <>
              <h3 className="label">{labels.with}</h3>
              <div className={styles.chips}>
                {neighbours.map((nb) => (
                  <button
                    key={nb.id}
                    type="button"
                    className={`${styles.chip} ${nb.said ? styles.chipSaid : ""} ${langClass(target)}`}
                    aria-pressed={partner === nb.id}
                    onClick={() => setPartner((now) => (now === nb.id ? null : nb.id))}
                  >
                    {byId.get(nb.id)?.label}
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
