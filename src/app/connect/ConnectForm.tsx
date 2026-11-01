"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInCopy } from "@/lib/i18n/sign-in";
import { createClient } from "@/lib/supabase/client";
import { connectPath, type SisterLang } from "@/lib/sisters";
import styles from "../login/login.module.css";
import { connect } from "./actions";

/** つなぐ, or another account, or back without connecting. In the sister's language. */
export function ConnectForm({
  app,
  back,
  state,
  name,
  lang = "ja",
}: {
  app: string;
  back: string;
  state: string;
  name: string;
  lang?: SisterLang;
}) {
  const t = signInCopy(lang).connect;
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
    setError(result.reason === "invalid" ? t.invalid(name) : result.reason === "signedOut" ? t.signedOut : t.failed);
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
        {busy ? t.busy : t.go(name)}
      </button>
      <button type="button" className="btn-quiet" onClick={otherAccount} disabled={busy}>
        {t.other}
      </button>
      <a href={`${back}/login`} className={styles.textLink}>
        {t.back(name)}
      </a>
    </div>
  );
}
