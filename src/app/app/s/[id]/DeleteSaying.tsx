"use client";

import { useState, useTransition } from "react";
import { deleteSaying } from "../../actions";
import styles from "../../app.module.css";

/** A quiet way to delete this from the learner's history: asked twice, then back to 書いてみる. */
export function DeleteSaying({
  sayingId,
  labels,
}: {
  sayingId: string;
  labels: { delete: string; confirm: string; cancel: string; note: string; deleting: string };
}) {
  const [asking, setAsking] = useState(false);
  const [pending, startDeleting] = useTransition();

  if (!asking) {
    return (
      <button type="button" className={styles.quietLink} onClick={() => setAsking(true)}>
        {labels.delete}
      </button>
    );
  }
  return (
    <div className={styles.confirmRow}>
      <p className={styles.note}>{labels.note}</p>
      <button
        type="button"
        className={styles.dangerButton}
        disabled={pending}
        onClick={() => startDeleting(() => deleteSaying(sayingId, true))}
      >
        {pending ? labels.deleting : labels.confirm}
      </button>
      <button type="button" className={styles.smallButton} disabled={pending} onClick={() => setAsking(false)}>
        {labels.cancel}
      </button>
    </div>
  );
}
