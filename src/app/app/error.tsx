"use client";

import Link from "next/link";
import { getDict } from "@/lib/i18n";
import styles from "./app.module.css";

// Unexpected failures inside the app (database or network trouble). Learner-facing copy, no stack traces.
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = getDict("ja");
  return (
    <div className={styles.review}>
      <h1 className={styles.h1}>{t.errors.title}</h1>
      <p className={styles.lead}>{t.errors.body}</p>
      <button type="button" className="btn" onClick={reset}>
        {t.errors.retry}
      </button>
      <Link href="/app" className="btn-quiet">
        {t.errors.home}
      </Link>
    </div>
  );
}
