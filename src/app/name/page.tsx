import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { safeNext } from "@/lib/safe-next";
import { LAUNCH_NATIVE } from "@/lib/settings";
import { USERNAME_MAX } from "@/lib/username";
import styles from "../login/login.module.css";
import { NameForm } from "./NameForm";

export const metadata = { title: "ユーザー名" };

/** A new account names itself before anything else (the proxy sends it here), then goes on to `next`. */
export default async function NamePage({ searchParams }: PageProps<"/name">) {
  const [{ user }, { next: asked }] = await Promise.all([requireUser(), searchParams]);
  const next = safeNext(typeof asked === "string" ? asked : null);
  if (user.username) redirect(next);
  const t = getDict(LAUNCH_NATIVE);

  return (
    <div className={styles.page}>
      <Logo size="md" href={null} />
      <div className={styles.card}>
        <h1 className={styles.h1}>{t.name.title}</h1>
        <p className={styles.lead}>{t.name.lead}</p>
        <NameForm
          next={next}
          labels={{ label: t.name.label, limit: t.name.limit(USERNAME_MAX), submit: t.name.submit, saving: t.name.saving }}
        />
      </div>
    </div>
  );
}
