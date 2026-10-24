"use client";

import { useActionState } from "react";
import styles from "../login/login.module.css";
import { chooseName, type NameState } from "./actions";

// No maxLength: the browser counts UTF-16 units, the server characters (cleanUsername), so the server says when it is long.
export function NameForm({ next, labels }: { next: string; labels: { label: string; limit: string; submit: string; saving: string } }) {
  const [state, formAction, pending] = useActionState<NameState, FormData>(chooseName, { error: null });

  return (
    <form action={formAction} className={styles.stack}>
      <label htmlFor="username" className="label">
        {labels.label}（{labels.limit}）
      </label>
      <input
        id="username"
        name="username"
        type="text"
        required
        autoComplete="nickname"
        autoFocus
        className={styles.input}
      />
      <input type="hidden" name="next" value={next} />
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? labels.saving : labels.submit}
      </button>
    </form>
  );
}
