import Link from "next/link";
import { Logo } from "@/components/Logo";
import { signInCopy } from "@/lib/i18n/sign-in";
import { safeNext } from "@/lib/safe-next";
import { connectLang } from "@/lib/sisters";
import styles from "../login.module.css";
import { ForgotForm } from "./ForgotForm";

// On the way somewhere (a sister's つなぐ, from its login page): in that sister's language, and back there afterwards.
const nextOf = (asked: string | string[] | undefined) => (typeof asked === "string" ? safeNext(asked, "") || undefined : undefined);

export async function generateMetadata({ searchParams }: PageProps<"/login/forgot">) {
  return { title: signInCopy(connectLang(nextOf((await searchParams).next))).forgot.title };
}

export default async function ForgotPage({ searchParams }: PageProps<"/login/forgot">) {
  const next = nextOf((await searchParams).next);
  const lang = connectLang(next);
  const t = signInCopy(lang).forgot;
  return (
    <div className={styles.page} lang={lang}>
      <Logo size="md" />
      <div className={styles.card}>
        <h1 className={styles.h1}>{t.title}</h1>
        <p className={styles.lead}>{t.lead}</p>
        <ForgotForm next={next} lang={lang} />
        <Link href={next ? `/login?${new URLSearchParams({ next })}` : "/login"} className={styles.textLink}>
          {t.back}
        </Link>
      </div>
    </div>
  );
}
