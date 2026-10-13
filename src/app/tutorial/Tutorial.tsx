"use client";

import Image from "next/image";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { playToEnd, stopAudio, type AudioSource } from "@/components/audio";
import { CuePicker } from "@/components/CuePicker";
import { Icon } from "@/components/Icon";
import { usePref } from "@/components/local";
import { Rain } from "@/components/Rain";
import { SentenceText, type Highlight } from "@/components/SentenceText";
import { SpeakButton } from "@/components/SpeakButton";
import type { Range } from "@/lib/diff";
import { getDict, type Dict } from "@/lib/i18n";
import { langClass, type Lang } from "@/lib/langs";
import { findMemoHits } from "@/lib/shower-core";
import type { TutorialData, TutorialSay, TutorialSentence } from "@/lib/tutorial";
import { setRainCue } from "../app/actions";
import app from "../app/app.module.css";
import shower from "../app/_shower/shower.module.css";
import { finishTutorial } from "./actions";
import styles from "./tutorial.module.css";

// The hands-on tutorial: the promotion film's beats (the rain falls, the shared part lights, a sentence is corrected
// and explained, the way of saying comes back, a cue for every day), each started by the learner's own tap and drawn
// with the app's real screens, so the first real rain looks like what they just did.

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

type Player = { prime: () => void; play: (s: { text: string; audio: AudioSource }) => Promise<boolean>; stop: () => void };

/** One audio element for the whole tutorial: once a tap has started it, later sentences may play by themselves. */
function usePlayer(lang: Lang, rate: number): Player {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => stopAudio(ref.current), []);
  const el = () => (ref.current ??= new Audio());
  return {
    prime: () => void el(),
    play: (s) => playToEnd(el(), s.audio, s.text, lang, rate),
    stop: () => stopAudio(ref.current),
  };
}

export function Tutorial({ data, native, target, rate, cue }: { data: TutorialData; native: Lang; target: Lang; rate: number; cue: string | null }) {
  const t = getDict(native);
  const [step, setStep] = useState(0);
  // The same switch as the rain's 自動で流す: turned off here (a train), the rain stays quiet too.
  const [sound, setSound] = usePref("autoplay", true);
  const player = usePlayer(target, rate);
  const next = () => {
    player.stop();
    setStep((n) => n + 1);
    window.scrollTo({ top: 0 });
  };
  const common = { data, native, target, t, player, onNext: next };
  const soundSwitch = (
    <label className={styles.sound}>
      <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
      {t.tutorial.sound}
    </label>
  );

  return (
    <main className={styles.page} lang="ja">
      <header className={styles.head}>
        <div
          className={styles.bars}
          role="progressbar"
          aria-label={t.tutorial.progressLabel}
          aria-valuemin={1}
          aria-valuemax={t.tutorial.steps.length}
          aria-valuenow={step + 1}
        >
          {t.tutorial.steps.map((name, i) => (
            <span key={name} className={styles.bar} data-on={i <= step || undefined} />
          ))}
        </div>
        <form action={finishTutorial}>
          <button type="submit" className={styles.skip}>
            {t.tutorial.skip}
          </button>
        </form>
      </header>
      {step <= 1 ? (
        <RainSteps key="rain" {...common} step={step} sound={sound} soundSwitch={soundSwitch} />
      ) : step === 2 ? (
        <SayStep {...common} rate={rate} />
      ) : step === 3 ? (
        <AgainStep {...common} sound={sound} soundSwitch={soundSwitch} />
      ) : (
        <HabitStep t={t} cue={cue} />
      )}
    </main>
  );
}

type StepProps = { data: TutorialData; native: Lang; target: Lang; t: Dict; player: Player; onNext: () => void };

function Heading({ t, n, title, lead }: { t: Dict; n: number; title: string; lead: string }) {
  return (
    <div className={styles.heading}>
      <p className={styles.step}>{t.tutorial.step(n, t.tutorial.steps[n - 1])}</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lead}>{lead}</p>
    </div>
  );
}

/** A sentence row as the rain draws it (ShowerPlayer.tsx): drop, sentence, translation, play button. */
function Row({ playing, sentence, gloss, onPlay, t }: { playing: boolean; sentence: ReactNode; gloss: ReactNode; onPlay: () => void; t: Dict }) {
  return (
    <li className={playing ? `${shower.item} ${shower.playing}` : shower.item}>
      <span className={shower.drop} aria-hidden="true" />
      <div className={shower.itemMain}>
        {sentence}
        {gloss}
      </div>
      <button type="button" className={playing ? `${shower.play} ${shower.playOn}` : shower.play} onClick={onPlay} aria-label={t.common.play}>
        <Icon name="speaker" size={20} />
      </button>
    </li>
  );
}

