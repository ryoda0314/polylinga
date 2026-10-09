"use client";

import { useActionState, useMemo } from "react";
import { getDict } from "@/lib/i18n";
import { langClass, type Lang } from "@/lib/langs";
import { tryPattern, type FormState } from "../actions";
import styles from "./shower.module.css";

/** "これで言ってみる": write a sentence with the pattern just bathed in; the action opens the corrected result. */
export function TryForm({ patternId, form, native, target }: { patternId: string; form: string; native: Lang; target: Lang }) {
  const t = getDict(native);
  const action = useMemo(() => tryPattern.bind(null, patternId), [patternId]);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, { error: null });

  return (
    <form action={formAction} className={styles.try}>
      <label htmlFor="try-text" className="label">
        {t.shower.tryLabel(form)}
      </label>
      <textarea id="try-text" name="text" required maxLength={200} className={`${styles.textarea} ${langClass(target)}`} />
      <p className={styles.note}>{t.shower.tryHint}</p>
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? t.shower.tryPending : t.shower.trySubmit}
      </button>
    </form>
  );
}
