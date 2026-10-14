import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { LANG_NATIVE_NAME, langClass } from "@/lib/langs";
import { rainSoFar } from "@/lib/me";
import { pickMinnaCluster, reachedSomeone } from "@/lib/minna";
import { readingFor } from "@/lib/reading";
import { requireSettings } from "@/lib/settings";
import { pickCluster } from "@/lib/shower";
import { ShowerPlayer } from "./_shower/ShowerPlayer";
import { WordRain } from "./_shower/WordRain";
import showerStyles from "./_shower/shower.module.css";
import styles from "./app.module.css";

export const metadata = { title: "浴びる" };

export default async function ShowerPage({ searchParams }: PageProps<"/app">) {
  const [settings, { supabase, user }, params] = await Promise.all([requireSettings(), requireUser(), searchParams]);
  const t = getDict(settings.nativeLang);
  // Three rains: the library's (ことのあめ), other learners' corrected sentences (みんなの雨), and the learner's own memo
  // words with their meanings (単語の雨).
  const source = params.rain === "minna" ? "minna" : params.rain === "words" ? "words" : "library";
  // The day so far is read before this visit's rain is recorded: it says whether this is today's first rain.
  const [first, reached, sofar, { data: memo }] = await Promise.all([
    source === "words"
      ? null
      : source === "minna"
        ? pickMinnaCluster(user.id, settings.targetLang, settings.nativeLang, null)
        : pickCluster(user.id, settings.targetLang, settings.nativeLang, null),
    reachedSomeone(user.id, settings.reachedSeenAt),
    rainSoFar(user.id, settings.targetLang),
    source === "words"
      ? supabase.from("pl_words").select("id, text, note").eq("user_id", user.id).eq("lang", settings.targetLang).limit(1000)
      : { data: null },
  ]);

  return (
    <>
      {/* On a wide screen the name and the language pair are in the column on the left. */}
      <header className={`${styles.topbar} ${styles.mobileOnly}`}>
        <Logo size="sm" href="/" />
        <Link href="/app/me" className={styles.pair}>
          <span className={langClass(settings.nativeLang)}>{LANG_NATIVE_NAME[settings.nativeLang]}</span>
          <Icon name="arrow" size={16} />
          <span className={langClass(settings.targetLang)}>{LANG_NATIVE_NAME[settings.targetLang]}</span>
        </Link>
      </header>
      <div className={styles.body}>
        <h1 className="sr-only">{t.shower.title}</h1>
        {settings.tutorialSeen ? null : (
          <Link href="/tutorial" className={showerStyles.tour}>
            {t.tutorial.first}
            <Icon name="arrow" size={16} />
          </Link>
        )}
        <nav className={showerStyles.sources} aria-label={t.shower.sourceLabel}>
          <Link href="/app" className={showerStyles.source} aria-current={source === "library" ? "page" : undefined}>
            {t.shower.sourceLibrary}
          </Link>
          <Link href="/app?rain=minna" className={showerStyles.source} aria-current={source === "minna" ? "page" : undefined}>
            {t.shower.sourceMinna}
          </Link>
          <Link href="/app?rain=words" className={showerStyles.source} aria-current={source === "words" ? "page" : undefined}>
            {t.shower.sourceWords}
          </Link>
        </nav>
        {source === "words" ? (
          <WordRain
            words={(memo ?? []).map((w) => ({
              id: String(w.id),
              text: String(w.text),
              note: (w.note as string | null) ?? null,
              reading: readingFor(String(w.text), settings.targetLang),
            }))}
            native={settings.nativeLang}
            target={settings.targetLang}
            rate={settings.speechRate}
          />
        ) : (
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
        )}
      </div>
    </>
  );
}
