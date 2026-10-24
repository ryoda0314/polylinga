"use client";

import { useActionState } from "react";
import { renameAccount, type SettingsState } from "../actions";
import styles from "../app.module.css";

/** ユーザー名 in settings: the account's name, chosen first on /name. */
export function UsernameForm({
  current,
  labels,
}: {
  current: string;
  labels: { label: string; limit: string; change: string; saving: string };
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(renameAccount, {
    message: null,
    error: false,
  });

  return (
    <form action={formAction} className={styles.field}>
      <label htmlFor="username" className="label">
        {labels.label}
      </label>
      <input
        id="username"
        name="username"
        type="text"
        required
        defaultValue={current}
        autoComplete="nickname"
        className={styles.textInput}
      />
      <span className={styles.note}>{labels.limit}</span>
      <button type="submit" className="btn-quiet" disabled={pending}>
        {pending ? labels.saving : labels.change}
      </button>
      {state.message ? (
        <p className={state.error ? styles.error : styles.saved} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
