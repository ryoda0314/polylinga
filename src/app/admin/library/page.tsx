import Link from "next/link";
import { SentenceText } from "@/components/SentenceText";
import { LANG_CODE_LABEL, LANGS, langClass, type Lang } from "@/lib/langs";
import { createAdminClient } from "@/lib/supabase/server";
import styles from "../admin.module.css";
import { approveFunction, setPatternStatus, setSentenceStatus } from "./actions";
import { PatternEditor } from "./PatternEditor";
import { SentenceEditor } from "./SentenceEditor";

export const metadata = { title: "かたち図鑑の確認" };

type Status = "draft" | "approved" | "rejected";
type FunctionRow = { id: string; position: number; label: Record<Lang, string> };
type Verdict = { ok: boolean; note: string; suggestion: string };
type Review = { checked_at: string; langs: Partial<Record<Lang, Verdict>> } | null;
type PatternRow = {
  id: string;
  lang: Lang;
  form: string;
  meaning: Record<Lang, string>;
  examples: string | null;
  status: Status;
  function_id: string | null;
  source: string;
  review: Review;
};
type SentenceRow = { id: string; key: string; topic: string; status: Status; source: string; review: Review } & Record<
  Lang,
  string
>;
type MarkRow = { sentence_id: string; pattern_id: string; lang: Lang; start_index: number; end_index: number };

const STATUS_LABEL: Record<Status, string> = { draft: "下書き", approved: "公開中", rejected: "却下" };

function ReviewNote({ verdict, lang }: { verdict: Verdict | undefined; lang?: Lang }) {
  if (!verdict || verdict.ok) return null;
  return (
    <span className={styles.flag}>
      <strong>要確認</strong> {verdict.note}
      {verdict.suggestion ? (
        <>
          {" "}
          <span className={styles.suggestion}>
            案：<span className={lang ? langClass(lang) : undefined}>{verdict.suggestion}</span>
          </span>
        </>
      ) : null}
    </span>
  );
}

/** Every row of a query, page by page (the API returns at most 1000 rows per request). */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await page(from, from + 999);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

