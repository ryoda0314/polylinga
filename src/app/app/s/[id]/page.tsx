import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { Icon } from "@/components/Icon";
import { SentenceText, type Highlight } from "@/components/SentenceText";
import { SpeakButton } from "@/components/SpeakButton";
import type { CorrectionResult } from "@/lib/ai";
import { audioUrl } from "@/lib/audio";
import { requireUser } from "@/lib/auth";
import { approvedPatterns, functionLabels, loadSentences, patternExamples, type ShownSentence } from "@/lib/corpus";
import { diffRanges } from "@/lib/diff";
import { getDict, type Dict } from "@/lib/i18n";
import { isLang, langClass, type Lang } from "@/lib/langs";
import { LIMITS, usesLeft } from "@/lib/metering";
import { sharedSentences } from "@/lib/minna";
import { readingFor } from "@/lib/reading";
import { requireSettings } from "@/lib/settings";
import type { ShowerSentence } from "@/lib/shower";
import { findMemoHits } from "@/lib/shower-core";
import { Material } from "../../_shower/Material";
import { correctSaying } from "../../actions";
import styles from "../../app.module.css";
import { DeleteSaying } from "./DeleteSaying";
import { ExplainPanel } from "./ExplainPanel";
import { MemoButton, MemoTap } from "./MemoTap";
import { WriteForm } from "./WriteForm";

