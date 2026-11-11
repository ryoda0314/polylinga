"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { SentenceText } from "@/components/SentenceText";
import { SpeakButton, type AudioSource } from "@/components/SpeakButton";
import { getDict } from "@/lib/i18n";
import { langClass, type Lang } from "@/lib/langs";
import type { SentencePart } from "@/lib/shower-core";
import { answerWord, findSentencesWith, saveWord, type MemoOf, type WordState } from "../actions";
import { SaveButton } from "../memo/SaveButton";
import styles from "./shower.module.css";

type Other = {
  id: string;
  text: string;
  gloss: string;
  reading: string[] | null;
  audio: AudioSource;
  hits: { start: number; end: number }[];
};

/** A chip: the piece as written, where it first appears (so it can show its pinyin), and 語のまとまり's piece if any. */
type Chip = { word: string; index: number; part: SentencePart | null };

/**
 * The sentence's pieces to pick from: 語のまとまり once the sentence has been split (particles apart from their
 * nouns, each with its dictionary form), otherwise the browser's own word splitting, each word once.
 */
function chipsOf(text: string, lang: Lang, parts: SentencePart[] | null | undefined): Chip[] {
  if (parts?.length) {
    const seen = new Set<string>();
    return parts.flatMap((p) => {
      const word = text.slice(p.start, p.end);
      if (seen.has(word)) return [];
      seen.add(word);
      return [{ word, index: p.start, part: p }];
    });
  }
  const out = new Map<string, number>();
  try {
    for (const s of new Intl.Segmenter(lang, { granularity: "word" }).segment(text)) {
      if (s.isWordLike && !out.has(s.segment)) out.set(s.segment, s.index);
    }
  } catch {
    for (const w of text.split(/\s+/).filter(Boolean)) if (!out.has(w)) out.set(w, text.indexOf(w));
  }
  return [...out].map(([word, index]) => ({ word, index, part: null }));
}

/**
 * The sentence a word was noticed in: a library sentence (its id keeps it out of "other sentences"; its translation and
 * pieces give the answer once asked for), or the learner's own.
 */
export type SheetSentence = {
  id: string | null;
  text: string;
  reading: string[] | null;
  gloss?: string | null;
  parts?: SentencePart[] | null;
};

/**
 * Where a sheet opened from inside a page goes: inside the app shell, so it keeps the learner's accent (data-accent),
 * but outside the sentence (a sheet may not sit inside a <p>) and any sticky column.
 */
export function sheetRoot(): Element {
  return document.querySelector("[data-accent]") ?? document.body;
}

/**
 * A word the learner noticed: see it in other sentences, guess what it means, and type it into the memo themselves
 * (the typing is the point, so the field is never filled in for them). A word they could not guess is memoed as such
 * (予想できなかった): it then rains again in other sentences, and they may see its meaning here when they choose to
 * (答え合わせ), never before. Used in the rain and on a correction.
 */
