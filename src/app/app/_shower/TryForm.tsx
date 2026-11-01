"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import { keepSentencesInView } from "@/components/keyboard";
import { useDraft } from "@/components/local";
import { getDict } from "@/lib/i18n";
import { langClass, type Lang } from "@/lib/langs";
import type { FormState } from "../actions";
import styles from "./shower.module.css";

/**
 * "これで言ってみる": write a sentence with the pattern just bathed in; the action opens the corrected result. The
 * sentences it is said with (Material, `refId`) are beside the field, or right above it on a phone.
 */
export function TryForm({
  action,
  patternId,
  refId,
  native,
  target,
  focus = false,
  label,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** The half-written sentence is kept on this device per pattern. */
  patternId: string;
  refId: string;
  native: Lang;
  target: Lang;
  /** Opened by a press (これで言ってみる): on a PC the field takes the cursor at once. */
  focus?: boolean;
  /** Wording for use outside the shower (自分), where the sentences were not "just now". */
  label?: string;
}) {
  const t = getDict(native);
  const draft = useDraft(`try:${patternId}`, "text");
  const { wrap } = draft;
  const run = useMemo(() => wrap(action), [wrap, action]);
  const [state, formAction, pending] = useActionState<FormState, FormData>(run, { error: null });
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  // On a phone the keyboard waits for a tap, so the sentences can be read first.
  useEffect(() => {
    if (focus && window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches) fieldRef.current?.focus({ preventScroll: true });
  }, [focus]);

  return (
    <form action={formAction} className={styles.try}>
      <label htmlFor="try-text" className="label">
        {label ?? t.shower.tryLabel}
      </label>
      <textarea
        ref={fieldRef}
        id="try-text"
        name="text"
        required
        maxLength={200}
        className={`${styles.textarea} ${langClass(target)}`}
        onFocus={(e) => keepSentencesInView(refId, e.currentTarget)}
        value={draft.value}
        onChange={(e) => draft.change(e.target.value)}
      />
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
