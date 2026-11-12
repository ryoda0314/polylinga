import Link from "next/link";
import { Icon } from "@/components/Icon";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { DAY, loadSofar } from "@/lib/me";
import { loadNetwork } from "@/lib/network";
import { requireSettings } from "@/lib/settings";
import styles from "../app.module.css";
import { DaysView, FormsView, MineView } from "./views";
import { WordNetwork } from "./WordNetwork";

export const metadata = { title: "自分" };

const VIEWS = ["days", "forms", "mine"] as const;
type View = (typeof VIEWS)[number];

export default async function MePage({ searchParams }: PageProps<"/app/me">) {
  const [{ user }, settings, params] = await Promise.all([requireUser(), requireSettings(), searchParams]);
  const t = getDict(settings.nativeLang);
  const view: View = VIEWS.find((v) => v === params.view) ?? "days";
  const before = typeof params.before === "string" && DAY.test(params.before) ? params.before : null;
  const [sofar, net] = await Promise.all([
    loadSofar(user.id, settings.targetLang),
    loadNetwork(user.id, settings.targetLang, settings.nativeLang),
  ]);
  const props = { userId: user.id, target: settings.targetLang, native: settings.nativeLang, t };

  const stats = [
    { key: "rains", value: sofar.rains },
    { key: "patterns", value: sofar.patterns },
    { key: "said", value: sofar.said },
    { key: "words", value: sofar.words },
  ] as const;

  return (
    <>
      <header className={styles.subbar}>
        <h1 className={styles.subtitleStrong} style={{ paddingLeft: 12 }}>
          {t.me.title}
        </h1>
        <Link href="/app/me/settings" className={styles.pair}>
          <Icon name="sliders" size={18} />
          {t.me.settings}
        </Link>
      </header>
      <div className={styles.bodyTight}>
        <section className={styles.stackSm} aria-labelledby="me-sofar">
          <h2 id="me-sofar" className="label">
            {t.me.sofar}
          </h2>
          <dl className={styles.stats}>
            {stats.map((s) => (
              <div key={s.key} className={styles.stat}>
                <dt>{t.me.stats[s.key]}</dt>
                <dd>
                  {s.value}
                  {t.me.statUnits[s.key] ? <small>{t.me.statUnits[s.key]}</small> : null}
                </dd>
              </div>
            ))}
          </dl>
          <p className={styles.note}>{t.me.sofarNote}</p>
          <Link href="/app/me/export" className={styles.quietAction}>
            {t.me.exportLink}
          </Link>
        </section>

        {/* ことばの網: what the rain has grown, in the language learned (meanings only when a point is pressed). */}
        <section className={styles.stackSm} aria-labelledby="me-net">
          <h2 id="me-net" className="label">
            {t.me.net.title}
          </h2>
          <p className={styles.note}>{t.me.net.lead}</p>
          {net.nodes.length >= 3 ? (
            <WordNetwork
              net={net}
              native={settings.nativeLang}
              target={settings.targetLang}
              labels={{
                title: t.me.net.title,
                legendForm: t.me.net.legendForm,
                legendWord: t.me.net.legendWord,
                legendHeard: t.me.net.legendHeard,
                legendSaid: t.me.net.legendSaid,
                legendToday: t.me.net.legendToday,
                pick: t.me.net.pick,
                with: t.me.net.with,
                sentences: t.me.net.sentences,
                formPage: t.me.net.formPage,
                full: t.me.net.full,
                close: t.me.net.close,
                fit: t.me.net.fit,
                howTo: t.me.net.howTo,
              }}
            />
          ) : (
            <p className={styles.note}>{t.me.net.empty}</p>
          )}
          {net.pending > 0 ? <p className={styles.note}>{t.me.net.pending(net.pending)}</p> : null}
        </section>

        <nav className={styles.views} aria-label={t.me.viewsLabel}>
          {VIEWS.map((v) => (
            <Link
              key={v}
              href={v === "days" ? "/app/me" : `/app/me?view=${v}`}
              className={styles.view}
              aria-current={v === view ? "page" : undefined}
            >
              {t.me.views[v]}
            </Link>
          ))}
        </nav>

        {view === "days" ? (
          <DaysView {...props} before={before} />
        ) : view === "forms" ? (
          <FormsView {...props} />
        ) : (
          <MineView {...props} sharing={settings.shareRain} />
        )}
      </div>
    </>
  );
}
