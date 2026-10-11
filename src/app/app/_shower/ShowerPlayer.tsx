"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { playToEnd, stopAudio } from "@/components/audio";
import { Icon } from "@/components/Icon";
import { Rain } from "@/components/Rain";
import { SentenceText, type Highlight } from "@/components/SentenceText";
import { getDict } from "@/lib/i18n";
import { langClass, type Lang } from "@/lib/langs";
import type { ShowerCluster, ShowerSentence } from "@/lib/shower";
import { nextCluster, recordFinished } from "../actions";
import styles from "./shower.module.css";
import { TryForm } from "./TryForm";
import { WordSheet } from "./WordSheet";

const GAP_MS = 700;

/**
 * One rain: sentences that share a pattern fall in one at a time with their audio and stay on screen,
 * so the learner can compare them and find the common part. Nothing is explained until they ask, and then
 * only by lighting the matching parts of the sentence and its translation.
 */
export function ShowerPlayer({
  initial,
  native,
  target,
  rate,
}: {
  initial: ShowerCluster | null;
  native: Lang;
  target: Lang;
  rate: number;
}) {
  const t = getDict(native);
  const [cluster, setCluster] = useState(initial);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState<number | null>(null);
  const [autoplay, setAutoplay] = useState(true);
  const [hideGloss, setHideGloss] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [trying, setTrying] = useState(false);
  const [sheetFor, setSheetFor] = useState<ShowerSentence | null>(null);
  const [pending, startTransition] = useTransition();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const runRef = useRef(0); // bumping it stops whatever flow is running

  const recorded = useRef<{ key: string; done: Promise<void> } | null>(null);

  useEffect(() => () => stopAudio(audioRef.current), []);

  // Once every sentence has fallen, the cluster counts as bathed in, even if the learner then tries a sentence or leaves.
  useEffect(() => {
    if (!cluster || shown < cluster.sentences.length) return;
    const sentenceIds = cluster.sentences.map((s) => s.id);
    const key = `${cluster.patternId}:${sentenceIds.join(",")}`;
    if (recorded.current?.key === key) return;
    recorded.current = { key, done: recordFinished({ patternId: cluster.patternId, sentenceIds }).catch(() => {}) };
  }, [cluster, shown]);

  function element() {
    // Created on the first tap; later plays on the same element are allowed on mobile.
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  }

  async function flowFrom(c: ShowerCluster, index: number) {
    const run = ++runRef.current;
    const el = element();
    for (let i = index; i < c.sentences.length; i++) {
      if (run !== runRef.current) return;
      setShown((n) => Math.max(n, i + 1));
      setPlaying(i);
      await playToEnd(el, c.sentences[i].audio, c.sentences[i].text, target, rate);
      if (run !== runRef.current) return;
      setPlaying(null);
      if (i < c.sentences.length - 1) await new Promise((r) => setTimeout(r, GAP_MS));
    }
  }

  function start() {
    if (!cluster) return;
    element();
    if (autoplay) void flowFrom(cluster, 0);
    else setShown(1);
  }

  async function playOne(i: number) {
    if (!cluster) return;
    const run = ++runRef.current;
    setPlaying(i);
    await playToEnd(element(), cluster.sentences[i].audio, cluster.sentences[i].text, target, rate);
    if (run === runRef.current) setPlaying(null);
  }

  function showNext() {
    if (!cluster) return;
    setShown((n) => Math.min(n + 1, cluster.sentences.length));
  }

  function goNext() {
    if (!cluster) return;
    runRef.current++;
    stopAudio(audioRef.current);
    setPlaying(null);
    const avoid = cluster.patternId;
    startTransition(async () => {
      await recorded.current?.done;
      const next = await nextCluster(avoid);
      setCluster(next);
      setRevealed(false);
      setTrying(false);
      setShown(0);
      window.scrollTo({ top: 0 });
      if (next) {
        if (autoplay) void flowFrom(next, 0);
        else setShown(1);
      }
    });
  }

  if (!cluster) return <p className={styles.empty}>{t.shower.empty}</p>;
  const allShown = shown >= cluster.sentences.length;
  const targetClass = langClass(target);
  const nativeClass = langClass(native);
  const visible = cluster.sentences.slice(0, shown);
  // Memo words that turned up in this rain: meeting them again is the point, so say so.
  const wordsIn = (list: ShowerSentence[]) => [...new Set(list.flatMap((s) => s.memoHits.map((h) => s.text.slice(h.start, h.end))))];
  const metWords = wordsIn(visible);
  // Before the first tap: what is about to fall (never what it has in common: that is for the learner to find).
  const comingWords = wordsIn(cluster.sentences);
  const badge = cluster.again
    ? t.shower.again + (cluster.againDays && cluster.againDays >= 1 ? t.shower.againDays(cluster.againDays) : "")
    : t.shower.fresh;

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <span className={cluster.again ? styles.again : styles.fresh}>{badge}</span>
        <div className={styles.toggles}>
          <label className={styles.toggle}>
            <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
            {t.shower.autoplay}
          </label>
          <label className={styles.toggle}>
            <input type="checkbox" checked={hideGloss} onChange={(e) => setHideGloss(e.target.checked)} />
            {t.shower.hideGloss}
          </label>
        </div>
      </div>

      {shown === 0 ? (
        <div className={styles.intro}>
          <div className={styles.introSky} aria-hidden="true">
            <Rain />
            <Image src="/illustrations/sprout.png" alt="" width={80} height={138} className={styles.introSprout} priority />
          </div>
          <div className={styles.introText}>
            <h2 className={styles.introTitle}>{t.shower.introTitle}</h2>
            <p className={styles.introMeta}>{t.shower.introCount(cluster.sentences.length)}</p>
            {comingWords.length > 0 ? <p className={styles.memoNote}>{t.shower.introMemo(comingWords.join("・"))}</p> : null}
          </div>
          <p className={styles.lead}>{t.shower.lead}</p>
          <button type="button" className="btn" onClick={start}>
            <Icon name="shower" size={22} />
            {t.shower.start}
          </button>
        </div>
      ) : (
        <ol className={styles.list} aria-live="polite" data-leaving={pending || undefined}>
          {visible.map((s, i) => {
            const highlights: Highlight[] = [
              ...s.memoHits.map((h) => ({ ...h, kind: "memo" as const })),
              ...(revealed && s.mark ? [{ ...s.mark, kind: "mark" as const }] : []),
            ];
            const glossHighlights: Highlight[] = revealed && s.glossMark ? [{ ...s.glossMark, kind: "mark" }] : [];
            return (
              <li key={s.id} className={i === playing ? `${styles.item} ${styles.playing}` : styles.item}>
                <span className={styles.drop} aria-hidden="true" />
                <div className={styles.itemMain}>
                  <button type="button" className={`${styles.sentence} ${targetClass}`} onClick={() => setSheetFor(s)}>
                    <SentenceText text={s.text} highlights={highlights} reading={s.reading} />
                  </button>
                  {hideGloss ? null : (
                    <span className={`${styles.gloss} ${nativeClass}`}>
                      <SentenceText text={s.gloss} highlights={glossHighlights} />
                    </span>
                  )}
                  {s.seenBefore ? <span className={styles.seen}>{t.shower.seenBefore}</span> : null}
                </div>
                <button
                  type="button"
                  className={i === playing ? `${styles.play} ${styles.playOn}` : styles.play}
                  onClick={() => playOne(i)}
                  aria-label={t.common.play}
                >
                  <Icon name="speaker" size={20} />
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {metWords.length > 0 ? (
        <p className={styles.memoNote}>
          {t.shower.memoMet(metWords.join("・"))}
        </p>
      ) : null}

      {shown > 0 && !allShown && !autoplay ? (
        <button type="button" className="btn-quiet" onClick={showNext}>
          {t.shower.next}
        </button>
      ) : null}

      {allShown ? (
        <div className={styles.after}>
          {revealed ? (
            <section className={styles.answer}>
              <h2 className="label">{t.shower.revealed}</h2>
              {cluster.label ? <p className={`${styles.answerMain} ${nativeClass}`}>{cluster.label}</p> : null}
              <p className={styles.answerNote}>{t.shower.answerNote}</p>
            </section>
          ) : (
            <button type="button" className="btn-quiet" onClick={() => setRevealed(true)}>
              {t.shower.reveal}
            </button>
          )}
          {trying ? (
            <TryForm patternId={cluster.patternId} native={native} target={target} sentences={cluster.sentences} revealed={revealed} />
          ) : (
            <button type="button" className="btn-quiet" onClick={() => setTrying(true)}>
              {t.shower.tryIt}
            </button>
          )}
          <button type="button" className="btn" onClick={goNext} disabled={pending}>
            {pending ? t.shower.loading : t.shower.nextCluster}
          </button>
        </div>
      ) : null}

      {sheetFor ? (
        <WordSheet sentence={sheetFor} native={native} target={target} rate={rate} onClose={() => setSheetFor(null)} />
      ) : null}
    </div>
  );
}
