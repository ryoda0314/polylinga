import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/langs";
import { readingFor } from "@/lib/reading";
import { requireSettings } from "@/lib/settings";
import { wordStage } from "@/lib/shower-core";
import styles from "../app.module.css";
import { MemoBoard } from "./MemoBoard";
import { WordAddForm } from "./WordControls";
import type { MemoWord } from "./words";

export const metadata = { title: "メモ" };

type WordRow = {
  id: string;
  text: string;
  note: string | null;
  memo_count: number;
  encounters: number;
  uses: number;
  understood: boolean;
  created_at: string;
  last_met_at: string | null;
};

const DAY = 24 * 60 * 60 * 1000;

function toMemoWords(rows: WordRow[], target: Lang): MemoWord[] {
  const now = Date.now();
  return rows.map((w) => ({
    id: w.id,
    text: w.text,
    note: w.note,
    memoCount: w.memo_count,
    encounters: w.encounters,
    uses: w.uses,
    understood: w.understood,
    stage: wordStage(w),
    reading: readingFor(w.text, target),
    since: w.created_at,
    metDaysAgo: w.last_met_at ? Math.floor((now - Date.parse(w.last_met_at)) / DAY) : null,
  }));
}

export default async function MemoPage() {
  const settings = await requireSettings();
  const { supabase, user } = await requireUser();
  const t = getDict(settings.nativeLang);
  const { data } = await supabase
    .from("pl_words")
    .select("id, text, note, memo_count, encounters, uses, understood, created_at, last_met_at")
    .eq("user_id", user.id)
    .eq("lang", settings.targetLang)
    .order("last_seen_at", { ascending: false })
    .limit(300);
  const words = toMemoWords((data ?? []) as WordRow[], settings.targetLang);

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
        <MemoBoard words={words} native={settings.nativeLang} target={settings.targetLang} rate={settings.speechRate} />
      </div>
    </>
  );
}
