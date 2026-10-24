"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./login.module.css";

type GoogleId = {
  initialize(options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    nonce: string;
    use_fedcm_for_prompt?: boolean;
    itp_support?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

// ことのあめ's own Google client (its consent screen names ことのあめ). Google hands the page an ID token and Supabase signs
// in with it, so nothing goes through the shared project's redirect list (the old app's).
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Google で続ける. Without our own client ID yet, the shared project's Google sign-in (a redirect) is used instead. */
export function GoogleButton({ onError, next }: { onError: (message: string) => void; next?: string }) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const failed = "Google でログインできませんでした。メールアドレスとパスワードをお使いください。";

  useEffect(() => {
    if (!CLIENT_ID || !ready || !box.current || !window.google) return;
    const google = window.google.accounts.id;
    const parent = box.current;
    let cancelled = false;
    // A fresh nonce for this page: Google puts its hash in the token, Supabase checks it against the raw one.
    const raw = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    void sha256Hex(raw).then((hashed) => {
      if (cancelled) return;
      google.initialize({
        client_id: CLIENT_ID,
        nonce: hashed,
        use_fedcm_for_prompt: true,
        itp_support: true,
        callback: async ({ credential }) => {
          const { error } = await createClient().auth.signInWithIdToken({ provider: "google", token: credential, nonce: raw });
          if (error) {
            console.error("[google]", error.message);
            onError(failed);
            return;
          }
          router.replace(next ?? "/app");
          router.refresh();
        },
      });
      google.renderButton(parent, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        locale: "ja",
        width: Math.min(400, Math.round(parent.offsetWidth)),
      });
    });
    return () => {
      cancelled = true;
    };
    // onError is a fresh function each render; the button only needs setting up once the script is there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, router, next]);

  async function redirectSignIn() {
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) onError(failed);
  }

  if (!CLIENT_ID) {
    return (
      <button type="button" className="btn-quiet" onClick={redirectSignIn}>
        Google で続ける
      </button>
    );
  }
  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setReady(true)} />
      <div ref={box} className={styles.google} />
    </>
  );
}
