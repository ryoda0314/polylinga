"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { SentenceText } from "@/components/SentenceText";
import { SpeakButton, type AudioSource } from "@/components/SpeakButton";
import { getDict } from "@/lib/i18n";
import { langClass, type Lang } from "@/lib/langs";
import { deleteWord, setUnderstood, updateWordNote, wordPlaces } from "../actions";
import { STAGES, type MemoWord } from "./words";
import styles from "./memo.module.css";

type Places = {
  rain: { id: string; text: string; gloss: string; reading: string[] | null; audio: AudioSource; hits: { start: number; end: number }[] }[];
  mine: { id: string; sayingId: string | null; text: string; hits: { start: number; end: number }[] }[];
};

function monthDay(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * One memo word, opened: how far it has grown and what moves it on, its counts, the learner's own note,
 * and where it lives — sentences in the rain that carry it, and the learner's own lines that used it.
 * Nothing to answer here; it is a place to look, never a test.
 */
export function WordDetail({
  word,
  native,
  target,
  rate,
  onClose,
}: {
  word: MemoWord;
  native: Lang;
  target: Lang;
  rate: number;
  onClose: () => void;
}) {
  const t = getDict(native);
  const [places, setPlaces] = useState<Places | null>(null);
  const [note, setNote] = useState(word.note ?? "");
  const [noteState, setNoteState] = useState<"idle" | "saved" | string>("idle");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const level = STAGES.indexOf(word.stage);

  // Escape closes the sheet wherever focus is (a control disabled while it saves drops focus to the page).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
    let live = true;
    wordPlaces(word.text).then((p) => live && setPlaces(p));
    return () => {
      live = false;
    };
  }, [word.text]);

  function saveNote() {
    startTransition(async () => {
      const res = await updateWordNote(word.id, note);
      setNoteState(res.error ?? "saved");
    });
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="word-detail-title"
        tabIndex={-1}
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.sheetHead}>
          <span className="label">{t.words.title}</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t.common.close}>
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className={styles.sheetWord}>
          <h2 id="word-detail-title" className={`${styles.big} ${langClass(target)}`}>
            <SentenceText text={word.text} reading={word.reading} />
          </h2>
          <SpeakButton text={word.text} lang={target} audio={null} rate={rate} size="lg" label={t.common.play} failedLabel={t.common.playFailed} />
        </div>

        {/* How far it has grown, and what moves it on. */}
        <div className={styles.track} aria-label={t.words.gauge}>
          {STAGES.map((s, k) => (
            <span
              key={s}
              className={[styles.step, k <= level ? styles.stepOn : "", k === level ? styles.stepNow : ""].filter(Boolean).join(" ")}
              aria-current={k === level ? "step" : undefined}
            >
              <i aria-hidden="true" />
              {t.words.stages[s]}
            </span>
          ))}
        </div>
        <p className={styles.hint}>{t.words.next[word.stage]}</p>

        <dl className={styles.facts}>
          <div>
            <dt>{t.words.met(word.encounters)}</dt>
            <dd>{word.metDaysAgo !== null ? `${t.words.lastMet} ${t.words.daysAgo(word.metDaysAgo)}` : t.words.notMet}</dd>
          </div>
          <div>
            <dt>{t.words.used(word.uses)}</dt>
            <dd>{t.words.memoed(word.memoCount)}</dd>
          </div>
          <div>
            <dt>{t.words.since}</dt>
            <dd>{monthDay(word.since)}</dd>
          </div>
        </dl>

        <label className={styles.understood}>
          <input
            type="checkbox"
            checked={word.understood}
            disabled={pending}
            onChange={(e) => {
              const value = e.target.checked;
              startTransition(() => setUnderstood(word.id, value));
            }}
          />
          {t.words.understood}
        </label>

        <div className={styles.noteBox}>
          <label htmlFor="word-note" className="label">
            {t.word.note}
          </label>
          <textarea
            id="word-note"
            className={`${styles.textarea} ${langClass(native)}`}
            maxLength={120}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteState("idle");
            }}
          />
          <div className={styles.noteRow}>
            <span className={styles.noteStatus} role="status">
              {noteState === "saved" ? t.words.noteSaved : noteState !== "idle" ? noteState : ""}
            </span>
            <button type="button" className="btn-quiet" onClick={saveNote} disabled={pending || note === (word.note ?? "")}>
              {t.words.saveNote}
            </button>
          </div>
        </div>

        <section className={styles.places} aria-busy={places === null}>
          <h3 className="label">{t.words.inRain}</h3>
          {places === null ? null : places.rain.length === 0 ? (
            <p className={styles.none}>{t.words.inRainNone}</p>
          ) : (
            places.rain.map((s) => (
              <div key={s.id} className={styles.placeRow}>
                <div className={styles.placeText}>
                  <span className={`${styles.placeSentence} ${langClass(target)}`}>
                    <SentenceText text={s.text} highlights={s.hits.map((h) => ({ ...h, kind: "memo" as const }))} reading={s.reading} />
                  </span>
                  <span className={`${styles.note} ${langClass(native)}`}>{s.gloss}</span>
                </div>
                <SpeakButton text={s.text} lang={target} audio={s.audio} rate={rate} label={t.common.play} failedLabel={t.common.playFailed} />
              </div>
            ))
          )}
        </section>

        {places && places.mine.length > 0 ? (
          <section className={styles.places}>
            <h3 className="label">{t.words.mine}</h3>
            {places.mine.map((c) => {
              const line = (
                <span className={`${styles.placeSentence} ${langClass(target)}`}>
                  <SentenceText text={c.text} highlights={c.hits.map((h) => ({ ...h, kind: "memo" as const }))} />
                </span>
              );
              return c.sayingId ? (
                <Link key={c.id} href={`/app/s/${c.sayingId}`} className={styles.mineRow}>
                  {line}
                  <span className={styles.chev}>
                    <Icon name="back" size={16} />
                  </span>
                </Link>
              ) : (
                <div key={c.id} className={styles.mineRow}>
                  {line}
                </div>
              );
            })}
          </section>
        ) : null}

        <div className={styles.dangerRow}>
          {confirming ? (
            <button
              type="button"
              className={styles.danger}
              disabled={pending}
              onClick={() => startTransition(() => deleteWord(word.id))}
              onBlur={() => !pending && setConfirming(false)}
              autoFocus
            >
              {pending ? t.words.deleting : t.words.confirmDelete}
            </button>
          ) : (
            <button type="button" className={styles.quietDanger} onClick={() => setConfirming(true)}>
              {t.words.delete}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
