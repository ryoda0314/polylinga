import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { LANG_NATIVE_NAME } from "@/lib/langs";
import { LAUNCH_TARGETS, requireSettings } from "@/lib/settings";
import { signOut } from "../actions";
import styles from "../app.module.css";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "自分" };

export default async function MePage() {
  const [{ user }, settings] = await Promise.all([requireUser(), requireSettings()]);
  const t = getDict(settings.nativeLang);

  return (
    <>
      <header className={styles.subbar}>
        <h1 className={styles.subtitleStrong} style={{ paddingLeft: 12 }}>
          {t.me.title}
        </h1>
      </header>
      <div className={styles.bodyTight}>
        <SettingsForm
          settings={settings}
          targets={LAUNCH_TARGETS.map((l) => ({ value: l, label: `${t.start.targets[l]}（${LANG_NATIVE_NAME[l]}）` }))}
          labels={{
            native: t.me.native,
            nativeFixed: t.me.nativeFixed,
            nativeNote: t.me.nativeNote,
            target: t.me.target,
            accent: t.me.accent,
            accentNames: t.me.accentNames,
            preview: t.me.preview,
            rate: t.me.rate,
            rates: t.me.rates,
            save: t.me.save,
            saving: t.me.saving,
          }}
        />
        <section className={styles.stackSm} style={{ borderTop: "1px solid var(--line)", paddingTop: 24 }}>
          <h2 className="label">{t.me.account}</h2>
          <p className={styles.rowSub} style={{ margin: 0, overflowWrap: "anywhere" }}>
            {user.email}
          </p>
          <form action={signOut}>
            <button type="submit" className="btn-quiet" style={{ width: "100%" }}>
              {t.me.logout}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
