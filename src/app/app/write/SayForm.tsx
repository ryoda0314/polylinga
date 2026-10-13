"use client";

import { useActionState, useMemo } from "react";
import { useDraft } from "@/components/local";
import { startSaying, type FormState } from "../actions";
import styles from "../app.module.css";

export function SayForm({
  labels,
  nativeClass,
}: {
  labels: {
    title: string;
    lead: string;
    steps: string[];
    stepsLabel: string;
    input: string;
    placeholder: string;
    submit: string;
    pending: string;
  };
  nativeClass: string;
}) {
  // Kept on this device while typing, for a ride that ends mid-sentence.
  const draft = useDraft("write", "intent");
  const { wrap } = draft;
  const run = useMemo(() => wrap(startSaying), [wrap]);
  const [state, action, pending] = useActionState<FormState, FormData>(run, { error: null });

  return (
    <form action={action} className={styles.stack}>
      <h1 className={styles.h1}>{labels.title}</h1>
      <ol className={styles.steps} role="list" aria-label={labels.stepsLabel}>
        {labels.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <label htmlFor="intent" className="label">
        {labels.input}
      </label>
      <p className={styles.note} style={{ marginTop: -8 }}>
        {labels.lead}
      </p>
      <textarea
        id="intent"
        name="intent"
        required
        maxLength={200}
        className={`${styles.textarea} ${nativeClass}`}
        placeholder={labels.placeholder}
        value={draft.value}
        onChange={(e) => draft.change(e.target.value)}
      />
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? labels.pending : labels.submit}
      </button>
    </form>
  );
}
