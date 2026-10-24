import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getSession } from "@/lib/auth";
import { connectPath, destinationFor, SISTERS, validState } from "@/lib/sisters";
import styles from "../login/login.module.css";
import { ConnectForm } from "./ConnectForm";

export const metadata = { title: "つなぐ" };

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

/**
 * つなぐ: a sister app (ことのは, ことのおと…) sends its learner here to sign in with their ことのあめ account. Signed out,
 * they log in or sign up first and come back here (after a new account's mail too); signed in, one press sends them
 * back signed in there as well (actions.ts).
 */
export default async function ConnectPage({ searchParams }: PageProps<"/connect">) {
  const params = await searchParams;
  const app = one(params.app);
  const state = one(params.state);
  const dest = destinationFor(app, one(params.back));

  if (!dest || !validState(state)) {
    return (
      <div className={styles.page}>
        <Logo size="md" />
        <div className={styles.card}>
          <h1 className={styles.h1}>つなげません</h1>
          <p className={styles.lead}>
            つなぎ先が分かりませんでした。もう一度、アプリの「ことのあめでつなぐ」から始めてください。
          </p>
        </div>
        <p className={styles.small}>ことのあめのアカウントでつなげるのは、{Object.values(SISTERS).map((s) => s.name).join("・")}です。</p>
      </div>
    );
  }

  const { user } = await getSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(connectPath(dest.id, dest.origin, state))}`);

  return (
    <div className={styles.page}>
      <Logo size="md" />
      <div className={styles.card}>
        <h1 className={styles.h1}>{dest.name}につなぐ</h1>
        <p className={styles.lead}>
          {user.email} のアカウントで、{dest.name}につなぎます。{dest.name}の記録も、このアカウントに残るようになります。
        </p>
        <ConnectForm app={dest.id} back={dest.origin} state={state} name={dest.name} />
      </div>
    </div>
  );
}
