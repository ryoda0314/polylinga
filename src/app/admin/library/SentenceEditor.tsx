"use client";

import { useActionState } from "react";
import { LANG_CODE_LABEL, LANGS, langClass, type Lang } from "@/lib/langs";
import styles from "../admin.module.css";
import { updateSentence, type EditState } from "./actions";

export function SentenceEditor({
  sentence,
  marks,
}: {
  sentence: { id: string } & Record<Lang, string>;
  marks: Record<Lang, string>;
}) {
  const [state, action, pending] = useActionState<EditState, FormData>(updateSentence.bind(null, sentence.id), {
    error: null,
    saved: false,
  });

  return (
    <details className={styles.editor}>
      <summary className={styles.small}>編集</summary>
      <form action={action} className={styles.editForm}>
        {LANGS.map((l) => (
          <fieldset key={l} className={styles.editRow}>
            <legend className="mono">{LANG_CODE_LABEL[l]}</legend>
            <label>
              <span>文</span>
              <input name={`text_${l}`} defaultValue={sentence[l]} className={langClass(l)} required />
            </label>
            <label>
              <span>印を付ける部分</span>
              <input name={`mark_${l}`} defaultValue={marks[l]} className={langClass(l)} />
            </label>
          </fieldset>
        ))}
        {state.error ? <p className={styles.error}>{state.error}</p> : null}
        {state.saved ? <p className={styles.ok}>保存しました。</p> : null}
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "保存しています…" : "保存する"}
        </button>
      </form>
    </details>
  );
}