/** Steps 1 and 2 share one rain: it falls, then the learner points at what they think is shared and the answer lights. */
function RainSteps({ data, native, target, t, player, onNext, step, sound, soundSwitch }: StepProps & { step: number; sound: boolean; soundSwitch: ReactNode }) {
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState<number | null>(null);
  const [fell, setFell] = useState(false);
  const [tapped, setTapped] = useState<{ i: number; at: Range } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const run = useRef(0);
  useEffect(() => () => void run.current++, []);
  const noticing = step === 1;

  async function flow() {
    const id = ++run.current;
    for (let i = 0; i < data.rain.length; i++) {
      if (id !== run.current) return;
      setShown(i + 1);
      setPlaying(i);
      if (sound) await player.play(data.rain[i]);
      else await wait(1000);
      if (id !== run.current) return;
      setPlaying(null);
      await wait(420);
    }
    if (id === run.current) setFell(true);
  }

  function tap(i: number, at: Range) {
    if (revealed || tapped) return;
    setTapped({ i, at });
    window.setTimeout(() => setRevealed(true), 700);
  }

  return (
    <>
      <section className={styles.body}>
        <Heading
          key={step}
          t={t}
          n={step + 1}
          title={noticing ? t.tutorial.noticeTitle : t.tutorial.rainTitle}
          lead={noticing ? t.tutorial.noticeLead : t.tutorial.rainLead}
        />
        {shown === 0 ? (
          <div className={styles.sky} aria-hidden="true">
            <Rain />
            <Image src="/illustrations/sprout.png" alt="" width={80} height={138} className={styles.sprout} priority />
          </div>
        ) : (
          <ol className={shower.list} aria-live="polite">
            {data.rain.slice(0, shown).map((s, i) => (
              <Row
                key={s.id}
                t={t}
                playing={i === playing}
                onPlay={() => void player.play(s)}
                sentence={
                  <span className={`${shower.sentence} ${langClass(target)}`}>
                    {noticing ? (
                      <TapText s={s} lang={target} revealed={revealed} tapped={tapped?.i === i ? tapped.at : null} onTap={(at) => tap(i, at)} />
                    ) : (
                      <SentenceText text={s.text} reading={s.reading} />
                    )}
                  </span>
                }
                gloss={
                  <span className={`${shower.gloss} ${langClass(native)}`}>
                    <SentenceText text={s.gloss} highlights={revealed && s.glossMark ? [{ ...s.glossMark, kind: "mark" }] : []} />
                  </span>
                }
              />
            ))}
          </ol>
        )}
        {noticing && revealed ? (
          <section className={`${shower.answer} ${styles.rise}`}>
            <h2 className="label">{t.tutorial.noticeAnswer}</h2>
            <p className={shower.answerMain}>{data.label}</p>
            <p className={shower.answerNote}>{t.tutorial.noticeNote}</p>
            {tapped ? (
              <p className={styles.hint}>{t.tutorial.noticeTapped(data.rain[tapped.i].text.slice(tapped.at.start, tapped.at.end))}</p>
            ) : null}
          </section>
        ) : null}
        {!noticing && fell ? <p className={`${styles.done} ${styles.rise}`}>{t.tutorial.rainDone}</p> : null}
      </section>
      <footer className={styles.foot}>
        {!noticing ? (
          fell ? (
            <button type="button" className="btn" onClick={onNext}>
              {t.tutorial.rainNext}
            </button>
          ) : (
            <>
              {soundSwitch}
              <button
                type="button"
                className="btn"
                disabled={shown > 0}
                onClick={() => {
                  player.prime();
                  void flow();
                }}
              >
                <Icon name="shower" size={22} />
                {shown > 0 ? t.tutorial.rainFalling : t.tutorial.rainStart}
              </button>
            </>
          )
        ) : revealed ? (
          <button type="button" className="btn" onClick={onNext}>
            {t.tutorial.noticeNext}
          </button>
        ) : (
          <button type="button" className="btn-quiet" onClick={() => setRevealed(true)}>
            {t.tutorial.noticeShow}
          </button>
        )}
      </footer>
    </>
  );
}

