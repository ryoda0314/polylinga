import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getSession } from "@/lib/auth";
import { signInCopy } from "@/lib/i18n/sign-in";
import { connectPath, destinationFor, SISTERS, sisterLang, validState } from "@/lib/sisters";
import styles from "../login/login.module.css";
import { ConnectForm } from "./ConnectForm";

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export async function generateMetadata({ searchParams }: PageProps<"/connect">) {
  return { title: signInCopy(sisterLang(one((await searchParams).app))).connect.title };
}

/**
 * つなぐ: a sister app (ことのは, ことのおと…) sends its learner here to sign in with their ことのあめ account. Signed out,
 * they log in or sign up first and come back here (after a new account's mail too); signed in, one press sends them
 * back signed in there as well (actions.ts). In the sister's language (Korean for ことのたね and ことのはし).
 */
export default async function ConnectPage({ searchParams }: PageProps<"/connect">) {
  const params = await searchParams;
  const app = one(params.app);
  const state = one(params.state);
  const dest = destinationFor(app, one(params.back));
  const lang = sisterLang(app);
  const t = signInCopy(lang).connect;

  if (!dest || !validState(state)) {
    return (
      <div className={styles.page} lang={lang}>
        <Logo size="md" />
        <div className={styles.card}>
          <h1 className={styles.h1}>{t.invalidHeading}</h1>
          <p className={styles.lead}>{t.invalidLead}</p>
        </div>
        <p className={styles.small}>{t.sisters(Object.values(SISTERS).map((s) => s.name))}</p>
      </div>
    );
  }

  const { user } = await getSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(connectPath(dest.id, dest.origin, state))}`);

  return (
    <div className={styles.page} lang={lang}>
      <Logo size="md" />
      <div className={styles.card}>
        <h1 className={styles.h1}>{t.heading(dest.name)}</h1>
        <p className={styles.lead}>{t.lead(user.email ?? "", dest.name)}</p>
        <ConnectForm app={dest.id} back={dest.origin} state={state} name={dest.name} lang={lang} />
      </div>
    </div>
  );
}
