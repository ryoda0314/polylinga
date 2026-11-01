"use client";

import { useActionState, useMemo } from "react";
import { keepSentencesInView } from "@/components/keyboard";
import { useDraft } from "@/components/local";
import type { FormState } from "../../actions";
import styles from "../../app.module.css";

export function WriteForm({
  action,
  draftKey,
  left,
  targetClass,
  labels,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Where the half-written sentence is kept on this device (one per saying). */
  draftKey: string;
  left: number;
  targetClass: string;
  labels: { write: string; hint: string; submit: string; pending: string; left: string; out: string };
}) {
  const draft = useDraft(draftKey, "text");
  const { wrap } = draft;
  const run = useMemo(() => wrap(action), [wrap, action]);
  const [state, formAction, pending] = useActionState<FormState, FormData>(run, { error: null });


  return (
    <form action={formAction} className={styles.stackSm}>
      <label htmlFor="text" className="label">
        {labels.write}
      </label>
      <textarea
        id="text"
        name="text"
        required
        maxLength={200}
        className={`${styles.textarea} ${targetClass}`}
        onFocus={(e) => keepSentencesInView("write-ref", e.currentTarget)}
        value={draft.value}
        onChange={(e) => draft.change(e.target.value)}
      />
      <p className={styles.note}>{labels.hint}</p>
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={pending || left <= 0}>
        {pending ? labels.pending : labels.submit}
      </button>
      <p className={styles.note}>{left > 0 ? labels.left : labels.out}</p>
    </form>
  );
}