/** A sentence whose words can be pressed (the pressed one underlined), drawn whole with the shared part lit once revealed. */
function TapText({ s, lang, revealed, tapped, onTap }: { s: TutorialSentence; lang: Lang; revealed: boolean; tapped: Range | null; onTap: (at: Range) => void }) {
  const segments = useMemo(() => {
    try {
      return [...new Intl.Segmenter(lang, { granularity: "word" }).segment(s.text)].map((x) => ({
        start: x.index,
        end: x.index + x.segment.length,
        word: Boolean(x.isWordLike),
      }));
    } catch {
      return [{ start: 0, end: s.text.length, word: true }];
    }
  }, [s.text, lang]);
  // Once the answer is shown nothing is pressed any more: the sentence is drawn whole, so the lit part is one piece
  // even where the words were split inside it (要 | 不要).
  if (revealed) return <SentenceText text={s.text} reading={s.reading} highlights={s.mark ? [{ ...s.mark, kind: "mark" }] : []} />;
  const chars = (a: number, b: number) => {
    const out: ReactNode[] = [];
    for (let i = a; i < b; i++) {
      const r = s.reading?.[i];
      out.push(
        r ? (
          <ruby key={i}>
            {s.text[i]}
            <rt>{r}</rt>
          </ruby>
        ) : (
          <Fragment key={i}>{s.text[i]}</Fragment>
        ),
      );
    }
    return out;
  };
  return (
    <>
      {segments.map((g) =>
        g.word ? (
          <button
            key={g.start}
            type="button"
            className={tapped?.start === g.start ? `${styles.token} ${styles.tapped}` : styles.token}
            onClick={() => onTap({ start: g.start, end: g.end })}
          >
            {chars(g.start, g.end)}
          </button>
        ) : (
          <Fragment key={g.start}>{chars(g.start, g.end)}</Fragment>
        ),
      )}
    </>
  );
}

/** Step 3: an example sentence types itself into the field, is corrected, and is explained word by word. */
function SayStep({ data, native, target, t, onNext, rate }: StepProps & { rate: number }) {
  const say = data.say;
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<"idle" | "typing" | "typed" | "sending" | "done">("idle");

  useEffect(() => {
    if (phase !== "typing") return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setCount(n);
      if (n >= say.attempt.length) {
        window.clearInterval(id);
        setPhase("typed");
      }
    }, 85);
    return () => window.clearInterval(id);
  }, [phase, say.attempt]);

  function send() {
    setPhase("sending");
    window.setTimeout(() => setPhase("done"), 1100);
  }

  return (
    <>
      <section className={styles.body}>
        <Heading t={t} n={3} title={t.tutorial.sayTitle} lead={t.tutorial.sayLead} />
        {phase !== "done" ? (
          <>
            <div className={app.stackSm}>
              <span className="label">{t.tutorial.sayIntent}</span>
              <p className={`${styles.intent} ${langClass(native)}`}>{say.intent}</p>
            </div>
            <div className={app.stackSm}>
              <span className="label">{t.saying.writeLabel(t.common.langs[target])}</span>
              <button
                type="button"
                className={`${styles.field} ${langClass(target)}`}
                disabled={phase !== "idle"}
                onClick={() => setPhase("typing")}
              >
                {count > 0 ? say.attempt.slice(0, count) : <span className={styles.placeholder}>{t.tutorial.sayTap}</span>}
                {phase === "typing" ? <i className={styles.caret} /> : null}
              </button>
              <p className={styles.hint}>{t.saying.writeHint}</p>
            </div>
          </>
        ) : (
          <Corrected say={say} native={native} target={target} t={t} rate={rate} />
        )}
      </section>
      <footer className={styles.foot}>
        {phase === "done" ? (
          <button type="button" className="btn" onClick={onNext}>
            {t.tutorial.sayNext}
          </button>
        ) : (
          <button type="button" className="btn" disabled={phase !== "typed"} onClick={send}>
            {phase === "sending" ? t.tutorial.saySending : t.tutorial.saySend}
          </button>
        )}
      </footer>
    </>
  );
}

