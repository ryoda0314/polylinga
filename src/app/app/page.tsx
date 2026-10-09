import Link from "next/link";
import { Icon } from "@/components/Icon";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { LANG_NATIVE_NAME, langClass } from "@/lib/langs";
import { requireSettings } from "@/lib/settings";
import { pickCluster } from "@/lib/shower";
import { ShowerPlayer } from "./_shower/ShowerPlayer";
import styles from "./app.module.css";

export const metadata = { title: "シャワー" };

export default async function ShowerPage() {
  const settings = await requireSettings();
  const { user } = await requireUser();
  const t = getDict(settings.nativeLang);
  const first = await pickCluster(user.id, settings.targetLang, settings.nativeLang, null);

  return (
    <>
      <header className={styles.topbar}>
        <Link href="/" className={styles.wordmark}>
          PolyLinga
        </Link>
        <Link href="/app/me" className={styles.pair}>
          <span className={langClass(settings.nativeLang)}>{LANG_NATIVE_NAME[settings.nativeLang]}</span>
          <Icon name="arrow" size={16} />
          <span className={langClass(settings.targetLang)}>{LANG_NATIVE_NAME[settings.targetLang]}</span>
        </Link>
      </header>
      <div className={styles.body}>
        <h1 className="sr-only">{t.shower.title}</h1>
        <ShowerPlayer
          initial={first}
          native={settings.nativeLang}
          target={settings.targetLang}
          rate={settings.speechRate}
        />
      </div>
    </>
  );
}
