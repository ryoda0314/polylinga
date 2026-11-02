import Link from "next/link";
import { Logo } from "@/components/Logo";
import { redirect } from "next/navigation";
import { signInCopy } from "@/lib/i18n/sign-in";
import { safeNext } from "@/lib/safe-next";
import { connectingTo, connectLang } from "@/lib/sisters";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

// Where to go once signed in, when the link says (a sister app's つなぐ, /connect); otherwise the usual places.
const nextOf = (asked: string | string[] | undefined) => (typeof asked === "string" ? safeNext(asked) : undefined);

export async function generateMetadata({ searchParams }: PageProps<"/login">) {
  return { title: signInCopy(connectLang(nextOf((await searchParams).next))).login.title };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, next: asked } = await searchParams;
  const next = nextOf(asked);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next ?? "/app");

  const sister = connectingTo(next);
  // On the way to a sister for Korean speakers (글씨앗, 말씨앗), in Korean.
  const lang = connectLang(next);
  const t = signInCopy(lang).login;

  return (
    <div className={styles.page} lang={lang}>
      <Logo size="md" />
      <div className={styles.card}>
        <h1 className={styles.h1}>{t.heading}</h1>
        <p className={styles.lead}>{sister ? t.leadSister(sister) : t.lead}</p>
        {error ? <p className={styles.error}>{t.error}</p> : null}
        <LoginForm next={next} lang={lang} />
      </div>
      <p className={styles.small}>
        {t.agree.before}
        <Link href="/terms">{t.agree.terms}</Link>
        {t.agree.and}
        <Link href="/privacy">{t.agree.privacy}</Link>
        {t.agree.after}
      </p>
    </div>
  );
}
