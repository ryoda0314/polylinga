"use client";

import { useActionState, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { getDict } from "@/lib/i18n";
import { langClass, type Lang } from "@/lib/langs";
import { deleteWord, saveWord, setUnderstood, type WordState } from "../actions";
import styles from "../app.module.css";

/** Type a word in yourself; the same word again simply counts as another meeting. */
export function WordAddForm({ native, target }: { native: Lang; target: Lang }) {
  const t = getDict(native);
  const [state, action, pending] = useActionState<WordState, FormData>(saveWord, { error: null, saved: null });

  return (
    <form action={action} className={styles.panel}>
      <label htmlFor="add-word" className="label">
        {t.words.add}
      </label>
      <input id="add-word" name="word" required maxLength={40} autoComplete="off" className={`${styles.input} ${langClass(target)}`} />
      <label htmlFor="add-note" className={styles.rowSub}>
        {t.word.note}
      </label>
      <input id="add-note" name="note" maxLength={120} autoComplete="off" className={styles.input} />
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : state.saved ? (
        <p className={styles.saved} role="status">
          {state.saved}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={pending}>
        {t.word.save}
      </button>
    </form>
  );
}

export function WordActions({ wordId, understood, native }: { wordId: string; understood: boolean; native: Lang }) {
  const t = getDict(native);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className={styles.wordActions}>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={understood}
          disabled={pending}
          onChange={(e) => {
            const value = e.target.checked;
            startTransition(() => setUnderstood(wordId, value));
          }}
        />
        {t.words.understood}
      </label>
      {confirming ? (
        <button
          type="button"
          className={styles.smallDanger}
          disabled={pending}
          onClick={() => startTransition(() => deleteWord(wordId))}
          onBlur={() => !pending && setConfirming(false)}
          autoFocus
        >
          {pending ? t.words.deleting : t.words.confirmDelete}
        </button>
      ) : (
        <button type="button" className={styles.iconButton} onClick={() => setConfirming(true)} aria-label={t.words.delete}>
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  );
}
