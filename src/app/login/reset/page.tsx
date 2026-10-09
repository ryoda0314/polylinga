import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getSession } from "@/lib/auth";
import styles from "../login.module.css";
import { ResetForm } from "./ResetForm";

export const metadata = { title: "新しいパスワード" };

// Reached from the reset email: the link signs the learner in, then they choose a new password here.
export default async function ResetPage() {
  const { user } = await getSession();

  return (
    <div className={styles.page}>
      <Logo size="md" />
      <div className={styles.card}>
        <h1 className={styles.h1}>新しいパスワード</h1>
        {user ? (
          <ResetForm />
        ) : (
          <>
            <p className={styles.lead}>リンクの有効期限が切れたか、すでに使われています。もう一度リンクを送ってください。</p>
            <Link href="/login/forgot" className="btn">
              リンクを送り直す
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
