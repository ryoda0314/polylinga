"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { SentenceText, type Highlight } from "@/components/SentenceText";
import { SpeakButton } from "@/components/SpeakButton";
import { getDict } from "@/lib/i18n";
import { langClass, type Lang } from "@/lib/langs";
import type { ShowerSentence } from "@/lib/shower";
import { sheetRoot, WordSheet } from "./WordSheet";
import styles from "./shower.module.css";

/**
 * The sentences a learner says something with (言ってみる): the rain they just bathed in, kept in view beside the field
 * and, afterwards, beside the correction, to borrow from. Each can be heard again, and tapping one opens the word
 * sheet: a word in other sentences, and the memo.
 */
export function Material({
  id,
  label,
  sentences,
  lit,
  way = null,
  onReveal,
  native,
  target,
  rate,
  compact = false,
}: {
  /** For the field to bring the sentences into view with it once a phone's keyboard is up. */
  id: string;
  label: string;
  sentences: ShowerSentence[];
  /** The shared part lit (in the rain, only once the learner has asked). */
  lit: boolean;
  /** What the shared part does (誘う), named beside the label once it is lit. */
  way?: string | null;
  /** The rain's 共通しているところは？, for asking here before it is lit. */
  onReveal?: () => void;
  native: Lang;
  target: Lang;
  rate: number;
  /**
   * Set close on a phone, so all of them fit above the field once the keyboard is up (言ってみる). Always, not only
   * while typing: a list that grew back as the field let go would move the button being pressed.
   */
  compact?: boolean;
}) {
  const t = getDict(native);
  const [sheetFor, setSheetFor] = useState<ShowerSentence | null>(null);
  return (
    <section
      id={id}
      className={compact ? `${styles.material} ${styles.compact}` : styles.material}
      aria-labelledby={`${id}-label`}
    >
      <div className={styles.materialHead}>
        <h2 id={`${id}-label`} className="label">
          {label}
        </h2>
        {lit ? (
          way ? <span className={styles.materialWay}>{way}</span> : null
        ) : onReveal ? (
          <button type="button" className={styles.revealLink} onClick={onReveal}>
            {t.shower.reveal}
          </button>
        ) : null}
      </div>
      <ul className={styles.materialList}>
        {sentences.map((s) => {
          const highlights: Highlight[] = [
            ...s.memoHits.map((h) => ({ ...h, kind: "memo" as const })),
            ...(lit && s.mark ? [{ ...s.mark, kind: "mark" as const }] : []),
          ];
          const glossHighlights: Highlight[] = lit && s.glossMark ? [{ ...s.glossMark, kind: "mark" }] : [];
          return (
            <li key={s.id} className={styles.materialItem}>
              <div className={styles.itemMain}>
                <button type="button" className={`${styles.materialText} ${langClass(target)}`} onClick={() => setSheetFor(s)}>
                  <SentenceText text={s.text} highlights={highlights} reading={s.reading} />
                </button>
                <span className={`${styles.gloss} ${langClass(native)}`}>
                  <SentenceText text={s.gloss} highlights={glossHighlights} />
                </span>
              </div>
              <SpeakButton
                text={s.text}
                lang={target}
                audio={s.audio}
                rate={rate}
                label={t.common.play}
                failedLabel={t.common.playFailed}
              />
            </li>
          );
        })}
      </ul>
      <p className={`${styles.note} ${styles.tapNote}`}>{t.shower.tryTap}</p>
      {sheetFor
        ? createPortal(
            <WordSheet sentence={sheetFor} native={native} target={target} rate={rate} onClose={() => setSheetFor(null)} />,
            sheetRoot(),
          )
        : null}
    </section>
  );
}
