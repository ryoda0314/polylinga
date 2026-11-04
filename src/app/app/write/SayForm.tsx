"use client";

import { useActionState, useMemo } from "react";
import { useDraft } from "@/components/local";
import { correctFreely, type FormState } from "../actions";
import styles from "../app.module.css";

/**
 * 自由に添削: whatever the learner wants to say, written in the language they are learning (words they do not know may
 * stay in their own), with what they meant if they like. It is corrected at once and its page opens.
 */
export function SayForm({
  labels,
  left,
  targetClass,
  nativeClass,
}: {
  labels: {
    title: string;
    lead: string;
    text: string;
    textHint: string;
    intent: string;
    intentHint: string;
    placeholder: string;
    submit: string;
    pending: string;
    left: string;
    out: string;
  };
  left: number;
  targetClass: string;
  nativeClass: string;
}) {
  // Both kept on this device while typing, for a ride that ends mid-sentence.
  const text = useDraft("free", "text");
  const intent = useDraft("free-intent", "intent");
  const { wrap: wrapText } = text;
  const { wrap: wrapIntent } = intent;
  const run = useMemo(() => wrapIntent(wrapText(correctFreely)), [wrapIntent, wrapText]);
  const [state, action, pending] = useActionState<FormState, FormData>(run, { error: null });

  return (
    <form action={action} className={styles.stack}>
      <h1 className={styles.h1}>{labels.title}</h1>
      <p className={styles.lead}>{labels.lead}</p>
      <div className={styles.stackSm}>
        <label htmlFor="free-text" className="label">
          {labels.text}
        </label>
        <textarea
          id="free-text"
          name="text"
          required
          maxLength={200}
          className={`${styles.textarea} ${targetClass}`}
          value={text.value}
          onChange={(e) => text.change(e.target.value)}
        />
        <p className={styles.note}>{labels.textHint}</p>
      </div>
      <div className={styles.stackSm}>
        <label htmlFor="free-intent" className="label">
          {labels.intent}
        </label>
        <textarea
          id="free-intent"
          name="intent"
          maxLength={200}
          className={`${styles.textarea} ${styles.textareaShort} ${nativeClass}`}
          placeholder={labels.placeholder}
          value={intent.value}
          onChange={(e) => intent.change(e.target.value)}
        />
        <p className={styles.note}>{labels.intentHint}</p>
      </div>
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
