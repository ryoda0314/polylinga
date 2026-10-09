"use client";

import { useActionState } from "react";
import { LANG_CODE_LABEL, LANGS, langClass, type Lang } from "@/lib/langs";
import styles from "../admin.module.css";
import { updatePattern, type EditState } from "./actions";

export function PatternEditor({
  pattern,
}: {
  pattern: { id: string; lang: Lang; form: string; examples: string | null; meaning: Record<Lang, string> };
}) {
  const [state, action, pending] = useActionState<EditState, FormData>(updatePattern.bind(null, pattern.id), {
    error: null,
    saved: false,
  });

  return (
    <details className={styles.editor}>
      <summary className={styles.small}>編集</summary>
      <form action={action} className={styles.editForm}>
        <label>
          <span>かたち</span>
          <input name="form" defaultValue={pattern.form} className={langClass(pattern.lang)} required />
        </label>
        <label>
          <span>例（「元 → 形」を「 · 」で区切る）</span>
          <input name="examples" defaultValue={pattern.examples ?? ""} className={langClass(pattern.lang)} />
        </label>
        {LANGS.map((l) => (
          <label key={l}>
            <span>説明（{LANG_CODE_LABEL[l]}話者向け）</span>
            <textarea name={`meaning_${l}`} defaultValue={pattern.meaning[l]} className={langClass(l)} rows={2} required />
          </label>
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
