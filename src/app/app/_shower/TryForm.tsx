"use client";

import { useActionState, useMemo, useRef } from "react";
import { SentenceText, type Highlight } from "@/components/SentenceText";
import { getDict } from "@/lib/i18n";
import { langClass, type Lang } from "@/lib/langs";
import type { ShowerSentence } from "@/lib/shower";
import { tryPattern, type FormState } from "../actions";
import styles from "./shower.module.css";

/**
 * "これで言ってみる": write a sentence with the pattern just bathed in; the action opens the corrected result.
 * The rain stays in view right above the field, so the learner can compare while typing (the shared part lit
 * only if they already asked for it).
 */
export function TryForm({
  patternId,
  native,
  target,
  sentences,
  revealed,
}: {
  patternId: string;
  native: Lang;
  target: Lang;
  sentences: ShowerSentence[];
  revealed: boolean;
}) {
  const t = getDict(native);
  const action = useMemo(() => tryPattern.bind(null, patternId), [patternId]);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, { error: null });
  const refBox = useRef<HTMLDivElement>(null);

  // Once the keyboard is up, bring the sentences and the field into view together.
  function keepRainInView() {
    window.setTimeout(() => refBox.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 350);
  }

  return (
    <form action={formAction} className={styles.try}>
      <div ref={refBox} className={styles.ref} aria-label={t.shower.tryRef}>
        <span className={styles.refTitle}>{t.shower.tryRef}</span>
        <ul className={styles.refList}>
          {sentences.map((s) => {
            const marks: Highlight[] = revealed && s.mark ? [{ ...s.mark, kind: "mark" }] : [];
            const glossMarks: Highlight[] = revealed && s.glossMark ? [{ ...s.glossMark, kind: "mark" }] : [];
            return (
              <li key={s.id}>
                <span className={`${styles.refText} ${langClass(target)}`}>
                  <SentenceText text={s.text} highlights={marks} reading={s.reading} />
                </span>
                <span className={`${styles.refGloss} ${langClass(native)}`}>
                  <SentenceText text={s.gloss} highlights={glossMarks} />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <label htmlFor="try-text" className="label">
        {t.shower.tryLabel}
      </label>
      <textarea
        id="try-text"
        name="text"
        required
        maxLength={200}
        className={`${styles.textarea} ${langClass(target)}`}
        onFocus={keepRainInView}
      />
      <p className={styles.note}>{t.shower.tryHint}</p>
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? t.shower.tryPending : t.shower.trySubmit}
      </button>
    </form>
  );
}
