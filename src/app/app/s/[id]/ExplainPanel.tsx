"use client";

import { useState, useTransition } from "react";
import { SentenceText, type Highlight } from "@/components/SentenceText";
import type { ExplainedPart } from "@/lib/ai";
import { getDict } from "@/lib/i18n";
import { langClass, type Lang } from "@/lib/langs";
import { explainCorrection } from "../../actions";
import styles from "../../app.module.css";

/**
 * 詳しく解説 under a corrected sentence: each word with what it means there. Nothing is shown (or asked of the AI)
 * until the learner presses the button; pressing a word lights it in the sentence and its counterpart in the
 * translation, the same way a pattern is lit in the rain.
 */
export function ExplainPanel({
  correctionId,
  text,
  translation,
  reading,
  initial,
  native,
  target,
}: {
  correctionId: string;
  text: string;
  translation: string;
  reading: string[] | null;
  initial: ExplainedPart[] | null;
  native: Lang;
  target: Lang;
}) {
  const t = getDict(native);
  const [open, setOpen] = useState(false);
  const [parts, setParts] = useState<ExplainedPart[] | null>(initial);
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startExplaining] = useTransition();

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (parts) return;
    setError(null);
    startExplaining(async () => {
      const res = await explainCorrection(correctionId);
      if (res.parts) setParts(res.parts);
      else setError(res.error);
    });
  }

  const part = picked === null ? null : (parts?.[picked] ?? null);
  const lit: Highlight[] = part ? [{ start: part.start, end: part.end, kind: "mark" }] : [];
  const glossLit: Highlight[] = part?.gloss ? [{ ...part.gloss, kind: "mark" }] : [];

  return (
    <div className={styles.explainBox}>
      <button type="button" className="btn-quiet" aria-expanded={open} onClick={toggle} disabled={pending}>
        {pending ? t.saying.explaining : open ? t.saying.explainClose : t.saying.explain}
      </button>
      {open && parts ? (
        <div className={styles.explainPanel}>
          <p className={`${styles.explainSentence} ${langClass(target)}`}>
            <SentenceText text={text} highlights={lit} reading={reading} />
          </p>
          {translation ? (
            <p className={`${styles.gloss} ${langClass(native)}`}>
              <SentenceText text={translation} highlights={glossLit} />
            </p>
          ) : null}
          <p className={styles.note}>{t.saying.explainHint}</p>
          <ul className={styles.explainList}>
            {parts.map((p, i) => (
              <li key={`${p.start}-${p.end}`}>
                <button
                  type="button"
                  className={styles.explainRow}
                  aria-pressed={picked === i}
                  onClick={() => setPicked(picked === i ? null : i)}
                >
                  <span className={`${styles.explainWord} ${langClass(target)}`}>
                    <SentenceText text={text.slice(p.start, p.end)} reading={reading?.slice(p.start, p.end) ?? null} />
                  </span>
                  <span className={`${styles.explainMeaning} ${langClass(native)}`}>{p.meaning}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {open && error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
