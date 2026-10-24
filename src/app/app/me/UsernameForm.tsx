"use client";

import { useEffect, useRef, useState } from "react";
import { renameAccount } from "../actions";
import styles from "../app.module.css";
import { TYPING_PAUSE_MS } from "./SettingsForm";

type Status = { kind: "saving" | "saved" | "failed"; message: string | null };

/**
 * ユーザー名 in settings (chosen first on /name), saved like the rest of the page: once typing pauses, or when the
 * learner leaves the field or the page. Left empty, it goes back to the name saved.
 */
export function UsernameForm({
  current,
  labels,
}: {
  current: string;
  labels: { label: string; limit: string; saving: string; saved: string; saveFailed: string };
}) {
  const [name, setName] = useState(current);
  const [status, setStatus] = useState<Status | null>(null);
  const saved = useRef(current);
  const waiting = useRef<{ timer: number; save: () => void } | null>(null);
  const saves = useRef(0);

  async function save(value: string) {
    const typed = value.trim();
    if (!typed || typed === saved.current) return;
    const n = ++saves.current;
    setStatus({ kind: "saving", message: null });
    const result = await renameAccount(value).catch(() => ({ message: labels.saveFailed, error: true }));
    if (!result.error) saved.current = typed;
    if (n === saves.current) setStatus({ kind: result.error ? "failed" : "saved", message: result.message });
  }

  function type(value: string) {
    setName(value);
    if (waiting.current) window.clearTimeout(waiting.current.timer);
    const later = () => {
      waiting.current = null;
      void save(value);
    };
    waiting.current = { timer: window.setTimeout(later, TYPING_PAUSE_MS), save: later };
  }

  function flush() {
    const pending = waiting.current;
    if (pending) {
      window.clearTimeout(pending.timer);
      pending.save();
    }
  }

  useEffect(() => {
    const pending = waiting;
    return () => {
      if (!pending.current) return;
      window.clearTimeout(pending.current.timer);
      pending.current.save();
    };
  }, []);

  return (
    <form
      className={styles.field}
      onSubmit={(e) => {
        e.preventDefault();
        flush();
      }}
    >
      <label htmlFor="username" className="label">
        {labels.label}
      </label>
      <input
        id="username"
        name="username"
        type="text"
        required
        value={name}
        autoComplete="nickname"
        className={styles.textInput}
        onChange={(e) => type(e.target.value)}
        onBlur={() => {
          flush();
          if (!name.trim()) setName(saved.current);
        }}
      />
      <span className={styles.note}>{labels.limit}</span>
      {status ? (
        <p className={status.kind === "failed" ? styles.error : styles.saved} role="status">
          {status.kind === "saving" ? labels.saving : status.kind === "saved" ? labels.saved : (status.message ?? labels.saveFailed)}
        </p>
      ) : null}
    </form>
  );
}
