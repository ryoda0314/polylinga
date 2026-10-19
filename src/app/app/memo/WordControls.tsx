"use client";

import { useActionState, useState } from "react";
import { getDict } from "@/lib/i18n";
import { langClass, type Lang } from "@/lib/langs";
import { saveWord, type WordState } from "../actions";
import { SaveButton } from "./SaveButton";
import styles from "./memo.module.css";

/** Type a word in yourself (never filled in for you); the same word again simply counts as another meeting. */
export function WordAddForm({ native, target }: { native: Lang; target: Lang }) {
  const t = getDict(native);
  const [state, action, pending] = useActionState<WordState, FormData>(saveWord, { error: null, saved: null });
  // Typing again after a save clears the "saved" look, so it always speaks of the word just sent.
  const [typing, setTyping] = useState(false);
  const done = !pending && Boolean(state.saved) && !typing;

  return (
    <form action={action} onSubmit={() => setTyping(false)} onInput={() => setTyping(true)} className={styles.addForm}>
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
        <SaveButton pending={pending} done={done} labels={{ save: t.word.save, saving: t.word.saving, saved: t.word.savedButton }} />
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
      ) : done ? (
        <p className={styles.formSaved} role="status">
          {state.saved}
        </p>
      ) : (
        <p className={styles.formHint}>{t.word.memoHint}</p>
      )}
    </form>
  );
}
