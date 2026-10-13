import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { LANG_NATIVE_NAME, langClass } from "@/lib/langs";
import { rainSoFar } from "@/lib/me";
import { pickMinnaCluster, reachedSomeone } from "@/lib/minna";
import { requireSettings } from "@/lib/settings";
import { pickCluster } from "@/lib/shower";
import { ShowerPlayer } from "./_shower/ShowerPlayer";
import showerStyles from "./_shower/shower.module.css";
import styles from "./app.module.css";

export const metadata = { title: "浴びる" };

export default async function ShowerPage({ searchParams }: PageProps<"/app">) {
  const [settings, { user }, params] = await Promise.all([requireSettings(), requireUser(), searchParams]);
  const t = getDict(settings.nativeLang);
  // Two rains: the library's (ことのあめ), and other learners' corrected sentences (みんなの雨).
  const source = params.rain === "minna" ? "minna" : "library";
  // The day so far is read before this visit's rain is recorded: it says whether this is today's first rain.
  const [first, reached, sofar] = await Promise.all([
    source === "minna"
      ? pickMinnaCluster(user.id, settings.targetLang, settings.nativeLang, null)
      : pickCluster(user.id, settings.targetLang, settings.nativeLang, null),
    reachedSomeone(user.id, settings.reachedSeenAt),
    rainSoFar(user.id, settings.targetLang),
  ]);

  return (
    <>
      <header className={styles.topbar}>
        <Logo size="sm" href="/" />
        <Link href="/app/me" className={styles.pair}>
          <span className={langClass(settings.nativeLang)}>{LANG_NATIVE_NAME[settings.nativeLang]}</span>
          <Icon name="arrow" size={16} />
          <span className={langClass(settings.targetLang)}>{LANG_NATIVE_NAME[settings.targetLang]}</span>
        </Link>
      </header>
      <div className={styles.body}>
        <h1 className="sr-only">{t.shower.title}</h1>
        <nav className={showerStyles.sources} aria-label={t.shower.sourceLabel}>
          <Link href="/app" className={showerStyles.source} aria-current={source === "library" ? "page" : undefined}>
            {t.shower.sourceLibrary}
          </Link>
          <Link href="/app?rain=minna" className={showerStyles.source} aria-current={source === "minna" ? "page" : undefined}>
            {t.shower.sourceMinna}
          </Link>
        </nav>
        <ShowerPlayer
          key={source}
          initial={first}
          source={source}
          reached={reached}
          sharing={settings.shareRain}
          habit={{
            cue: settings.rainCue,
            ask: !settings.rainCueAsked && !settings.rainCue,
            firstToday: !sofar.today,
            back: sofar.back,
          }}
          native={settings.nativeLang}
          target={settings.targetLang}
          rate={settings.speechRate}
        />
      </div>
    </>
  );
}
