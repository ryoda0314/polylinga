"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./login.module.css";

type Mode = "login" | "register";

const MIN_PASSWORD = 8;

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (mode === "register" && password.length < MIN_PASSWORD) {
      setError(`パスワードは${MIN_PASSWORD}文字以上にしてください。`);
      return;
    }
    setBusy(true);
    const supabase = createClient();

    if (mode === "login") {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (authError) {
        setError(
          authError.status === 429
            ? "ログインの試行が続いたため、少し待つ必要があります。1分ほどしてからお試しください。"
            : authError.code === "email_not_confirmed"
              ? "メールアドレスの確認がまだです。届いた確認メールのリンクを押してから、もう一度ログインしてください。"
              : "メールアドレスかパスワードが違います。",
        );
        return;
      }
      router.replace("/app");
      router.refresh();
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (authError) {
      setError(
        authError.code === "user_already_exists"
          ? "このメールアドレスはすでに登録されています。ログインしてください。"
          : authError.code === "weak_password"
            ? "このパスワードは使えません。もう少し長く、推測されにくいものにしてください。"
            : "登録できませんでした。メールアドレスを確かめて、もう一度お試しください。",
      );
      return;
    }
    if (data.session) {
      router.replace("/app");
      router.refresh();
    } else {
      setNotice(`${email} に確認メールを送りました。メールのリンクを押すと登録が終わり、そのまま始められます。`);
    }
  }

  async function google() {
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) setError("Google でログインできませんでした。メールアドレスとパスワードをお使いください。");
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
      <button type="button" className="btn-quiet" onClick={google}>
        Google で続ける
      </button>
    </div>
  );
}
