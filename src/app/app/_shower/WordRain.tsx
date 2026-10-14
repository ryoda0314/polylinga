"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { playToEnd, stopAudio } from "@/components/audio";
import { Icon } from "@/components/Icon";
import { useChoice, usePref } from "@/components/local";
import { Rain } from "@/components/Rain";
import { SentenceText } from "@/components/SentenceText";
import { getDict } from "@/lib/i18n";
import { langClass, type Lang } from "@/lib/langs";
import styles from "./wordrain.module.css";

export type RainWord = { id: string; text: string; note: string | null; reading: string[] | null };

const SPEEDS = ["slow", "normal", "fast"] as const;
type Speed = (typeof SPEEDS)[number];
/** How long each word stays before the next one falls, by speed (ms). */
const HOLD: Record<Speed, number> = { slow: 6000, normal: 4000, fast: 2500 };
const TRAIL = 4;

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** The memo in a new order, never starting with the word that just fell. */
function shuffled(words: RainWord[], last: string | null): RainWord[] {
  const out = [...words];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out[0].id === last) [out[0], out[1]] = [out[1], out[0]];
  return out;
}

/**
 * 単語の雨: the words the learner typed into the memo fall one at a time, each with what they wrote beside it, round and
 * round until they stop it. Nothing is asked and nothing is counted; it can be left running, like the rain.
 */
export function WordRain({ words, native, target, rate }: { words: RainWord[]; native: Lang; target: Lang; rate: number }) {
  const t = getDict(native);
  const [sound, setSound] = usePref("autoplay", true);
  const [speed, setSpeed] = useChoice("wordSpeed", SPEEDS, "normal");
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<{ word: RainWord; n: number } | null>(null);
  const [meaning, setMeaning] = useState(false);
  const [trail, setTrail] = useState<RainWord[]>([]);
  const run = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  // The loop reads the latest settings, so changing them takes effect from the next word.
  const settings = useRef({ sound, speed });
  useEffect(() => {
    settings.current = { sound, speed };
  }, [sound, speed]);

  useEffect(
    () => () => {
      run.current++;
      stopAudio(audio.current);
    },
    [],
  );

  // Keep the screen on while it rains (where the browser allows it), so it can be left running.
  useEffect(() => {
    if (!running || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((l) => (lock = l), () => {});
    return () => void lock?.release().catch(() => {});
  }, [running]);

  async function loop() {
    const id = ++run.current;
    let order = shuffled(words, current?.word.id ?? null);
    let k = 0;
    let n = current?.n ?? 0;
    while (id === run.current) {
      if (k >= order.length) {
        order = shuffled(words, order[order.length - 1]?.id ?? null);
        k = 0;
      }
      const word = order[k++];
      setCurrent({ word, n: ++n });
      setMeaning(false);
      const el = (audio.current ??= new Audio());
      // A word may get no voice at all; never wait on it for long.
      const spoken = settings.current.sound
        ? Promise.race([playToEnd(el, null, word.text, target, rate), wait(5000)])
        : Promise.resolve(false);
      await wait(800);
      if (id !== run.current) return;
      setMeaning(true);
      await Promise.all([spoken, wait(HOLD[settings.current.speed])]);
      if (id !== run.current) return;
      setTrail((list) => [word, ...list.filter((w) => w.id !== word.id)].slice(0, TRAIL));
    }
  }

  function toggle() {
    if (running) {
      run.current++;
      stopAudio(audio.current);
      setRunning(false);
      return;
    }
    audio.current ??= new Audio();
    setRunning(true);
    void loop();
  }

  if (words.length === 0) {
    return (
      <div className={styles.empty}>
        <p>{t.wordRain.empty}</p>
        <Link href="/app/memo" className="btn-quiet">
          {t.wordRain.toMemo}
        </Link>
      </div>
    );
  }

  const tc = langClass(target);
  return (
    <div className={styles.wrap}>
      <p className={styles.lead}>{t.wordRain.lead}</p>
      <div className={styles.stage}>
        <div className={styles.sky} aria-hidden="true">
          <Rain />
        </div>
        {current ? (
          <div key={current.n} className={styles.word} aria-live="polite">
            <span className={`${styles.text} ${tc}`}>
              <SentenceText text={current.word.text} reading={current.word.reading} />
            </span>
            <span className={`${styles.note} ${langClass(native)}`} data-on={meaning || undefined}>
              {current.word.note ?? ""}
            </span>
          </div>
        ) : (
          <p className={styles.count}>{t.wordRain.count(words.length)}</p>
        )}
      </div>

      <div className={styles.controls}>
        <button type="button" className="btn" onClick={toggle}>
          <Icon name="shower" size={22} />
          {running ? t.wordRain.pause : current ? t.wordRain.resume : t.wordRain.start}
        </button>
        <div className={styles.settings}>
          <label className={styles.check}>
            <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
            {t.wordRain.sound}
          </label>
          <div className={styles.speeds} role="group" aria-label={t.wordRain.speed}>
            {SPEEDS.map((s) => (
              <button key={s} type="button" className={styles.speed} aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                {t.wordRain.speeds[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {trail.length ? (
        <section aria-labelledby="word-trail">
          <h2 id="word-trail" className="label">
            {t.wordRain.trail}
          </h2>
          <ul className={styles.trail}>
            {trail.map((w, i) => (
              <li key={w.id} style={{ opacity: 1 - i * 0.18 }}>
                <span className={`${styles.trailText} ${tc}`}>
                  <SentenceText text={w.text} reading={w.reading} />
                </span>
                <span className={`${styles.trailNote} ${langClass(native)}`}>{w.note ?? ""}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
