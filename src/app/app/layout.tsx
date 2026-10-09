import { BottomNav } from "@/components/BottomNav";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getSettings, LAUNCH_NATIVE } from "@/lib/settings";
import styles from "./app.module.css";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  await requireUser();
  const settings = await getSettings(); // null until the learner picks a language on /start
  const t = getDict(settings?.nativeLang ?? LAUNCH_NATIVE);

  return (
    <div className={styles.shell} data-accent={settings?.accent ?? "rain"}>
      <main className={styles.main}>{children}</main>
      <BottomNav labels={t.nav} />
    </div>
  );
}
