"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInCopy } from "@/lib/i18n/sign-in";
import type { SisterLang } from "@/lib/sisters";
import { createClient } from "@/lib/supabase/client";
import styles from "../login.module.css";

const MIN_PASSWORD = 8;

/** `next`: a sister's つなぐ the learner was on the way to (on there once the password is set); else the app. */
export function ResetForm({ next, lang = "ja" }: { next?: string; lang?: SisterLang }) {
  const t = signInCopy(lang).reset;
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(t.short(MIN_PASSWORD));
      return;
    }
    setBusy(true);
    setError("");
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.code === "same_password" ? t.same : updateError.code === "weak_password" ? t.weak : t.failed);
      return;
    }
    router.replace(next ?? "/app");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className={styles.stack}>
      <label htmlFor="password" className="label">
        {t.label(MIN_PASSWORD)}
      </label>
      <input
        id="password"
        type="password"
        required
        minLength={MIN_PASSWORD}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={styles.input}
      />
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={busy}>
        {busy ? t.saving : t.submit}
      </button>
    </form>
  );
}
