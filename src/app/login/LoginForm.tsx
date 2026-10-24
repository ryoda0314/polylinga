"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { register, resendConfirmation, type MailResult } from "./actions";
import { GoogleButton } from "./GoogleButton";
import styles from "./login.module.css";

type Mode = "login" | "register";

const MIN_PASSWORD = 8;

const sentNotice = (email: string) =>
  `${email} に確認メールを送りました。メールのリンクを押すと登録が終わり、そのまま始められます。届かないときは、迷惑メールのフォルダも見てください。`;

function mailError(result: Exclude<MailResult, { ok: true }>): string {
  switch (result.reason) {
    case "invalid":
      return "メールアドレスを確かめてください。";
    case "exists":
      return "このメールアドレスはすでに登録されています。ログインしてください。";
    case "weak":
      return `パスワードは${MIN_PASSWORD}文字以上にしてください。`;
    case "limit":
      return "このアドレスへのメールは、今日はもう送れません。明日もう一度お試しください。";
    default:
      return "メールを送れませんでした。少し待ってから、もう一度お試しください。";
  }
}

/** `next`: where to go once signed in (and where a new account's mail leads), when the link said; else the usual places. */
export function LoginForm({ next }: { next?: string }) {
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
      setError(`パスワードは${MIN_PASSWORD}文字以上にしてください。`);
      return;
    }
    setBusy(true);

    if (mode === "login") {
      const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
      setBusy(false);
      if (authError) {
        setUnconfirmed(authError.code === "email_not_confirmed");
        setError(
          authError.status === 429
            ? "ログインの試行が続いたため、少し待つ必要があります。1分ほどしてからお試しください。"
            : authError.code === "email_not_confirmed"
              ? "メールアドレスの確認がまだです。届いた確認メールのリンクを押してから、もう一度ログインしてください。"
              : "メールアドレスかパスワードが違います。",
        );
        return;
      }
      router.replace(next ?? "/app");
      router.refresh();
      return;
    }

    // ことのあめ's own confirmation mail (actions.ts); the account cannot log in until its link is pressed.
    const result = await register(email, password, next);
    setBusy(false);
    if (result.ok) setNotice(sentNotice(email));
    else setError(mailError(result));
  }

  async function sendAgain() {
    setBusy(true);
    const result = await resendConfirmation(email, next);
    setBusy(false);
    if (result.ok) {
      setUnconfirmed(false);
      setError("");
      setNotice(sentNotice(email));
    } else setError(mailError(result));
  }

  return (
    <div className={styles.stack}>
      <div className={styles.tabs} role="tablist" aria-label="ログインか新規登録か">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={mode === "login" ? styles.tabOn : styles.tab}
          onClick={() => switchMode("login")}
        >
          ログイン
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          className={mode === "register" ? styles.tabOn : styles.tab}
          onClick={() => switchMode("register")}
        >
          新しく登録
        </button>
      </div>

      {notice ? (
        <div className={styles.sent} role="status">
          {notice}
        </div>
      ) : (
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
          <label htmlFor="password" className="label">
            パスワード{mode === "register" ? `（${MIN_PASSWORD}文字以上）` : ""}
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
              確認メールをもう一度送る
            </button>
          ) : null}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "確認しています…" : mode === "login" ? "ログイン" : "登録する"}
          </button>
          {mode === "login" ? (
            <Link href="/login/forgot" className={styles.textLink}>
              パスワードを忘れた
            </Link>
          ) : null}
        </form>
      )}

      <div className={styles.or}>または</div>
      <GoogleButton onError={setError} next={next} />
    </div>
  );
}
