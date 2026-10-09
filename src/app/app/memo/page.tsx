import { SentenceText } from "@/components/SentenceText";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { langClass } from "@/lib/langs";
import { readingFor } from "@/lib/reading";
import { requireSettings } from "@/lib/settings";
import { wordStage } from "@/lib/shower-core";
import styles from "../app.module.css";
import { WordAddForm, WordActions } from "./WordControls";

export const metadata = { title: "メモ" };

type WordRow = {
  id: string;
  text: string;
  note: string | null;
  encounters: number;
  uses: number;
  understood: boolean;
};

export default async function MemoPage() {
  const settings = await requireSettings();
  const { supabase, user } = await requireUser();
  const t = getDict(settings.nativeLang);
  const { data } = await supabase
    .from("pl_words")
    .select("id, text, note, encounters, uses, understood")
    .eq("user_id", user.id)
    .eq("lang", settings.targetLang)
    .order("last_seen_at", { ascending: false })
    .limit(300);
  const words = (data ?? []) as WordRow[];

  return (
    <>
      <header className={styles.subbar}>
        <h1 className={styles.subtitleStrong} style={{ paddingLeft: 12 }}>
          {t.words.title}
        </h1>
      </header>
      <div className={styles.bodyTight}>
        <p className={styles.lead}>{t.words.lead}</p>
        <WordAddForm native={settings.nativeLang} target={settings.targetLang} />

        <section>
          <div className={styles.listHead}>
            <h2>{t.words.title}</h2>
            <span className={styles.count}>{t.common.count(words.length)}</span>
          </div>
          {words.length === 0 ? (
            <p className={styles.empty}>{t.words.empty}</p>
          ) : (
            words.map((w) => {
              const stage = wordStage(w);
              return (
                <div key={w.id} className={styles.row}>
                  <div className={styles.rowText}>
                    <span className={styles.kind} data-stage={stage}>
                      {t.words.stages[stage]}
                    </span>
                    <span className={`${styles.rowMain} ${langClass(settings.targetLang)}`}>
                      <SentenceText text={w.text} reading={readingFor(w.text, settings.targetLang)} />
                    </span>
                    {w.note ? <span className={`${styles.rowSub} ${langClass(settings.nativeLang)}`}>{w.note}</span> : null}
                    <span className={styles.rowSub}>
                      {t.words.met(w.encounters)}
                      {w.uses > 0 ? `・${t.words.used(w.uses)}` : ""}
                    </span>
                  </div>
                  <WordActions wordId={w.id} understood={w.understood} native={settings.nativeLang} />
                </div>
              );
            })
          )}
        </section>
      </div>
    </>
  );
}
