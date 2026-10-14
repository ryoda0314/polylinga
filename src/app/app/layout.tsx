import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { LANG_NATIVE_NAME, langClass } from "@/lib/langs";
import { getSettings, LAUNCH_NATIVE } from "@/lib/settings";
import styles from "./app.module.css";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  await requireUser();
  const settings = await getSettings(); // null until the learner picks a language on /start
  const t = getDict(settings?.nativeLang ?? LAUNCH_NATIVE);

  return (
    <div className={styles.shell} data-accent={settings?.accent ?? "rain"}>
      <main className={styles.main}>{children}</main>
      <BottomNav
        labels={t.nav}
        brand={<Logo size="sm" href="/app" />}
        side={
          settings ? (
            <Link href="/app/me/settings" className={styles.pair}>
              <span className={langClass(settings.nativeLang)}>{LANG_NATIVE_NAME[settings.nativeLang]}</span>
              <Icon name="arrow" size={16} />
              <span className={langClass(settings.targetLang)}>{LANG_NATIVE_NAME[settings.targetLang]}</span>
            </Link>
          ) : null
        }
      />
    </div>
  );
}
