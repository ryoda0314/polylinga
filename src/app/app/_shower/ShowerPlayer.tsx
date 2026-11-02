"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { playToEnd, prefetchAudio, stopAudio } from "@/components/audio";
import { Icon } from "@/components/Icon";
import { usePref } from "@/components/local";
import { Rain } from "@/components/Rain";
import { SentenceText, type Highlight } from "@/components/SentenceText";
import { getDict } from "@/lib/i18n";
import { langClass, type Lang } from "@/lib/langs";
import type { ShowerCluster, ShowerSentence } from "@/lib/shower";
import Link from "next/link";
import { heartMinna, markReachedSeen, recordFinished, reportMinna } from "../actions";
import app from "../app.module.css";
import styles from "./shower.module.css";
import { CuePrompt } from "./CuePrompt";
import { TryPage } from "./TryPage";
import { WordSheet } from "./WordSheet";

const GAP_MS = 700;
/** The browser's history entry of a rain's 言ってみる page, marked with the rain's pattern. */
const TRY_ENTRY = "kotonoameTry";

function triedAt(state: unknown): string | null {
  const at = state && typeof state === "object" ? (state as Record<string, unknown>)[TRY_ENTRY] : null;
  return typeof at === "string" ? at : null;
}

/**
 * One rain: sentences that share a pattern fall in one at a time with their audio and stay on screen,
 * so the learner can compare them and find the common part. Nothing is explained until they ask, and then
 * only by lighting the matching parts of the sentence and its translation. The rain comes from the library, or (みんなの雨)
 * from other learners' corrected sentences, where the learner can say 「これ言いたかった」 or report one. The way on is
 * これで言ってみる: the next rain comes after the correction (its 次の雨).
 */
