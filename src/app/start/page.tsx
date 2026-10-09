import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Rain } from "@/components/Rain";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { LANG_NATIVE_NAME, langClass } from "@/lib/langs";
import { getSettings, LAUNCH_NATIVE, LAUNCH_TARGETS } from "@/lib/settings";
import { chooseTarget } from "./actions";
import styles from "./start.module.css";

export const metadata = { title: "はじめる" };

export default async function StartPage({ searchParams }: PageProps<"/start">) {
  await requireUser();
  const settings = await getSettings();
  const { change, error } = await searchParams;
  if (settings && !change) redirect("/app");
  const t = getDict(LAUNCH_NATIVE);
  const current = settings?.targetLang ?? "ko";

  return (
    <main className={styles.page}>
      <div className={styles.sky}>
        <Rain />
        <div className={styles.brand}>
          <Logo size="lg" href={null} />
          <p className={styles.tagline}>{t.app.tagline}</p>
        </div>
      </div>
      <form action={chooseTarget} className={styles.card}>
        <h1 className={styles.h1}>{t.start.title}</h1>
        <p className={styles.lead}>{t.start.lead}</p>
        <fieldset className={styles.options}>
          <legend className="sr-only">{t.start.title}</legend>
          {LAUNCH_TARGETS.map((lang) => (
            <label key={lang} className={styles.option}>
              <input type="radio" name="target_lang" value={lang} defaultChecked={lang === current} required />
              <span className={styles.optionName}>{t.start.targets[lang]}</span>
              <span className={`${styles.optionNative} ${langClass(lang)}`}>{LANG_NATIVE_NAME[lang]}</span>
            </label>
          ))}
        </fieldset>
        {error ? (
          <p className={styles.error} role="alert">
            {t.start.choose}
          </p>
        ) : null}
        <button type="submit" className="btn">
          {t.start.submit}
        </button>
        <p className={styles.note}>{t.start.nativeNote}</p>
      </form>
    </main>
  );
}
