"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../login.module.css";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/login/reset`,
    });
    // Rate limiting is the only error worth telling apart; whether the address exists is never revealed.
    setState(error?.status === 429 ? "error" : "sent");
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
          送信が続いたため、少し待つ必要があります。1分ほどしてからお試しください。
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={state === "sending"}>
        {state === "sending" ? "送っています…" : "リンクを送る"}
      </button>
    </form>
  );
}
