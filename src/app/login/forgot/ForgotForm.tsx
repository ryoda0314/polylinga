"use client";

import { useState } from "react";
import { signInCopy } from "@/lib/i18n/sign-in";
import type { SisterLang } from "@/lib/sisters";
import { requestReset } from "../actions";
import styles from "../login.module.css";

/** `next`: a sister's つなぐ the learner was on the way to (the mail and the new password's page lead back there). */
export function ForgotForm({ next, lang = "ja" }: { next?: string; lang?: SisterLang }) {
  const t = signInCopy(lang).forgot;
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    // ことのあめ's own mail (actions.ts). Only the daily limit is told apart; whether the address exists is never revealed.
    const result = await requestReset(email, next);
    setState(!result.ok && result.reason === "limit" ? "error" : "sent");
  }

  if (state === "sent") {
    return (
      <div className={styles.sent} role="status">
        <strong>{email}</strong>
        {t.sent}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={styles.stack}>
      <label htmlFor="email" className="label">
        {t.email}
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
          {t.limit}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={state === "sending"}>
        {state === "sending" ? t.sending : t.send}
      </button>
    </form>
  );
}
