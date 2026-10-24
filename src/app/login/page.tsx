import Link from "next/link";
import { Logo } from "@/components/Logo";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { connectingTo } from "@/lib/sisters";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata = { title: "ログイン" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, next: asked } = await searchParams;
  // Where to go once signed in, when the link says (a sister app's つなぐ, /connect); otherwise the usual places.
  const next = typeof asked === "string" ? safeNext(asked) : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next ?? "/app");

  const sister = connectingTo(next);

  return (
    <div className={styles.page}>
      <Logo size="md" />
      <div className={styles.card}>
        <h1 className={styles.h1}>はじめる・ログイン</h1>
        {sister ? (
          <p className={styles.lead}>
            {sister}につなぐために、ことのあめのアカウントでログインします。はじめてなら「新しく登録」から。確認メールのリンクを押すと、そのまま{sister}につなげます。
          </p>
        ) : (
          <p className={styles.lead}>前のアプリ PolyLinga のアカウントも、そのまま使えます。</p>
        )}
        {error ? <p className={styles.error}>ログインできませんでした。もう一度お試しください。</p> : null}
        <LoginForm next={next} />
      </div>
      <p className={styles.small}>
        続けると<Link href="/terms">利用規約</Link>と<Link href="/privacy">プライバシーポリシー</Link>に同意したことになります。
      </p>
    </div>
  );
}
