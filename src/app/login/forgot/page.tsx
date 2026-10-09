import Link from "next/link";
import { Logo } from "@/components/Logo";
import styles from "../login.module.css";
import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "パスワードを再設定" };

export default function ForgotPage() {
  return (
    <div className={styles.page}>
      <Logo size="md" />
      <div className={styles.card}>
        <h1 className={styles.h1}>パスワードを再設定</h1>
        <p className={styles.lead}>登録したメールアドレスに、新しいパスワードを決めるためのリンクを送ります。</p>
        <ForgotForm />
        <Link href="/login" className={styles.textLink}>
          ログインに戻る
        </Link>
      </div>
    </div>
  );
}
