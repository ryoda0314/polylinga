import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { requireUser } from "@/lib/auth";
import { signInCopy } from "@/lib/i18n/sign-in";
import { safeNext } from "@/lib/safe-next";
import { connectLang } from "@/lib/sisters";
import { USERNAME_MAX } from "@/lib/username";
import styles from "../login/login.module.css";
import { NameForm } from "./NameForm";

export async function generateMetadata({ searchParams }: PageProps<"/name">) {
  const { next } = await searchParams;
  return { title: signInCopy(connectLang(typeof next === "string" ? next : null)).name.pageTitle };
}

/**
 * A new account names itself before anything else (the proxy sends it here), then goes on to `next`. On the way to a
 * sister for Korean speakers (its つなぐ), in Korean.
 */
export default async function NamePage({ searchParams }: PageProps<"/name">) {
  const [{ user }, { next: asked }] = await Promise.all([requireUser(), searchParams]);
  const next = safeNext(typeof asked === "string" ? asked : null);
  if (user.username) redirect(next);
  const lang = connectLang(next);
  const t = signInCopy(lang).name;

  return (
    <div className={styles.page} lang={lang}>
      <Logo size="md" href={null} />
      <div className={styles.card}>
        <h1 className={styles.h1}>{t.title}</h1>
        <p className={styles.lead}>{t.lead}</p>
        <NameForm next={next} labels={{ field: t.field(USERNAME_MAX), submit: t.submit, saving: t.saving }} />
      </div>
    </div>
  );
}
