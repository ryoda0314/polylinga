import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getSession } from "@/lib/auth";
import { signInCopy } from "@/lib/i18n/sign-in";
import { safeNext } from "@/lib/safe-next";
import { connectLang } from "@/lib/sisters";
import styles from "../login.module.css";
import { ResetForm } from "./ResetForm";

// On the way somewhere (a sister's つなぐ, carried by the reset mail): in that sister's language, and on there afterwards.
const nextOf = (asked: string | string[] | undefined) => (typeof asked === "string" ? safeNext(asked, "") || undefined : undefined);

export async function generateMetadata({ searchParams }: PageProps<"/login/reset">) {
  return { title: signInCopy(connectLang(nextOf((await searchParams).next))).reset.title };
}

// Reached from the reset email: the link signs the learner in, then they choose a new password here.
export default async function ResetPage({ searchParams }: PageProps<"/login/reset">) {
  const [{ user }, { next: asked }] = await Promise.all([getSession(), searchParams]);
  const next = nextOf(asked);
  const lang = connectLang(next);
  const t = signInCopy(lang).reset;

  return (
    <div className={styles.page} lang={lang}>
      <Logo size="md" />
      <div className={styles.card}>
        <h1 className={styles.h1}>{t.title}</h1>
        {user ? (
          <ResetForm next={next} lang={lang} />
        ) : (
          <>
            <p className={styles.lead}>{t.expired}</p>
            <Link href={next ? `/login/forgot?${new URLSearchParams({ next })}` : "/login/forgot"} className="btn">
              {t.resend}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
