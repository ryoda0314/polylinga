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
import { readingFor } from "@/lib/reading";
import { requireSettings } from "@/lib/settings";
import { correctSaying } from "../../actions";
import styles from "../../app.module.css";
import { WriteForm } from "./WriteForm";

export const metadata = { title: "言ってみる" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CorrectionRow = { id: string; input: string; corrected: string; result: CorrectionResult; created_at: string };

export default async function SayingPage({ params }: PageProps<"/app/s/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const settings = await requireSettings();
  const { supabase, user } = await requireUser();
  const { data: saying } = await supabase
    .from("pl_sayings")
    .select("id, intent, native_lang, target_lang, matches, pattern_id")
    .eq("id", id)
    .maybeSingle();
  if (!saying || !isLang(saying.native_lang) || !isLang(saying.target_lang)) notFound();

  const native: Lang = saying.native_lang;
  const target: Lang = saying.target_lang;
  const t = getDict(native);

  const [{ data: correctionRows }, left] = await Promise.all([
    supabase
      .from("pl_corrections")
      .select("id, input, corrected, result, created_at")
      .eq("saying_id", id)
      .order("created_at", { ascending: false }),
    usesLeft(user.id, "corrections"),
  ]);
  const corrections = (correctionRows ?? []) as CorrectionRow[];
  const latest = corrections[0];
  const title = saying.intent ?? (saying.pattern_id ? t.write.fromShower : "");

  const writeForm = (
    <WriteForm
      action={correctSaying.bind(null, saying.id)}
      left={left}
      targetClass={langClass(target)}
      labels={{
        write: t.saying.writeLabel(t.start.targets[target]),
        hint: t.saying.writeHint,
        submit: t.saying.submit,
        pending: t.saying.pending,
        left: t.saying.left(left),
        out: t.saying.outOfUses(LIMITS.corrections.user),
      }}
    />
  );

  return (
    <>
      <header className={styles.subbar}>
        <Link href={saying.pattern_id ? "/app" : "/app/write"} className={styles.iconLink} aria-label={t.common.back}>
          <Icon name="back" size={22} />
        </Link>
        <h1 className={`${styles.subtitle} ${langClass(native)}`}>{title}</h1>
      </header>

      <div className={styles.bodyTight}>
        {latest ? (
          <>
            <CorrectionView correction={latest} target={target} native={native} rate={settings.speechRate} t={t} />
            <PatternsView correction={latest} target={target} native={native} rate={settings.speechRate} t={t} />
            <details className={styles.fold}>
              <summary>{t.saying.rewrite}</summary>
              {writeForm}
            </details>
            {corrections.length > 1 ? (
              <details className={styles.fold}>
                <summary>{t.saying.earlier}</summary>
                {corrections.slice(1).map((c) => (
                  <div key={c.id} className={styles.earlier}>
                    <span className={`${styles.rowSub} ${langClass(target)}`}>{c.input}</span>
                    <span className={`${styles.rowMain} ${langClass(target)}`}>{c.corrected}</span>
                  </div>
                ))}
              </details>
            ) : null}
          </>
        ) : (
          <>
            {writeForm}
            <Hints
              patternId={saying.pattern_id}
              ids={((saying.matches ?? []) as { sentence_id: string }[]).map((m) => m.sentence_id)}
              target={target}
              native={native}
              rate={settings.speechRate}
              t={t}
            />
          </>
        )}
      </div>
    </>
  );
}

async function Hints({
  patternId,
  ids,
  target,
  native,
  rate,
  t,
}: {
  patternId: string | null;
  ids: string[];
  target: Lang;
  native: Lang;
  rate: number;
  t: Dict;
}) {
  const hints = patternId
    ? ((await patternExamples([patternId], target, native, 4)).get(patternId) ?? [])
    : await loadSentences(ids, target, native);
  if (hints.length === 0) return null;
  return (
    <section>
      <h2 className="label">{patternId ? t.saying.showerTitle : t.saying.hintsTitle}</h2>
      {hints.map((s) => (
        <ExampleRow key={s.id} sentence={s} lang={target} native={native} rate={rate} t={t} />
      ))}
    </section>
  );
}

function ExampleRow({
  sentence,
  lang,
  native,
  rate,
  t,
  onlyPattern,
}: {
  sentence: ShownSentence;
  lang: Lang;
  native: Lang;
  rate: number;
  t: Dict;
  onlyPattern?: string;
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
        <span className={`${styles.exampleText} ${langClass(lang)}`}>
          <SentenceText text={sentence.text} highlights={marks} reading={sentence.reading} />
        </span>
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
}: {
  correction: CorrectionRow;
  target: Lang;
  native: Lang;
  rate: number;
  t: Dict;
}) {
  const result = correction.result;
  const { removed, added } = diffRanges(correction.input, correction.corrected, target);
  const after: Highlight[] = [
    ...added.map((r) => ({ ...r, kind: "ins" as const })),
    ...(result.patterns ?? []).map((p) => ({ start: p.start, end: p.end, kind: "mark" as const })),
  ];

  return (
    <>
      <section className={styles.stackSm}>
        <h2 className="label">{t.saying.yours}</h2>
        <p className={`${styles.yours} ${langClass(target)}`}>
          <SentenceText text={correction.input} highlights={removed.map((r) => ({ ...r, kind: "del" }))} />
        </p>
      </section>

      <section className={`${styles.stackSm} ${styles.divider}`}>
        <h2 className="label">{result.natural ? t.saying.natural : t.saying.corrected}</h2>
        <div className={styles.fixedRow}>
          <p className={`${styles.fixed} ${langClass(target)}`}>
            <SentenceText text={correction.corrected} highlights={after} reading={readingFor(correction.corrected, target)} />
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
        <div>
          <CopyButton
            text={correction.corrected}
            labels={{ copy: t.common.copy, copied: t.common.copied, failed: t.common.copyFailed }}
          />
        </div>
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
}: {
  correction: CorrectionRow;
  target: Lang;
  native: Lang;
  rate: number;
  t: Dict;
}) {
  const found = correction.result.patterns ?? [];
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
                  <ExampleRow key={s.id} sentence={s} lang={target} native={native} rate={rate} t={t} onlyPattern={f.id} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
