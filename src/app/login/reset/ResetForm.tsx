"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../login.module.css";

const MIN_PASSWORD = 8;

export function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`パスワードは${MIN_PASSWORD}文字以上にしてください。`);
      return;
    }
    setBusy(true);
    setError("");
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(
        updateError.code === "same_password"
          ? "前と同じパスワードは使えません。"
          : updateError.code === "weak_password"
            ? "このパスワードは使えません。もう少し長く、推測されにくいものにしてください。"
            : "変更できませんでした。もう一度お試しください。",
      );
      return;
    }
    router.replace("/app");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className={styles.stack}>
      <label htmlFor="password" className="label">
        新しいパスワード（{MIN_PASSWORD}文字以上）
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
        {busy ? "変更しています…" : "このパスワードにする"}
      </button>
    </form>
  );
}
