import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata = { title: "ログイン" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");

  const { error } = await searchParams;

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.wordmark}>
        PolyLinga
      </Link>
      <div className={styles.card}>
        <h1 className={styles.h1}>はじめる・ログイン</h1>
        <p className={styles.lead}>旧 PolyLinga のアカウントも、そのまま使えます。</p>
        {error ? <p className={styles.error}>ログインできませんでした。もう一度お試しください。</p> : null}
        <LoginForm />
      </div>
      <p className={styles.small}>
        続けると<Link href="/terms">利用規約</Link>と<Link href="/privacy">プライバシーポリシー</Link>に同意したことになります。
      </p>
    </div>
  );
}
