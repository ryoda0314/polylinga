"use client";

import styles from "./usage.module.css";

// A failed load in the admin pages. On a new setup the usual cause is that the pl_admin_* functions (利用状況, 利用者)
// are not in the database yet.
export default function AdminError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className={styles.page}>
      <h1 className={styles.h1}>読み込めませんでした</h1>
      <p className={styles.help}>
        もう一度読み込んでみてください。利用状況・利用者のページで続くときは、supabase/migrations/20261101000000_admin_usage.sql
        をデータベースに適用したか確認してください。
      </p>
      <button type="button" className={styles.small} onClick={() => retry()}>
        もう一度読み込む
      </button>
    </main>
  );
}
