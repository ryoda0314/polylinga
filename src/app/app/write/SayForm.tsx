"use client";

import { useActionState, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { useDraft } from "@/components/local";
import { correctFreely, type FormState } from "../actions";
import styles from "../app.module.css";

type OptionKey = "intent" | "nuance";
type OptionLabels = { add: string; label: string; hint: string; placeholder: string; remove: string };

/**
 * 自由に添削: whatever the learner wants to say, written in the language they are learning (words they do not know may
 * stay in their own). With ＋ they may add how they want it corrected: its Japanese translation, the nuance it should
 * carry, or both. It is corrected at once and its page opens.
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
    options: string;
    intent: OptionLabels;
    nuance: OptionLabels;
    submit: string;
    pending: string;
    left: string;
    out: string;
  };
  left: number;
  targetClass: string;
  nativeClass: string;
}) {
  // All kept on this device while typing, for a ride that ends mid-sentence.
  const text = useDraft("free", "text");
  const intent = useDraft("free-intent", "intent");
  const nuance = useDraft("free-nuance", "nuance");
  const { wrap: wrapText } = text;
  const { wrap: wrapIntent } = intent;
  const { wrap: wrapNuance } = nuance;
  const run = useMemo(() => wrapNuance(wrapIntent(wrapText(correctFreely))), [wrapNuance, wrapIntent, wrapText]);
  const [state, action, pending] = useActionState<FormState, FormData>(run, { error: null });

  // An option shows once added with ＋, or while something is written in it (a kept draft opens it again). The one
  // just added takes the cursor; one opened by a draft does not.
  const [added, setAdded] = useState<OptionKey[]>([]);
  const [justAdded, setJustAdded] = useState<OptionKey | null>(null);
  const options = (
    [
      { key: "intent", draft: intent, labels: labels.intent },
      { key: "nuance", draft: nuance, labels: labels.nuance },
    ] as const
  ).map((o) => ({ ...o, open: added.includes(o.key) || o.draft.value !== "" }));
  const closed = options.filter((o) => !o.open);

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
      {options
        .filter((o) => o.open)
        .map((o) => (
          <div key={o.key} className={styles.stackSm}>
            <div className={styles.optionHead}>
              <label htmlFor={`free-${o.key}`} className="label">
                {o.labels.label}
              </label>
              <button
                type="button"
                className={styles.iconLink}
                aria-label={o.labels.remove}
                onClick={() => {
                  o.draft.change("");
                  setAdded((keys) => keys.filter((k) => k !== o.key));
                }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <textarea
              id={`free-${o.key}`}
              name={o.key}
              maxLength={200}
              autoFocus={justAdded === o.key}
              className={`${styles.textarea} ${styles.textareaShort} ${nativeClass}`}
              placeholder={o.labels.placeholder}
              value={o.draft.value}
              onChange={(e) => o.draft.change(e.target.value)}
            />
            <p className={styles.note}>{o.labels.hint}</p>
          </div>
        ))}
      {closed.length ? (
        <div className={styles.stackSm}>
          <p className={styles.note}>{labels.options}</p>
          <div className={styles.chips}>
            {closed.map((o) => (
              <button
                key={o.key}
                type="button"
                className={`${styles.chip} ${styles.optionAdd}`}
                onClick={() => {
                  setAdded((keys) => [...keys, o.key]);
                  setJustAdded(o.key);
                }}
              >
                <span aria-hidden="true">＋</span>
                {o.labels.add}
              </button>
            ))}
          </div>
        </div>
      ) : null}
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
