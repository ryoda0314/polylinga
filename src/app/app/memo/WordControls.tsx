"use client";

import { useActionState } from "react";
import { getDict } from "@/lib/i18n";
import { langClass, type Lang } from "@/lib/langs";
import { saveWord, type WordState } from "../actions";
import styles from "./memo.module.css";

/** Type a word in yourself (never filled in for you); the same word again simply counts as another meeting. */
export function WordAddForm({ native, target }: { native: Lang; target: Lang }) {
  const t = getDict(native);
  const [state, action, pending] = useActionState<WordState, FormData>(saveWord, { error: null, saved: null });

  return (
    <form action={action} className={styles.addForm}>
      <label htmlFor="add-word" className="label">
        {t.words.add}
      </label>
      <div className={styles.addRow}>
        <input
          id="add-word"
          name="word"
          required
          maxLength={40}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className={`${styles.addWord} ${langClass(target)}`}
        />
        <button type="submit" className="btn" disabled={pending}>
          {t.word.save}
        </button>
      </div>
      <input
        id="add-note"
        name="note"
        maxLength={120}
        autoComplete="off"
        placeholder={t.word.note}
        aria-label={t.word.note}
        className={styles.addNote}
      />
      {state.error ? (
        <p className={styles.formError} role="alert">
          {state.error}
        </p>
      ) : state.saved ? (
        <p className={styles.formSaved} role="status">
          {state.saved}
        </p>
      ) : (
        <p className={styles.formHint}>{t.word.memoHint}</p>
      )}
    </form>
  );
}