export default async function LibraryPage({ searchParams }: PageProps<"/admin/library">) {
  const admin = createAdminClient();
  const [{ data: fnRows }, patterns, sentences] = await Promise.all([
    admin.from("pl_functions").select("id, position, label").order("position"),
    all<PatternRow>((from, to) =>
      admin.from("pl_patterns").select("id, lang, form, meaning, examples, status, function_id, source, review").order("id").range(from, to),
    ),
    all<SentenceRow>((from, to) =>
      admin.from("pl_sentences").select("id, key, topic, ja, en, ko, zh, status, source, review").order("key").range(from, to),
    ),
  ]);
  const functions = (fnRows ?? []) as FunctionRow[];

  const drafts = (fid: string) =>
    patterns.filter((p) => p.function_id === fid && p.status === "draft").length +
    sentences.filter((s) => s.topic === fid && s.status === "draft").length;

  const { f } = await searchParams;
  const requested = Array.isArray(f) ? f[0] : f;
  const selected =
    functions.find((fn) => fn.id === requested) ?? functions.find((fn) => drafts(fn.id) > 0) ?? functions[0];

  const fnPatterns = selected
    ? LANGS.map((l) => patterns.find((p) => p.function_id === selected.id && p.lang === l)).filter(
        (p): p is PatternRow => !!p,
      )
    : [];
  const fnSentences = selected ? sentences.filter((s) => s.topic === selected.id) : [];
  const { data: markRows } = fnSentences.length
    ? await admin
        .from("pl_sentence_patterns")
        .select("sentence_id, pattern_id, lang, start_index, end_index")
        .in(
          "sentence_id",
          fnSentences.map((s) => s.id),
        )
    : { data: [] };
  const marks = (markRows ?? []) as MarkRow[];
  const totalDrafts = functions.reduce((n, fn) => n + drafts(fn.id), 0);
  const flagged = (fid: string) =>
    sentences.filter(
      (s) => s.topic === fid && s.status === "draft" && Object.values(s.review?.langs ?? {}).some((v) => v && !v.ok),
    ).length +
    patterns.filter(
      (p) => p.function_id === fid && p.status === "draft" && Object.values(p.review?.langs ?? {}).some((v) => v && !v.ok),
    ).length;

  return (
    <div className={styles.layout}>
      <nav className={styles.side} aria-label="働き">
        <p className={styles.sideHead}>働き {functions.length}・下書き {totalDrafts}</p>
        {functions.map((fn) => {
          const n = drafts(fn.id);
          return (
            <Link
              key={fn.id}
              href={`/admin/library?f=${fn.id}`}
              className={fn.id === selected?.id ? `${styles.sideItem} ${styles.sideActive}` : styles.sideItem}
              aria-current={fn.id === selected?.id ? "page" : undefined}
            >
              <span>{fn.label.ja}</span>
              {n > 0 ? (
                <span className={styles.counts}>
                  {flagged(fn.id) > 0 ? <span className={styles.flagCount}>要確認 {flagged(fn.id)}</span> : null}
                  <span className={styles.badge}>{n}</span>
                </span>
              ) : (
                <span className={styles.done}>公開</span>
              )}
            </Link>
          );
        })}
      </nav>

      {selected ? (
        <main className={styles.main}>
          <div className={styles.titleRow}>
            <div>
              <h1 className={styles.h1}>{selected.label.ja}</h1>
              <p className={styles.sub}>
                {selected.id} · {selected.label.en} · <span className="t-ko">{selected.label.ko}</span> ·{" "}
                <span className="t-zh">{selected.label.zh}</span>
              </p>
            </div>
            {drafts(selected.id) > 0 ? (
              <form action={approveFunction.bind(null, selected.id)}>
                <button type="submit" className="btn">
                  下書きをまとめて公開
                </button>
              </form>
            ) : null}
          </div>
          <p className={styles.help}>
            自然でない文や印のずれは「編集」で直すか「却下」にしてから公開してください。公開した例文は学習者の検索・例文・「また出会う」に出ます。
          </p>

          <h2 className={styles.h2}>かたち</h2>
          <div className={styles.grid}>
            {fnPatterns.map((p) => (
              <article key={p.id} className={styles.card} data-status={p.status}>
                <div className={styles.cardHead}>
                  <span className="mono">{LANG_CODE_LABEL[p.lang]}</span>
                  <span className={styles.status}>{STATUS_LABEL[p.status]}</span>
                </div>
                <div className={`${styles.form} ${langClass(p.lang)}`}>{p.form}</div>
                {p.examples ? <div className={`${styles.examples} ${langClass(p.lang)}`}>{p.examples}</div> : null}
                <p className={styles.meaning}>{p.meaning.ja}</p>
                <ReviewNote verdict={p.review?.langs?.[p.lang]} />
                <details className={styles.more}>
                  <summary>ほかの言語の説明</summary>
                  <p className={styles.meaning}>EN: {p.meaning.en}</p>
                  <p className={`${styles.meaning} t-ko`}>KO: {p.meaning.ko}</p>
                  <p className={`${styles.meaning} t-zh`}>ZH: {p.meaning.zh}</p>
                </details>
                <div className={styles.actions}>
                  <PatternEditor pattern={p} />
                  <form action={setPatternStatus.bind(null, p.id, p.status === "rejected" ? "draft" : "rejected")}>
                    <button type="submit" className={styles.small}>
                      {p.status === "rejected" ? "戻す" : "却下"}
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>

          <h2 className={styles.h2}>例文</h2>
          <div className={styles.list}>
            {fnSentences.map((s) => {
              const own = marks.filter((m) => m.sentence_id === s.id);
              return (
                <article key={s.id} className={styles.card} data-status={s.status}>
                  <div className={styles.cardHead}>
                    <span className="mono">{s.key}</span>
                    <span className={styles.status}>
                      {STATUS_LABEL[s.status]}
                      {s.source === "ai" ? "・AI" : ""}
                    </span>
                  </div>
                  <div className={styles.lines}>
                    {LANGS.map((l) => {
                      const m = own.find((x) => x.lang === l);
                      return (
                        <div key={l} className={styles.line}>
                          <span className="mono">{LANG_CODE_LABEL[l]}</span>
                          <span className={langClass(l)}>
                            <SentenceText
                              text={s[l]}
                              highlights={m ? [{ start: m.start_index, end: m.end_index, kind: "mark" }] : []}
                            />
                            <ReviewNote verdict={s.review?.langs?.[l]} lang={l} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className={styles.actions}>
                    <SentenceEditor
                      sentence={s}
                      marks={Object.fromEntries(
                        LANGS.map((l) => {
                          const m = own.find((x) => x.lang === l);
                          return [l, m ? s[l].slice(m.start_index, m.end_index) : ""];
                        }),
                      ) as Record<Lang, string>}
                    />
                    <form action={setSentenceStatus.bind(null, s.id, s.status === "rejected" ? "draft" : "rejected")}>
                      <button type="submit" className={styles.small}>
                        {s.status === "rejected" ? "戻す" : "却下"}
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        </main>
      ) : (
        <main className={styles.main}>
          <p className={styles.help}>まだ働きがありません。scripts/seed.mjs と scripts/draft-library.mjs を実行してください。</p>
        </main>
      )}
    </div>
  );
}
