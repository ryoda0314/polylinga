"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInCopy, type SignInCopy } from "@/lib/i18n/sign-in";
import type { SisterLang } from "@/lib/sisters";
import { createClient } from "@/lib/supabase/client";
import { register, resendConfirmation, type MailResult } from "./actions";
import { GoogleButton } from "./GoogleButton";
import styles from "./login.module.css";

type Mode = "login" | "register";

const MIN_PASSWORD = 8;

function mailError(result: Exclude<MailResult, { ok: true }>, t: SignInCopy["form"]): string {
  switch (result.reason) {
    case "invalid":
      return t.invalid;
    case "exists":
      return t.exists;
    case "weak":
      return t.weak(MIN_PASSWORD);
    case "limit":
      return t.limit;
    default:
      return t.mailFailed;
  }
}

/**
 * `next`: where to go once signed in (and where a new account's mail leads), when the link said; else the usual places.
 * `lang`: Korean on the way to a sister for Korean speakers (src/lib/sisters.ts connectLang).
 */
export function LoginForm({ next, lang = "ja" }: { next?: string; lang?: SisterLang }) {
  const t = signInCopy(lang).form;
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Tried to log in before confirming: offer the confirmation mail again.
  const [unconfirmed, setUnconfirmed] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
    setUnconfirmed(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setUnconfirmed(false);
    if (mode === "register" && password.length < MIN_PASSWORD) {
      setError(t.weak(MIN_PASSWORD));
      return;
    }
    setBusy(true);

    if (mode === "login") {
      const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
      setBusy(false);
      if (authError) {
        setUnconfirmed(authError.code === "email_not_confirmed");
        setError(authError.status === 429 ? t.busy : authError.code === "email_not_confirmed" ? t.unconfirmed : t.wrong);
        return;
      }
      router.replace(next ?? "/app");
      router.refresh();
      return;
    }

    // ことのあめ's own confirmation mail (actions.ts); the account cannot log in until its link is pressed.
    const result = await register(email, password, next);
    setBusy(false);
    if (result.ok) setNotice(t.sent(email));
    else setError(mailError(result, t));
  }

  async function sendAgain() {
    setBusy(true);
    const result = await resendConfirmation(email, next);
    setBusy(false);
    if (result.ok) {
      setUnconfirmed(false);
      setError("");
      setNotice(t.sent(email));
    } else setError(mailError(result, t));
  }

  return (
    <div className={styles.stack}>
      <div className={styles.tabs} role="tablist" aria-label={t.tabs}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={mode === "login" ? styles.tabOn : styles.tab}
          onClick={() => switchMode("login")}
        >
          {t.login}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          className={mode === "register" ? styles.tabOn : styles.tab}
          onClick={() => switchMode("register")}
        >
          {t.register}
        </button>
      </div>

      {notice ? (
        <div className={styles.sent} role="status">
          {notice}
        </div>
      ) : (
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
          <label htmlFor="password" className="label">
            {t.password}
            {mode === "register" ? t.passwordMin(MIN_PASSWORD) : ""}
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={mode === "register" ? MIN_PASSWORD : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
          />
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          {unconfirmed ? (
            <button type="button" className="btn-quiet" onClick={sendAgain} disabled={busy}>
              {t.resend}
            </button>
          ) : null}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? t.checking : mode === "login" ? t.submitLogin : t.submitRegister}
          </button>
          {mode === "login" ? (
            <Link href={next ? `/login/forgot?${new URLSearchParams({ next })}` : "/login/forgot"} className={styles.textLink}>
              {t.forgot}
            </Link>
          ) : null}
        </form>
      )}

      <div className={styles.or}>{t.or}</div>
      <GoogleButton onError={setError} next={next} lang={lang} />
    </div>
  );
}