export function WordSheet({
  sentence,
  native,
  target,
  rate,
  onClose,
}: {
  sentence: SheetSentence;
  native: Lang;
  target: Lang;
  rate: number;
  onClose: () => void;
}) {
  const t = getDict(native);
  const chips = useMemo(() => chipsOf(sentence.text, target, sentence.parts), [sentence.text, sentence.parts, target]);
  const [picked, setPicked] = useState<Chip | null>(null);
  const [others, setOthers] = useState<Other[] | null>(null);
  const [memo, setMemo] = useState<MemoOf | null>(null);
  const [answered, setAnswered] = useState(false);
  const [loading, startLoading] = useTransition();
  const [state, saveAction, saving] = useActionState<WordState, FormData>(saveWord, { error: null, saved: null, wordId: null, stuck: false });
  // Typing again after a save clears the "saved" look, so it always speaks of the word just sent.
  const [typing, setTyping] = useState(false);
  const done = !saving && Boolean(state.saved) && !typing;
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Escape closes the sheet wherever focus is (the save button, disabled while it saves, drops focus to the page).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pick(chip: Chip) {
    setPicked(chip);
    setOthers(null);
    setMemo(null);
    setAnswered(false);
    setTyping(true); // the "saved" note was about the word picked before
    startLoading(async () => {
      const found = await findSentencesWith(chip.word, sentence.id, chip.part?.base ?? null);
      setOthers(found.others);
      setMemo(found.memo);
    });
  }

  // Whose answer can be asked for: the word just memoed as not guessed, or one memoed so before.
  const stuckId = done && state.stuck ? state.wordId : memo?.stuck ? memo.id : null;
  function answer() {
    setAnswered(true);
    if (stuckId) void answerWord(stuckId).catch(() => {});
  }
  const part = picked?.part ?? null;
  const glossText = part?.gloss && sentence.gloss ? sentence.gloss.slice(part.gloss.start, part.gloss.end) : null;

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
          {chips.map((chip) => {
            const on = chip.word === picked?.word;
            return (
              <button
                key={chip.word}
                type="button"
                className={`${styles.chip} ${on ? styles.chipOn : ""} ${chip.part?.kind === "function" ? styles.chipPiece : ""} ${langClass(target)}`}
                onClick={() => pick(chip)}
                aria-pressed={on}
              >
                <SentenceText text={chip.word} reading={sentence.reading?.slice(chip.index, chip.index + chip.word.length) ?? null} />
              </button>
            );
          })}
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

        <form
          key={picked?.word ?? ""}
          action={saveAction}
          onSubmit={() => setTyping(false)}
          onInput={() => setTyping(true)}
          className={styles.memoForm}
        >
          <input type="hidden" name="from" value={picked?.word ?? ""} />
          <input type="hidden" name="base" value={part?.base ?? ""} />
          <label htmlFor="memo-word" className="label">
            {picked ? t.word.memoLabelFor(picked.word) : t.word.memoLabel}
          </label>
          <input
            id="memo-word"
            name="word"
            required
            maxLength={40}
            autoComplete="off"
            placeholder={picked?.word}
            className={`${styles.input} ${langClass(target)}`}
            aria-describedby="memo-hint"
          />
          {memo ? (
            <p className={styles.before}>{memo.note ? t.word.before(memo.note) : memo.stuck ? t.word.beforeStuck : null}</p>
          ) : null}
          {part?.kind === "function" ? <p className={styles.note}>{t.word.piece}</p> : null}
          <label htmlFor="memo-note" className={styles.subLabel}>
            {t.word.note}
          </label>
          <input id="memo-note" name="note" maxLength={120} autoComplete="off" className={`${styles.input} ${langClass(native)}`} />
          <p id="memo-hint" className={styles.note}>
            {t.word.stuckHint}
          </p>
          {state.error ? (
            <p className={styles.error} role="alert">
              {state.error}
            </p>
          ) : done ? (
            <p className={styles.saved} role="status">
              {state.saved}
            </p>
          ) : null}
          <div className={styles.memoActions}>
            <SaveButton pending={saving} done={done && !state.stuck} labels={{ save: t.word.save, saving: t.word.saving, saved: t.word.savedButton }} />
            <button type="submit" name="stuck" value="1" className="btn-quiet" disabled={saving}>
              {t.word.stuck}
            </button>
          </div>
        </form>

        {/* 答え合わせ: only for a word they could not guess, and only when they choose it. */}
        {stuckId && picked ? (
          answered ? (
            <section className={styles.answerBox} aria-live="polite">
              {part?.meaning ? (
                <>
                  <p className={`${styles.answerMain} ${langClass(native)}`}>{t.word.answerHere(part.meaning)}</p>
                  {glossText ? <p className={styles.note}>{t.word.answerGloss(glossText)}</p> : null}
                </>
              ) : (
                <p className={styles.note}>{t.word.answerNone}</p>
              )}
            </section>
          ) : (
            <button type="button" className="btn-quiet" onClick={answer}>
              {t.word.answer}
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}
