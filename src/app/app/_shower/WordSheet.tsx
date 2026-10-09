"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { SentenceText } from "@/components/SentenceText";
import { SpeakButton, type AudioSource } from "@/components/SpeakButton";
import { getDict } from "@/lib/i18n";
import { langClass, type Lang } from "@/lib/langs";
import type { ShowerSentence } from "@/lib/shower";
import { findSentencesWith, saveWord, type WordState } from "../actions";
import styles from "./shower.module.css";

type Other = {
  id: string;
  text: string;
  gloss: string;
  reading: string[] | null;
  audio: AudioSource;
  hits: { start: number; end: number }[];
};

/** The sentence's words, each once, with where it first appears (so a chip can show its pinyin). */
function wordsOf(text: string, lang: Lang): { word: string; index: number }[] {
  const out = new Map<string, number>();
  try {
    for (const s of new Intl.Segmenter(lang, { granularity: "word" }).segment(text)) {
      if (s.isWordLike && !out.has(s.segment)) out.set(s.segment, s.index);
    }
  } catch {
    for (const w of text.split(/\s+/).filter(Boolean)) if (!out.has(w)) out.set(w, text.indexOf(w));
  }
  return [...out].map(([word, index]) => ({ word, index }));
}

/**
 * A word the learner noticed: see it in other sentences, and type it into the memo themselves
 * (the typing is the point, so the field is never filled in for them).
 */
export function WordSheet({
  sentence,
  native,
  target,
  rate,
  onClose,
}: {
  sentence: ShowerSentence;
  native: Lang;
  target: Lang;
  rate: number;
  onClose: () => void;
}) {
  const t = getDict(native);
  const words = useMemo(() => wordsOf(sentence.text, target), [sentence.text, target]);
  const [picked, setPicked] = useState<string | null>(null);
  const [others, setOthers] = useState<Other[] | null>(null);
  const [loading, startLoading] = useTransition();
  const [state, saveAction, saving] = useActionState<WordState, FormData>(saveWord, { error: null, saved: null });
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  function pick(word: string) {
    setPicked(word);
    setOthers(null);
    startLoading(async () => {
      setOthers(await findSentencesWith(word, sentence.id));
    });
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="word-sheet-title"
        tabIndex={-1}
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className={styles.sheetHead}>
          <h2 id="word-sheet-title" className={styles.sheetTitle}>
            {t.word.sheetTitle}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t.common.close}>
            <Icon name="close" size={20} />
          </button>
        </div>

        <p className={`${styles.sheetSentence} ${langClass(target)}`}>
          <SentenceText text={sentence.text} reading={sentence.reading} />
        </p>
        <p className={styles.note}>{t.word.pick}</p>
        <div className={styles.chips}>
          {words.map(({ word, index }) => (
            <button
              key={word}
              type="button"
              className={word === picked ? `${styles.chip} ${styles.chipOn} ${langClass(target)}` : `${styles.chip} ${langClass(target)}`}
              onClick={() => pick(word)}
              aria-pressed={word === picked}
            >
              <SentenceText text={word} reading={sentence.reading?.slice(index, index + word.length) ?? null} />
            </button>
          ))}
        </div>

        {picked ? (
          <section className={styles.others} aria-busy={loading}>
            <h3 className="label">{t.word.others}</h3>
            {others === null ? null : others.length === 0 ? (
              <p className={styles.note}>{t.word.noOthers}</p>
            ) : (
              others.map((o) => (
                <div key={o.id} className={styles.otherRow}>
                  <div className={styles.itemMain}>
                    <span className={`${styles.otherText} ${langClass(target)}`}>
                      <SentenceText
                        text={o.text}
                        highlights={o.hits.map((h) => ({ ...h, kind: "mark" as const }))}
                        reading={o.reading}
                      />
                    </span>
                    <span className={`${styles.gloss} ${langClass(native)}`}>{o.gloss}</span>
                  </div>
                  <SpeakButton
                    text={o.text}
                    lang={target}
                    audio={o.audio}
                    rate={rate}
                    label={t.common.play}
                    failedLabel={t.common.playFailed}
                  />
                </div>
              ))
            )}
          </section>
        ) : null}

        <form action={saveAction} className={styles.memoForm}>
          <label htmlFor="memo-word" className="label">
            {t.word.memoLabel}
          </label>
          <input
            id="memo-word"
            name="word"
            required
            maxLength={40}
            autoComplete="off"
            className={`${styles.input} ${langClass(target)}`}
            aria-describedby="memo-hint"
          />
          <label htmlFor="memo-note" className={styles.subLabel}>
            {t.word.note}
          </label>
          <input id="memo-note" name="note" maxLength={120} autoComplete="off" className={styles.input} />
          <p id="memo-hint" className={styles.note}>
            {t.word.memoHint}
          </p>
          {state.error ? (
            <p className={styles.error} role="alert">
              {state.error}
            </p>
          ) : state.saved ? (
            <p className={styles.saved} role="status">
              {state.saved}
            </p>
          ) : null}
          <button type="submit" className="btn" disabled={saving}>
            {t.word.save}
          </button>
        </form>
      </div>
    </div>
  );
}