export function ShowerPlayer({
  top,
  head,
  initial,
  source,
  reached,
  sharing,
  habit,
  native,
  target,
  rate,
}: {
  /** The page around the rain: the bar on a phone, then which rain and the way into the tutorial. 言ってみる replaces it. */
  top: ReactNode;
  head: ReactNode;
  initial: ShowerCluster | null;
  source: "library" | "minna";
  /** One of the learner's own shared sentences has reached someone since they last heard. */
  reached: boolean;
  /** The learner shares their corrected sentences. */
  sharing: boolean;
  /**
   * Making the rain a habit: their plan (電車に乗ったら) and whether to ask for one, whether this is their first rain
   * today, and whether they are back after a few days away.
   */
  habit: { cue: string | null; ask: boolean; firstToday: boolean; back: boolean };
  native: Lang;
  target: Lang;
  rate: number;
}) {
  const t = getDict(native);
  // The rain this page opened with, even if the page is drawn again meanwhile (by then it would pick another).
  const [cluster] = useState(initial);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState<number | null>(null);
  // Remembered on this device: on a train the sound stays off until the learner turns it back on.
  const [autoplay, setAutoplay] = usePref("autoplay", true);
  const [hideGloss, setHideGloss] = usePref("hideGloss", false);
  const [revealed, setRevealed] = useState(false);
  const [trying, setTrying] = useState(false);
  const [sheetFor, setSheetFor] = useState<ShowerSentence | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const runRef = useRef(0); // bumping it stops whatever flow is running
  const tryEntry = useRef(false); // the history entry showing is this rain's 言ってみる page
  const rainScroll = useRef<number | null>(null); // where the rain was left for 言ってみる

  const recorded = useRef(false);
  const [hearted, setHearted] = useState<Set<string>>(() => new Set());
  const [reported, setReported] = useState<Set<string>>(() => new Set());
  const minna = source === "minna";

  useEffect(() => () => stopAudio(audioRef.current), []);

  // This rain's clips are fetched while its first screen is up, so each sentence starts the moment its turn comes.
  useEffect(() => {
    if (cluster) prefetchAudio(cluster.sentences.map((s) => s.audio));
  }, [cluster]);

  // Heard once: the note stays on this page, and next time it is quiet again.
  useEffect(() => {
    if (reached) void markReachedSeen().catch(() => {});
  }, [reached]);

  function heart(id: string) {
    setHearted((prev) => new Set(prev).add(id));
    void heartMinna(id).catch(() => {});
  }

  function report(id: string) {
    setReported((prev) => new Set(prev).add(id));
    void reportMinna(id).catch(() => {});
  }

  // Once every sentence has fallen, the cluster counts as bathed in, even if the learner then tries a sentence or leaves.
  useEffect(() => {
    if (!cluster || shown < cluster.sentences.length || recorded.current) return;
    recorded.current = true;
    void recordFinished({ patternId: cluster.patternId, sentenceIds: cluster.sentences.map((s) => s.id) }, source).catch(() => {});
  }, [cluster, shown, source]);

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
    if (run !== runRef.current) return;
    setPlaying(null);
    // A sentence heard again in the middle of a rain: the rain then carries on where it was.
    if (autoplay && shown < cluster.sentences.length) {
      await new Promise((r) => setTimeout(r, GAP_MS));
      if (run === runRef.current) void flowFrom(cluster, shown);
    }
  }

  // The switch works at once: off stops the sound now; on carries the rain on from the next sentence.
  function switchAutoplay(on: boolean) {
    setAutoplay(on);
    if (!on) {
      runRef.current++;
      stopAudio(audioRef.current);
      setPlaying(null);
    } else if (cluster && shown > 0 && shown < cluster.sentences.length) {
      void flowFrom(cluster, shown);
    }
  }

  // 言ってみる is a page of its own (TryPage) with an entry in the browser's history: back, the browser's or the page's
  // own arrow, returns to this rain just as it was left.
  function openTry() {
    if (!cluster) return;
    runRef.current++;
    stopAudio(audioRef.current);
    setPlaying(null);
    rainScroll.current = window.scrollY;
    window.history.pushState({ [TRY_ENTRY]: cluster.patternId }, "");
    tryEntry.current = true;
    setTrying(true);
  }

  function closeTry() {
    if (tryEntry.current) window.history.back();
    else setTrying(false);
  }

  useEffect(() => {
    function onPop(e: PopStateEvent) {
      const open = cluster !== null && triedAt(e.state) === cluster.patternId;
      tryEntry.current = open;
      setTrying(open);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [cluster]);

  // 言ってみる opens at the top of its page; back in the rain, it is where it was left.
  useLayoutEffect(() => {
    if (trying) window.scrollTo({ top: 0 });
    else if (rainScroll.current !== null) window.scrollTo({ top: rainScroll.current });
  }, [trying]);

  function showNext() {
    if (!cluster) return;
    setShown((n) => Math.min(n + 1, cluster.sentences.length));
  }

  // The rain's own page: the bar on a phone, which rain it is, then the rain.
  const page = (content: ReactNode) => (
    <>
      {top}
      <div className={app.body}>
        {head}
        {content}
      </div>
    </>
  );
  const reachedNote = reached ? <p className={styles.reached}>{t.shower.reached}</p> : null;
  if (!cluster) {
    if (!minna) return page(<p className={styles.empty}>{t.shower.empty}</p>);
    return page(
      <div className={styles.wrap}>
        {reachedNote}
        <p className={styles.empty}>{t.shower.minnaEmpty}</p>
        {sharing ? null : (
          <Link href="/app/me" className={styles.shareHint}>
            {t.shower.minnaShareHint}
          </Link>
        )}
      </div>,
    );
  }
  if (trying) {
    return (
      <TryPage
        cluster={cluster}
        source={source}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        onBack={closeTry}
        native={native}
        target={target}
        rate={rate}
      />
    );
  }
  const allShown = shown >= cluster.sentences.length;
  const targetClass = langClass(target);
  const nativeClass = langClass(native);
  const visible = cluster.sentences.slice(0, shown);
  // Memo words that turned up in this rain: meeting them again is the point, so say so.
  const wordsIn = (list: ShowerSentence[]) => [...new Set(list.flatMap((s) => s.memoHits.map((h) => s.text.slice(h.start, h.end))))];
  const metWords = wordsIn(visible);
  // Before the first tap: what is about to fall (never what it has in common: that is for the learner to find).
  const comingWords = wordsIn(cluster.sentences);
  const badge = minna
    ? t.shower.minnaBadge(cluster.again)
    : cluster.again
      ? t.shower.again + (cluster.againDays && cluster.againDays >= 1 ? t.shower.againDays(cluster.againDays) : "")
      : t.shower.fresh;

  return page(
    <div className={styles.wrap}>
      {/* The rain itself: on a wide screen the left column, with the controls beside it. */}
      <div className={styles.rain}>
      {shown === 0 ? (
        <div className={styles.intro}>
          <div className={styles.introSky} aria-hidden="true">
            <Rain />
            <Image src="/illustrations/sprout.png" alt="" width={80} height={138} className={styles.introSprout} priority />
          </div>
          <div className={styles.introText}>
            <h2 className={styles.introTitle}>{t.shower.introTitle}</h2>
            <p className={styles.introMeta}>
              {minna ? t.shower.minnaIntro(cluster.sentences.length) : t.shower.introCount(cluster.sentences.length)}
            </p>
            {comingWords.length > 0 ? <p className={styles.memoNote}>{t.shower.introMemo(comingWords.join("・"))}</p> : null}
            {habit.cue ? <p className={styles.cueLine}>{t.shower.cueLine(habit.cue)}</p> : null}
          </div>
          <p className={styles.lead}>{t.shower.lead}</p>
          <button type="button" className="btn" onClick={start}>
            <Icon name="shower" size={22} />
            {t.shower.start}
          </button>
        </div>
      ) : (
        <ol className={styles.list} aria-live="polite">
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
                  {minna ? (
                    reported.has(s.id) ? (
                      <span className={styles.seen}>{t.shower.reported}</span>
                    ) : (
                      <span className={styles.reactions}>
                        <button
                          type="button"
                          className={styles.reaction}
                          onClick={() => heart(s.id)}
                          disabled={hearted.has(s.id)}
                          aria-pressed={hearted.has(s.id)}
                        >
                          {hearted.has(s.id) ? t.shower.hearted : t.shower.heart}
                        </button>
                        <button type="button" className={styles.reportLink} onClick={() => report(s.id)}>
                          {t.shower.report}
                        </button>
                      </span>
                    )
                  ) : null}
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

      </div>

      {/* What the rain is (badge, switches) and what to do after it: on a phone above and below the rain. */}
      <div className={styles.side}>
      {reachedNote}
      {habit.back && shown === 0 ? (
        <p className={styles.welcome}>{cluster.again ? t.shower.welcomeBackAgain : t.shower.welcomeBack}</p>
      ) : null}
      <div className={styles.toolbar}>
        <span className={cluster.again ? styles.again : styles.fresh}>{badge}</span>
        <div className={styles.toggles}>
          <label className={styles.toggle}>
            <input type="checkbox" checked={autoplay} onChange={(e) => switchAutoplay(e.target.checked)} />
            {t.shower.autoplay}
          </label>
          <label className={styles.toggle}>
            <input type="checkbox" checked={hideGloss} onChange={(e) => setHideGloss(e.target.checked)} />
            {t.shower.hideGloss}
          </label>
        </div>
      </div>

      {allShown ? (
        <div className={styles.after}>
          {habit.firstToday ? <p className={styles.doneToday}>{t.shower.doneToday}</p> : null}
          {habit.ask && !minna ? <CuePrompt native={native} /> : null}
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
          {/* 言ってみる is what the rain is for, and the only way on: 次の雨 waits on the correction's page. */}
          <button type="button" className="btn" onClick={openTry}>
            {t.shower.tryIt}
          </button>
        </div>
      ) : null}

      </div>

      {sheetFor ? (
        <WordSheet sentence={sheetFor} native={native} target={target} rate={rate} onClose={() => setSheetFor(null)} />
      ) : null}
    </div>,
  );
}
