"use client";

import { useState } from "react";
import { requestReset } from "../actions";
import styles from "../login.module.css";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    // ことのあめ's own mail (actions.ts). Only the daily limit is told apart; whether the address exists is never revealed.
    const result = await requestReset(email);
    setState(!result.ok && result.reason === "limit" ? "error" : "sent");
  }

  if (state === "sent") {
    return (
      <div className={styles.sent} role="status">
        <strong>{email}</strong> が登録されていれば、リンクを送りました。メールのリンクを開いて、新しいパスワードを決めてください。
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={styles.stack}>
      <label htmlFor="email" className="label">
        メールアドレス
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={styles.input}
      />
      {state === "error" ? (
        <p className={styles.error} role="alert">
          このアドレスへのメールは、今日はもう送れません。明日もう一度お試しください。
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={state === "sending"}>
        {state === "sending" ? "送っています…" : "リンクを送る"}
      </button>
    </form>
  );
}