/** The correction page's view (s/[id]/page.tsx, ExplainPanel.tsx), filled with the example. */
function Corrected({ say, native, target, t, rate }: { say: TutorialSay; native: Lang; target: Lang; t: Dict; rate: number }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const part = picked === null ? null : say.parts[picked];
  const tc = langClass(target);
  const nc = langClass(native);
  const lit: Highlight[] = part ? [{ start: part.start, end: part.end, kind: "mark" }] : [];
  const glossLit: Highlight[] = part?.gloss ? [{ ...part.gloss, kind: "mark" }] : [];
  return (
    <div className={`${styles.result} ${styles.rise}`}>
      <section className={app.stackSm}>
        <h2 className="label">{t.saying.yours}</h2>
        <p className={`${app.yours} ${tc}`}>
          <SentenceText text={say.attempt} highlights={say.removed.map((r) => ({ ...r, kind: "del" as const }))} />
        </p>
      </section>
      <section className={`${app.stackSm} ${app.divider}`}>
        <h2 className="label">{t.saying.corrected}</h2>
        <div className={app.fixedRow}>
          <p className={`${app.fixed} ${tc}`}>
            <SentenceText text={say.corrected} highlights={say.added.map((r) => ({ ...r, kind: "ins" as const }))} reading={say.reading} />
          </p>
          <SpeakButton text={say.corrected} lang={target} audio={say.audio} rate={rate} solid label={t.common.play} failedLabel={t.common.playFailed} />
        </div>
        <p className={`${app.gloss} ${nc}`}>{say.meaning}</p>
        <div className={app.explainBox}>
          <button type="button" className="btn-quiet" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? t.saying.explainClose : t.saying.explain}
          </button>
          {open ? (
            <div className={`${app.explainPanel} ${styles.rise}`}>
              <p className={`${app.explainSentence} ${tc}`}>
                <SentenceText text={say.corrected} highlights={lit} reading={say.reading} />
              </p>
              <p className={`${app.gloss} ${nc}`}>
                <SentenceText text={say.meaning} highlights={glossLit} />
              </p>
              <p className={app.note}>{t.saying.explainHint}</p>
              <ul className={app.explainList}>
                {say.parts.map((p, i) => (
                  <li key={p.start} className={styles.rise} style={{ animationDelay: `${i * 70}ms` }}>
                    <button type="button" className={app.explainRow} aria-pressed={picked === i} onClick={() => setPicked(picked === i ? null : i)}>
                      <span className={`${app.explainWord} ${tc}`}>
                        <SentenceText text={say.corrected.slice(p.start, p.end)} reading={say.reading?.slice(p.start, p.end) ?? null} />
                      </span>
                      <span className={`${app.explainMeaning} ${nc}`}>{p.meaning}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
      <section className={app.panel}>
        <h2 className="label">{t.saying.why}</h2>
        <p className={`${app.explain} ${nc}`}>{say.explanation}</p>
      </section>
      <p className={styles.hint}>{t.tutorial.sayExample}</p>
    </div>
  );
}

/** Step 4: the learner sends time forward; the way of saying comes back in new sentences, the memo word dotted. */
function AgainStep({ data, native, target, t, player, onNext, sound, soundSwitch }: StepProps & { sound: boolean; soundSwitch: ReactNode }) {
  const [day, setDay] = useState(0);
  const [back, setBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState<number | null>(null);
  const [fell, setFell] = useState(false);
  const run = useRef(0);
  useEffect(() => () => void run.current++, []);
  const memoAt = data.again.findIndex((s) => findMemoHits(s.text, [data.memo]).length > 0);

  async function pass() {
    player.prime();
    setBusy(true);
    const id = ++run.current;
    for (let d = 1; d <= 3; d++) {
      await wait(420);
      if (id !== run.current) return;
      setDay(d);
    }
    await wait(380);
    if (id !== run.current) return;
    setBack(true);
    for (let i = 0; i < data.again.length; i++) {
      await wait(520);
      if (id !== run.current) return;
      setShown(i + 1);
      setPlaying(i);
      if (sound) await player.play(data.again[i]);
      else await wait(1000);
      if (id !== run.current) return;
      setPlaying(null);
    }
    setFell(true);
  }

  return (
    <>
      <section className={styles.body}>
        <Heading t={t} n={4} title={t.tutorial.againTitle} lead={t.tutorial.againLead} />
        <p className={styles.memoBefore}>{t.tutorial.againMemoBefore(data.memo)}</p>
        <div className={styles.days} aria-hidden="true">
          {t.tutorial.days.map((d, i) => (
            <span key={d} className={styles.day} data-on={i === day || undefined} data-past={i < day || undefined}>
              <i />
              {d}
            </span>
          ))}
        </div>
        {back ? (
          <div className={`${shower.wrap} ${styles.rise}`}>
            <div className={shower.toolbar}>
              <span className={shower.again}>{t.tutorial.againBadge}</span>
            </div>
            <ol className={shower.list} aria-live="polite">
              {data.again.slice(0, shown).map((s, i) => (
                <Row
                  key={s.id}
                  t={t}
                  playing={i === playing}
                  onPlay={() => void player.play(s)}
                  sentence={
                    <span className={`${shower.sentence} ${langClass(target)}`}>
                      <SentenceText
                        text={s.text}
                        reading={s.reading}
                        highlights={findMemoHits(s.text, [data.memo]).map((h) => ({ ...h, kind: "memo" as const }))}
                      />
                    </span>
                  }
                  gloss={<span className={`${shower.gloss} ${langClass(native)}`}>{s.gloss}</span>}
                />
              ))}
            </ol>
            {memoAt >= 0 && shown > memoAt ? <p className={`${shower.memoNote} ${styles.rise}`}>{t.shower.memoMet(data.memo)}</p> : null}
            {fell ? <p className={`${styles.done} ${styles.rise}`}>{t.tutorial.againNote}</p> : null}
          </div>
        ) : null}
      </section>
      <footer className={styles.foot}>
        {busy ? (
          <button type="button" className="btn" disabled={!fell} onClick={onNext}>
            {t.tutorial.againNext}
          </button>
        ) : (
          <>
            {soundSwitch}
            <button type="button" className="btn" onClick={() => void pass()}>
              {t.tutorial.againSkip}
            </button>
          </>
        )}
      </footer>
    </>
  );
}

// A town for the train window, the same every time (no randomness between the server and the browser).
const TOWN = (() => {
  let seed = 5;
  const r = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const out: { x: number; w: number; h: number }[] = [];
  for (let x = 0; x < 98; ) {
    const w = 5 + r() * 9;
    out.push({ x, w, h: 30 + r() * 52 });
    x += w + 1.5 + r() * 2.5;
  }
  return out;
})();

/** Step 5: choose when to bathe (the same question the rain asks), in front of a train window going by. */
function HabitStep({ t, cue }: { t: Dict; cue: string | null }) {
  const [value, setValue] = useState<string | null>(cue);
  const [saved, setSaved] = useState<{ cue: string | null } | null>(null);
  const [pending, startSaving] = useTransition();

  function save(v: string | null) {
    startSaving(async () => {
      await setRainCue(v);
      setSaved({ cue: v });
    });
  }

  return (
    <>
      <section className={styles.body}>
        <Heading t={t} n={5} title={t.tutorial.habitTitle} lead={t.tutorial.habitLead} />
        <div className={styles.window} aria-hidden="true">
          <div className={styles.town}>
            {[0, 50].map((off) =>
              TOWN.map((b, i) => <i key={`${off}-${i}`} style={{ left: `${off + b.x / 2}%`, width: `${b.w / 2}%`, height: `${b.h}%` }} />),
            )}
          </div>
          <div className={styles.poles}>
            {[0, 25, 50, 75].map((x) => (
              <i key={x} style={{ left: `${x}%` }} />
            ))}
          </div>
          {value ? <p className={styles.cueLine}>{t.shower.cueLine(value)}</p> : null}
        </div>
        {saved ? (
          saved.cue ? (
            <p className={`${styles.cueDone} ${styles.rise}`} role="status">
              {t.shower.cueSet(saved.cue)}
            </p>
          ) : null
        ) : (
          <div className={styles.cue}>
            <h2 className={styles.cueAsk}>{t.shower.cueAsk}</h2>
            <CuePicker
              value={value}
              onChange={setValue}
              options={t.shower.cueOptions}
              labels={{ own: t.shower.cueOwn, ownLabel: t.shower.cueOwnLabel, ownPlaceholder: t.shower.cueOwnPlaceholder }}
            />
            <div className={styles.cueActions}>
              <button type="button" className="btn-quiet" disabled={!value || pending} onClick={() => save(value)}>
                {t.shower.cueSave}
              </button>
              <button type="button" className={styles.skip} disabled={pending} onClick={() => save(null)}>
                {t.shower.cueSkip}
              </button>
            </div>
          </div>
        )}
      </section>
      <footer className={styles.foot}>
        <form action={finishTutorial}>
          <button type="submit" className="btn" style={{ width: "100%" }}>
            {t.tutorial.finish}
          </button>
        </form>
      </footer>
    </>
  );
}
