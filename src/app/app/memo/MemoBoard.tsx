"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { SentenceText } from "@/components/SentenceText";
import { getDict } from "@/lib/i18n";
import { langClass, type Lang } from "@/lib/langs";
import styles from "./memo.module.css";
import { WordDetail } from "./WordDetail";
import { STAGES, type MemoWord, type Stage } from "./words";

/** A small rain gauge: one more drop for each stage the word has reached. */
export function Gauge({ stage, label }: { stage: Stage; label: string }) {
  const level = STAGES.indexOf(stage);
  return (
    <span className={styles.gauge} data-stage={stage}>
      <span className={styles.drops} aria-hidden="true">
        {STAGES.map((s, k) => (
          <i key={s} data-on={k <= level || undefined} />
        ))}
      </span>
      {label}
    </span>
  );
}

/**
 * The memo as a place the words grow, not a list to study: the ones the rain brought back lately come first,
 * then every word with its gauge. A word opens to where it lives (sentences, the learner's own lines).
 */
export function MemoBoard({ words, native, target, rate }: { words: MemoWord[]; native: Lang; target: Lang; rate: number }) {
  const t = getDict(native);
  const [stage, setStage] = useState<Stage | "all">("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const recent = useMemo(
    () =>
      words
        .filter((w) => w.metDaysAgo !== null && w.metDaysAgo <= 7)
        .sort((a, b) => (a.metDaysAgo ?? 0) - (b.metDaysAgo ?? 0))
        .slice(0, 8),
    [words],
  );
  const counts = useMemo(() => Object.fromEntries(STAGES.map((s) => [s, words.filter((w) => w.stage === s).length])), [words]);
  const q = query.trim().toLowerCase();
  const shown = words.filter(
    (w) => (stage === "all" || w.stage === stage) && (!q || w.text.toLowerCase().includes(q) || (w.note ?? "").toLowerCase().includes(q)),
  );
  const open = words.find((w) => w.id === openId) ?? null;

  if (words.length === 0) {
    return (
      <div className={styles.empty}>
        <Sprout />
        <p>{t.words.empty}</p>
      </div>
    );
  }

  return (
    <>
      {recent.length > 0 ? (
        <section className={styles.recentWrap}>
          <h2 className="label">{t.words.recent}</h2>
          <div className={styles.recent}>
            {recent.map((w) => (
              <button key={w.id} type="button" className={styles.recentCard} onClick={() => setOpenId(w.id)} aria-label={t.words.open(w.text)}>
                <span className={`${styles.recentWord} ${langClass(target)}`}>
                  <SentenceText text={w.text} reading={w.reading} />
                </span>
                <span className={styles.recentWhen}>{t.words.daysAgo(w.metDaysAgo ?? 0)}</span>
                <Gauge stage={w.stage} label={t.words.stages[w.stage]} />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className={styles.listHead}>
          <h2>{t.words.title}</h2>
          <span className={styles.count}>{t.common.count(words.length)}</span>
        </div>
        <div className={styles.tools}>
          <div className={styles.filters} role="group" aria-label={t.words.gauge}>
            {(["all", ...STAGES] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={s === stage ? `${styles.filter} ${styles.filterOn}` : styles.filter}
                aria-pressed={s === stage}
                onClick={() => setStage(s)}
              >
                {s === "all" ? t.words.all : t.words.stages[s]}
                <span className={styles.filterCount}>{s === "all" ? words.length : counts[s]}</span>
              </button>
            ))}
          </div>
          {words.length > 8 ? (
            <input
              type="search"
              className={styles.search}
              placeholder={t.words.search}
              aria-label={t.words.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          ) : null}
        </div>

        {shown.length === 0 ? (
          <p className={styles.none}>{t.words.noMatch}</p>
        ) : (
          <ul className={styles.list}>
            {shown.map((w) => (
              <li key={w.id}>
                <button type="button" className={styles.row} onClick={() => setOpenId(w.id)} aria-label={t.words.open(w.text)}>
                  <span className={styles.rowText}>
                    <Gauge stage={w.stage} label={t.words.stages[w.stage]} />
                    <span className={`${styles.word} ${langClass(target)}`}>
                      <SentenceText text={w.text} reading={w.reading} />
                    </span>
                    {w.note ? <span className={`${styles.note} ${langClass(native)}`}>{w.note}</span> : null}
                    <span className={styles.meta}>
                      {t.words.met(w.encounters)}
                      {w.uses > 0 ? `・${t.words.used(w.uses)}` : ""}
                      {w.metDaysAgo !== null && w.metDaysAgo <= 7 ? (
                        <span className={styles.metAgain}>・{t.words.daysAgo(w.metDaysAgo)}</span>
                      ) : null}
                    </span>
                  </span>
                  <span className={styles.chev}>
                    <Icon name="back" size={18} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.footnote}>{t.words.gauge}</p>
      </section>

      {open ? <WordDetail key={open.id} word={open} native={native} target={target} rate={rate} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

/** Drops falling on a sprout, for an empty memo: the words to come. */
function Sprout() {
  return (
    <svg width="96" height="96" viewBox="0 0 200 200" aria-hidden="true">
      <rect x="62" y="22" width="7" height="26" rx="3.5" fill="var(--rain-blue)" />
      <rect x="97" y="8" width="7" height="30" rx="3.5" fill="var(--rain-violet)" />
      <rect x="132" y="26" width="7" height="24" rx="3.5" fill="var(--rain-pink)" />
      <path d="M100 150c-4-26-24-40-52-38 4 26 24 40 52 38z" fill="var(--rain-sky)" />
      <path d="M100 136c6-28 28-42 56-38-6 28-28 42-56 38z" fill="var(--rain-violet)" opacity="0.85" />
      <path d="M100 190v-62" stroke="var(--ink-2)" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
