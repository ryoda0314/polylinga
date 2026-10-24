"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { connectPath } from "@/lib/sisters";
import styles from "../login/login.module.css";
import { connect } from "./actions";

/** つなぐ, or another account, or back without connecting. */
export function ConnectForm({ app, back, state, name }: { app: string; back: string; state: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true);
    setError("");
    const result = await connect(app, back, state);
    if (result.ok) {
      window.location.assign(result.url);
      return;
    }
    setBusy(false);
    setError(
      result.reason === "invalid"
        ? `つなぎ先が分かりませんでした。もう一度、${name}の「ことのあめでつなぐ」から始めてください。`
        : result.reason === "signedOut"
          ? "ログインが切れていました。もう一度ログインしてください。"
          : "つなげませんでした。少し待ってから、もう一度お試しください。",
    );
  }

  async function otherAccount() {
    setBusy(true);
    await createClient().auth.signOut();
    router.replace(`/login?next=${encodeURIComponent(connectPath(app, back, state))}`);
    router.refresh();
  }

  return (
    <div className={styles.stack}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" className="btn" onClick={go} disabled={busy}>
        {busy ? "つないでいます…" : `${name}につなぐ`}
      </button>
      <button type="button" className="btn-quiet" onClick={otherAccount} disabled={busy}>
        別のアカウントにする
      </button>
      <a href={`${back}/login`} className={styles.textLink}>
        つながずに{name}へ戻る
      </a>
    </div>
  );
}