export const metadata = { title: "言ってみる" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CorrectionRow = { id: string; input: string; corrected: string; result: CorrectionResult; created_at: string };
/**
 * What a saying keeps of the sentences it came with: the rain a way of saying was tried with, or the hints of the old
 * 書いてみる (a Japanese intent first; 自由に添削 keeps none).
 */
type Match = { sentence_id?: unknown; shared_id?: unknown };

export default async function SayingPage({ params }: PageProps<"/app/s/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const settings = await requireSettings();
  const { supabase, user } = await requireUser();
  const { data: saying } = await supabase
    .from("pl_sayings")
    .select("id, intent, nuance, native_lang, target_lang, matches, pattern_id")
    .eq("id", id)
    .maybeSingle();
  if (!saying || !isLang(saying.native_lang) || !isLang(saying.target_lang)) notFound();

  const native: Lang = saying.native_lang;
  const target: Lang = saying.target_lang;
  const t = getDict(native);

  const patternId = typeof saying.pattern_id === "string" ? saying.pattern_id : null;
  const matches = (Array.isArray(saying.matches) ? saying.matches : []) as Match[];
  const [{ data: correctionRows }, left, { data: memoRows }, tried, way] = await Promise.all([
    supabase
      .from("pl_corrections")
      .select("id, input, corrected, result, created_at")
      .eq("saying_id", id)
      .order("created_at", { ascending: false }),
    usesLeft(user.id, "corrections"),
    // Memo words show where they turn up here too: the same dotted violet as in the rain.
    supabase.from("pl_words").select("text").eq("user_id", user.id).eq("lang", target),
    patternId ? triedWith(matches, patternId, target, native, user.id) : [],
    patternId ? wayOf(patternId, target, native) : null,
  ]);
  const memo = (memoRows ?? []).map((w) => String(w.text));
  const material = tried.map((s) => ({ ...s, memoHits: findMemoHits(s.text, memo) }));
  const corrections = (correctionRows ?? []) as CorrectionRow[];
  const latest = corrections[0];
  const title = saying.intent ?? (patternId ? t.write.fromShower : t.write.title);

  const writeForm = (
    <WriteForm
      action={correctSaying.bind(null, saying.id)}
      draftKey={`saying:${saying.id}`}
      left={left}
      targetClass={langClass(target)}
      labels={{
        write: t.saying.writeLabel(t.common.langs[target]),
        hint: t.saying.writeHint,
        submit: t.saying.submit,
        pending: t.saying.pending,
        left: t.saying.left(left),
        out: t.saying.outOfUses(LIMITS.corrections.user),
      }}
    />
  );

  const header = (
    <header className={styles.subbar}>
      <Link href={patternId ? "/app" : "/app/write"} className={styles.iconLink} aria-label={t.common.back}>
        <Icon name="back" size={22} />
      </Link>
      <h1 className={`${styles.subtitle} ${langClass(native)}`}>{title}</h1>
    </header>
  );
  const rewrite = (
    <details className={styles.fold}>
      <summary>{t.saying.rewrite}</summary>
      {writeForm}
    </details>
  );
  const earlier =
    corrections.length > 1 ? (
      <details className={styles.fold}>
        <summary>{t.saying.earlier}</summary>
        {corrections.slice(1).map((c) => (
          <div key={c.id} className={styles.earlier}>
            <span className={`${styles.rowSub} ${langClass(target)}`}>{c.input}</span>
            <span className={`${styles.rowMain} ${langClass(target)}`}>{c.corrected}</span>
          </div>
        ))}
      </details>
    ) : null;
  // A way of saying tried with a rain: once it is corrected, the next rain is the way on (the rain itself has no 次の雨).
  // It rains from where the sentences came from, another way of saying than this one.
  const fromMinna = matches.some((m) => typeof m.shared_id === "string");
  const nextRain = patternId ? (
    <Link href={`/app?${fromMinna ? "rain=minna&" : ""}after=${encodeURIComponent(patternId)}`} className="btn">
      {t.saying.nextRain}
    </Link>
  ) : null;
  const foot = (
    <div className={`${styles.pageFoot} ${styles.full}`}>
      <DeleteSaying
        sayingId={saying.id}
        labels={{
          delete: t.saying.delete,
          confirm: t.saying.deleteConfirm,
          cancel: t.common.cancel,
          note: t.saying.deleteNote,
          deleting: t.saying.deleting,
        }}
      />
    </div>
  );

  if (material.length) {
    // Said with a rain's sentences: they stay where they were while it was written (on a wide screen on the left),
    // beside the correction and another try. On a phone the correction and 次の雨 come first, then the sentences,
    // right above もう一度書く. The way of saying the rain was about is lit in them, so it is not listed again below.
    return (
      <>
        {header}
        <div className={`${styles.bodyTight} ${styles.split}`}>
          <div className={`${styles.col} ${styles.stick}`}>
            <Material
              id="write-ref"
              label={t.saying.material}
              sentences={material}
              lit
              way={way}
              native={native}
              target={target}
              rate={settings.speechRate}
              compact
            />
          </div>
          <div className={styles.col}>
            {latest ? (
              <>
                <div className={styles.result}>
                  <CorrectionView correction={latest} target={target} native={native} rate={settings.speechRate} t={t} memo={memo} nuance={saying.nuance} />
                  {nextRain}
                </div>
                {rewrite}
                {earlier}
                <PatternsView
                  correction={latest}
                  target={target}
                  native={native}
                  rate={settings.speechRate}
                  t={t}
                  memo={memo}
                  skip={patternId}
                />
              </>
            ) : (
              writeForm
            )}
          </div>
          {foot}
        </div>
      </>
    );
  }

  return (
    <>
      {header}

      {/* With a correction, a wide screen shows it on the left and the same way of saying, rewriting and earlier
          attempts on the right. Before one, a single column: the hints sit right above the field. */}
      <div className={latest ? `${styles.bodyTight} ${styles.split}` : `${styles.bodyTight} ${styles.narrow}`}>
        {latest ? (
          <>
            <div className={styles.col}>
              <CorrectionView correction={latest} target={target} native={native} rate={settings.speechRate} t={t} memo={memo} nuance={saying.nuance} />
              {nextRain}
            </div>
            <div className={styles.col}>
            <PatternsView correction={latest} target={target} native={native} rate={settings.speechRate} t={t} memo={memo} />
            {rewrite}
            {earlier}
            </div>
          </>
        ) : (
          <>
            <Hints
              patternId={patternId}
              ids={matches.flatMap((m) => (typeof m.sentence_id === "string" ? [m.sentence_id] : []))}
              target={target}
              native={native}
              rate={settings.speechRate}
              t={t}
              memo={memo}
            />
            {writeForm}
          </>
        )}
        {foot}
      </div>
    </>
  );
}

/**
 * The sentences a way of saying was tried with (言ってみる after a rain, or in 自分), in the order they fell, lit at
 * that way of saying. Sayings from before these were kept have none.
 */
async function triedWith(matches: Match[], patternId: string, target: Lang, native: Lang, userId: string): Promise<ShowerSentence[]> {
  const ids = (key: keyof Match) => matches.flatMap((m) => (typeof m[key] === "string" ? [m[key] as string] : []));
  const [library, shared] = await Promise.all([
    loadSentences(ids("sentence_id"), target, native),
    sharedSentences(ids("shared_id"), patternId, target, userId),
  ]);
  return [
    ...library.map((s) => {
      const mark = s.marks.find((m) => m.patternId === patternId) ?? s.marks[0];
      const glossMark = s.glossMarks[0];
      return {
        id: s.id,
        text: s.text,
        gloss: s.gloss,
        reading: s.reading,
        audio: s.audio,
        mark: mark ? { start: mark.start, end: mark.end } : null,
        glossMark: glossMark ? { start: glossMark.start, end: glossMark.end } : null,
        seenBefore: true,
        memoHits: [],
      };
    }),
    ...shared,
  ];
}

/** What a way of saying does, in the learner's own words (誘う). */
async function wayOf(patternId: string, target: Lang, native: Lang): Promise<string | null> {
  const [patterns, labels] = await Promise.all([approvedPatterns(target), functionLabels()]);
  const pattern = patterns.find((p) => p.id === patternId);
  return pattern ? (labels.get(pattern.functionId)?.[native] ?? null) : null;
}

async function Hints({
  patternId,
  ids,
  target,
  native,
  rate,
  t,
  memo,
}: {
  patternId: string | null;
  ids: string[];
  target: Lang;
  native: Lang;
  rate: number;
  t: Dict;
  memo: string[];
}) {
  const [hints, patterns, labels] = await Promise.all([
    patternId
      ? patternExamples([patternId], target, native, 4).then((m) => m.get(patternId) ?? [])
      : loadSentences(ids, target, native),
    approvedPatterns(target),
    functionLabels(),
  ]);
  if (patternId && hints.length === 0) return null;
  // Each hint is a different way of saying (the old 書いてみる search picked one per function): name it, as the rain does.
  const labelOf = (s: ShownSentence) => {
    const pattern = patterns.find((p) => p.id === s.marks[0]?.patternId);
    return pattern ? (labels.get(pattern.functionId)?.[native] ?? null) : null;
  };
  return (
    // Above the field, short and scrollable, so it stays in view while typing (WriteForm scrolls to it on focus).
    <section id="write-ref" className={styles.refBox}>
      <h2 className="label">{patternId ? t.saying.showerTitle : t.saying.hintsTitle}</h2>
      {patternId ? null : <p className={styles.note}>{hints.length ? t.saying.hintsNote : t.saying.hintsNone}</p>}
      {hints.length ? (
        <div className={styles.refScroll}>
          {hints.map((s) => (
            <ExampleRow
              key={s.id}
              sentence={s}
              lang={target}
              native={native}
              rate={rate}
              t={t}
              memo={memo}
              label={patternId ? null : labelOf(s)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ExampleRow({
  sentence,
  lang,
  native,
  rate,
  t,
  memo,
  onlyPattern,
  label,
}: {
  sentence: ShownSentence;
  lang: Lang;
  native: Lang;
  rate: number;
  t: Dict;
  memo: string[];
  onlyPattern?: string;
  /** The way of saying it shows (誘う), for hints. */
  label?: string | null;
}) {
  const marks: Highlight[] = sentence.marks
    .filter((m) => !onlyPattern || m.patternId === onlyPattern)
    .map((m) => ({ start: m.start, end: m.end, kind: "mark" }));
  // Each example belongs to one function, so its translation has one matching part: light it too.
  const glossMarks: Highlight[] = marks.length
    ? sentence.glossMarks.map((m) => ({ start: m.start, end: m.end, kind: "mark" }))
    : [];
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        {label ? <span className={styles.kind}>{label}</span> : null}
        <MemoTap
          sentence={{ id: sentence.id, text: sentence.text, reading: sentence.reading }}
          native={native}
          target={lang}
          rate={rate}
          className={`${styles.exampleText} ${langClass(lang)}`}
        >
          <SentenceText
            text={sentence.text}
            highlights={[...marks, ...findMemoHits(sentence.text, memo).map((h) => ({ ...h, kind: "memo" as const }))]}
            reading={sentence.reading}
          />
        </MemoTap>
        <span className={`${styles.gloss} ${langClass(native)}`}>
          <SentenceText text={sentence.gloss} highlights={glossMarks} />
        </span>
      </div>
      <SpeakButton
        text={sentence.text}
        lang={lang}
        audio={sentence.audio}
        rate={rate}
        label={t.common.play}
        failedLabel={t.common.playFailed}
      />
    </div>
  );
}

function CorrectionView({
  correction,
  target,
  native,
  rate,
  t,
  memo,
  nuance,
}: {
  correction: CorrectionRow;
  target: Lang;
  native: Lang;
  rate: number;
  t: Dict;
  memo: string[];
  /** How the learner asked it to sound (自由に添削's ニュアンス), shown with what they wrote. */
  nuance: string | null;
}) {
  const result = correction.result;
  const { removed, added } = diffRanges(correction.input, correction.corrected, target);
  const after: Highlight[] = [
    ...added.map((r) => ({ ...r, kind: "ins" as const })),
    ...(result.patterns ?? []).map((p) => ({ start: p.start, end: p.end, kind: "mark" as const })),
    ...findMemoHits(correction.corrected, memo).map((h) => ({ ...h, kind: "memo" as const })),
  ];
  const reading = readingFor(correction.corrected, target);
  const fixedSentence = { id: null, text: correction.corrected, reading };

  return (
    <>
      <section className={styles.stackSm}>
        <h2 className="label">{t.saying.yours}</h2>
        <p className={`${styles.yours} ${langClass(target)}`}>
          <SentenceText text={correction.input} highlights={removed.map((r) => ({ ...r, kind: "del" }))} />
        </p>
        {nuance ? <p className={`${styles.note} ${langClass(native)}`}>{t.saying.nuance(nuance)}</p> : null}
      </section>

      <section className={`${styles.stackSm} ${styles.divider}`}>
        <h2 className="label">{result.natural ? t.saying.natural : t.saying.corrected}</h2>
        <div className={styles.fixedRow}>
          <p className={`${styles.fixed} ${langClass(target)}`}>
            <MemoTap sentence={fixedSentence} native={native} target={target} rate={rate}>
              <SentenceText text={correction.corrected} highlights={after} reading={reading} />
            </MemoTap>
          </p>
          <SpeakButton
            text={correction.corrected}
            lang={target}
            audio={{ src: audioUrl(correction.corrected, target), fallback: `/api/tts?correction=${correction.id}` }}
            rate={rate}
            solid
            label={t.common.play}
            failedLabel={t.common.playFailed}
          />
        </div>
        <p className={`${styles.gloss} ${langClass(native)}`}>{result.meaning}</p>
        <div className={styles.actions}>
          <CopyButton
            text={correction.corrected}
            labels={{ copy: t.common.copy, copied: t.common.copied, failed: t.common.copyFailed }}
          />
          <MemoButton sentence={fixedSentence} native={native} target={target} rate={rate} />
        </div>
        <ExplainPanel
          correctionId={correction.id}
          text={correction.corrected}
          translation={result.meaning ?? ""}
          reading={reading}
          initial={result.breakdown?.length ? result.breakdown : null}
          native={native}
          target={target}
        />
      </section>

      <section className={styles.panel}>
        <h2 className="label">{result.natural ? t.saying.good : t.saying.why}</h2>
        <p className={`${styles.explain} ${langClass(native)}`}>{result.explanation}</p>
      </section>
    </>
  );
}

async function PatternsView({
  correction,
  target,
  native,
  rate,
  t,
  memo,
  skip = null,
}: {
  correction: CorrectionRow;
  target: Lang;
  native: Lang;
  rate: number;
  t: Dict;
  memo: string[];
  /** A way of saying the page shows elsewhere (lit in the sentences it was tried with). */
  skip?: string | null;
}) {
  const found = (correction.result.patterns ?? []).filter((f) => f.id !== skip);
  if (found.length === 0) return null;
  const [patterns, labels, examples] = await Promise.all([
    approvedPatterns(target),
    functionLabels(),
    patternExamples(
      found.map((f) => f.id),
      target,
      native,
    ),
  ]);

  // No grammar notation here either: what the pattern does in plain words, then sentences that share it.
  return (
    <section className={styles.stack}>
      <h2 className={styles.sectionTitle}>{t.saying.patternsTitle}</h2>
      {found.map((f) => {
        const pattern = patterns.find((p) => p.id === f.id);
        if (!pattern) return null;
        const label = labels.get(pattern.functionId)?.[native];
        const list = examples.get(f.id) ?? [];
        return (
          <div key={f.id} className={styles.patternBlock}>
            {label ? <h3 className={`${styles.patternLabel} ${langClass(native)}`}>{label}</h3> : null}
            <div>
              {list.length === 0 ? (
                <p className={styles.empty}>{t.saying.noPatternExamples}</p>
              ) : (
                list.map((s) => (
                  <ExampleRow key={s.id} sentence={s} lang={target} native={native} rate={rate} t={t} memo={memo} onlyPattern={f.id} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
