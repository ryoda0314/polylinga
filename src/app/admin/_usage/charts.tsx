import type { CSSProperties, ReactNode } from "react";
import { niceScale, num } from "@/lib/admin-usage-core";
import styles from "./charts.module.css";

// The admin's charts, drawn on the server with no script: thin columns and bars from one baseline, a readout on hover
// and on keyboard focus, and the same numbers in each section's 表で見る. Two tones of the accent only (checked for
// colour-blind separation): the darker one is the main series.

export type Tone = "strong" | "soft";
export type ColumnSeries = { label: string; tone: Tone };
export type Column = {
  /** Under the column; only every `every`-th one shows, counted back from the last. */
  label: string;
  /** At the top of its readout. */
  title: string;
  /** One per series, bottom first. */
  values: number[];
  /** More lines for the readout. */
  notes?: string[];
};

export function ColumnChart({
  series,
  columns,
  unit,
  every = 1,
  height = 160,
}: {
  series: ColumnSeries[];
  columns: Column[];
  unit: string;
  every?: number;
  height?: number;
}) {
  const totals = columns.map((c) => c.values.reduce((a, b) => a + b, 0));
  const { top, ticks } = niceScale(Math.max(0, ...totals));
  const last = columns.length - 1;
  // Readouts near either end open inwards so they stay on the page.
  const edge = (i: number) => (i < columns.length * 0.2 ? "start" : i > columns.length * 0.8 ? "end" : undefined);
  const amount = (v: number) => `${num(v)}${unit}`;

  return (
    <figure className={styles.figure}>
      {series.length > 1 ? (
        <ul className={styles.legend}>
          {series.map((s) => (
            <li key={s.label}>
              <span className={styles.swatch} data-tone={s.tone} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.plot} style={{ "--plot-h": `${height}px` } as CSSProperties}>
        <div className={styles.grid} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className={styles.gridLine} style={{ bottom: `${(t / top) * 100}%` }}>
              <span className={styles.tick}>{num(t)}</span>
            </span>
          ))}
        </div>
        <ol className={styles.columns}>
          {columns.map((c, i) => {
            const topIndex = c.values.findLastIndex((v) => v > 0);
            const readout = series.map((s, k) => `${s.label} ${amount(c.values[k] ?? 0)}`).join("、");
            return (
              <li
                key={`${c.title}-${i}`}
                className={styles.slot}
                data-edge={edge(i)}
                tabIndex={0}
                aria-label={`${c.title}、${readout}${c.notes?.length ? `、${c.notes.join("、")}` : ""}`}
              >
                <span className={styles.bar} aria-hidden="true">
                  {c.values.map((v, k) =>
                    v > 0 ? (
                      <span
                        key={k}
                        className={styles.seg}
                        data-tone={series[k]?.tone ?? "strong"}
                        data-top={k === topIndex ? "" : undefined}
                        style={{ height: `${(v / top) * 100}%` }}
                      />
                    ) : null,
                  )}
                </span>
                <span className={styles.tip} aria-hidden="true">
                  <span className={styles.tipTitle}>{c.title}</span>
                  {series.length > 1 ? (
                    <span className={styles.tipRow}>
                      <strong>{amount(totals[i])}</strong> 合計
                    </span>
                  ) : null}
                  {series
                    .map((s, k) => ({ s, v: c.values[k] ?? 0 }))
                    .reverse()
                    .map(({ s, v }) => (
                      <span key={s.label} className={styles.tipRow}>
                        <span className={styles.key} data-tone={s.tone} />
                        <strong>{amount(v)}</strong> {s.label}
                      </span>
                    ))}
                  {c.notes?.map((n) => (
                    <span key={n} className={styles.tipNote}>
                      {n}
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className={styles.xAxis} aria-hidden="true">
        {columns.map((c, i) => (
          <span key={`${c.title}-${i}`} className={styles.xCell}>
            {(last - i) % every === 0 ? <span>{c.label}</span> : null}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Horizontal bars from one baseline, largest share first by the caller, each value printed at its tip. */
export function BarRows({
  rows,
  unit,
  max,
}: {
  rows: { key: string; label: ReactNode; value: number; note?: string }[];
  unit: string;
  /** What a full bar means; the largest value when not given. */
  max?: number;
}) {
  const full = Math.max(max ?? 0, ...rows.map((r) => r.value), 1);
  return (
    <ul className={styles.rows}>
      {rows.map((r) => (
        <li key={r.key} className={styles.row}>
          <span className={styles.rowLabel}>{r.label}</span>
          <span className={styles.rowTrack}>
            {r.value > 0 ? (
              <span className={styles.rowBar} style={{ "--f": r.value / full } as CSSProperties} aria-hidden="true" />
            ) : null}
            <span className={styles.rowValue}>
              {num(r.value)}
              {unit}
              {r.note ? <span className={styles.rowNote}> · {r.note}</span> : null}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** One count against its ceiling. Past 80% it turns to the danger colour and says so in words. */
export function Meter({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const share = limit > 0 ? Math.min(used / limit, 1) : 0;
  const high = share >= 0.8;
  return (
    <div className={styles.meter}>
      <div className={styles.meterHead}>
        <span>{label}</span>
        <span className={styles.meterValue}>
          {num(used)} / {num(limit)}
          {unit}
        </span>
      </div>
      <div
        className={styles.meterTrack}
        data-high={high ? "" : undefined}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
      >
        {used > 0 ? <span className={styles.meterFill} style={{ width: `${share * 100}%` }} /> : null}
      </div>
      {high ? <p className={styles.meterWarn}>上限の8割を超えています</p> : null}
    </div>
  );
}
