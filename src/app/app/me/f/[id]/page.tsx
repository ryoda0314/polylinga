import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { SentenceText, type Highlight } from "@/components/SentenceText";
import { SpeakButton } from "@/components/SpeakButton";
import { audioUrl } from "@/lib/audio";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { langClass } from "@/lib/langs";
import { dayOf, loadPatternLook } from "@/lib/me";
import { readingFor } from "@/lib/reading";
import { requireSettings } from "@/lib/settings";
import type { ShowerSentence } from "@/lib/shower";
import { TryForm } from "../../../_shower/TryForm";
import styles from "../../../app.module.css";
import { dayLabel, SaidPair } from "../../views";

export const metadata = { title: "かたち" };

const PATTERN_ID = /^[a-z0-9_-]{1,80}$/i;

/** One pattern from the learner's side: what was lit, the sentences they bathed in, and what they said with it. */
export default async function PatternLookPage({ params, searchParams }: PageProps<"/app/me/f/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!PATTERN_ID.test(id)) notFound();
  const [{ user }, settings] = await Promise.all([requireUser(), requireSettings()]);
  const target = settings.targetLang;
  const native = settings.nativeLang;
  const look = await loadPatternLook(user.id, target, native, id);
  if (!look) notFound();

  const t = getDict(native);
  const rate = settings.speechRate;
  const targetClass = langClass(target);
  const nativeClass = langClass(native);
  const back = query.from === "forms" ? "/app/me?view=forms" : "/app/me";
  const facts = [
    look.times > 0 ? t.me.lookTimes(look.times) : null,
    look.firstDay ? t.me.lookFirst(dayLabel(look.firstDay, native)) : null,
    look.lastAt ? t.me.lookLast(dayLabel(dayOf(look.lastAt), native)) : null,
  ].filter(Boolean);

  // The sentences to keep in view while writing: the ones bathed in most recently, lit (from みんなの雨 when the
  // pattern has only rained there).
  const refs: ShowerSentence[] = look.seen.length
    ? look.seen.slice(0, 4).map((s) => ({
        id: s.id,
        text: s.text,
        gloss: s.gloss,
        reading: s.reading,
        audio: s.audio,
        mark: s.marks[0] ? { start: s.marks[0].start, end: s.marks[0].end } : null,
        glossMark: s.glossMarks[0] ? { start: s.glossMarks[0].start, end: s.glossMarks[0].end } : null,
        seenBefore: true,
        memoHits: [],
      }))
    : look.minna.slice(0, 4).map((s) => ({
        id: s.id,
        text: s.text,
        gloss: s.gloss,
        reading: readingFor(s.text, target),
        audio: null,
        mark: s.mark,
        glossMark: null,
        seenBefore: true,
        memoHits: [],
      }));

  return (
    <>
      <header className={styles.subbar}>
        <Link href={back} className={styles.iconLink} aria-label={t.common.back}>
          <Icon name="back" size={22} />
        </Link>
        <h1 className={styles.subtitleStrong}>{look.label}</h1>
      </header>
      <div className={styles.bodyTight}>
        <section className={styles.stackSm}>
          {look.parts.length ? (
            <>
              <h2 className="label">{t.me.lookParts}</h2>
              <p className={`${styles.parts} ${targetClass}`}>
                {look.parts.map((p) => (
                  <span key={p} className="mark">
                    {p}
                  </span>
                ))}
              </p>
            </>
          ) : null}
          {facts.length ? <p className={styles.note}>{facts.join(" · ")}</p> : null}
        </section>

        {refs.length ? (
          <details className={styles.fold}>
            <summary>{t.me.lookTry}</summary>
            <TryForm
              patternId={look.id}
              native={native}
              target={target}
              sentences={refs}
              revealed
              labels={{ ref: t.me.lookTryRef, write: t.me.lookTryLabel }}
            />
          </details>
        ) : null}

        <section aria-labelledby="look-mine">
          <div className={styles.listHead}>
            <h2 id="look-mine">{t.me.lookMine}</h2>
            <span className={styles.count}>{t.common.count(look.mine.length)}</span>
          </div>
          {look.mine.length === 0 ? (
            <p className={styles.empty}>{t.me.lookMineNone}</p>
          ) : (
            <ul className={styles.plainList}>
              {look.mine.map((s) => {
                // What they wrote above what it became, the pattern lit in the corrected one.
                const text = (
                  <span className={styles.rowText}>
                    <SaidPair
                      input={s.input}
                      text={s.text}
                      target={target}
                      t={t}
                      afterClass={styles.exampleText}
                      mark={s.mark}
                      reading={readingFor(s.text, target)}
                    />
                    {s.gloss ? <span className={`${styles.gloss} ${nativeClass}`}>{s.gloss}</span> : null}
                  </span>
                );
                return (
                  <li key={s.id} className={styles.row}>
                    {s.sayingId ? (
                      <Link href={`/app/s/${s.sayingId}`} className={styles.plainLink}>
                        {text}
                      </Link>
                    ) : (
                      text
                    )}
                    <SpeakButton
                      text={s.text}
                      lang={target}
                      audio={{ src: audioUrl(s.text, target), fallback: `/api/tts?correction=${s.id}` }}
                      rate={rate}
                      label={t.common.play}
                      failedLabel={t.common.playFailed}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="look-seen">
          <div className={styles.listHead}>
            <h2 id="look-seen">{t.me.lookSeen}</h2>
            <span className={styles.count}>{t.common.count(look.seen.length)}</span>
          </div>
          {look.seen.length === 0 ? (
            <p className={styles.empty}>{t.me.lookSeenNone}</p>
          ) : (
            <ul className={styles.plainList}>
              {look.seen.map((s) => {
                const lit: Highlight[] = s.marks.map((m) => ({ start: m.start, end: m.end, kind: "mark" }));
                const glossLit: Highlight[] = lit.length ? s.glossMarks.map((m) => ({ start: m.start, end: m.end, kind: "mark" })) : [];
                return (
                  <li key={s.id} className={styles.row}>
                    <span className={styles.rowText}>
                      <span className={`${styles.exampleText} ${targetClass}`}>
                        <SentenceText text={s.text} highlights={lit} reading={s.reading} />
                      </span>
                      <span className={`${styles.gloss} ${nativeClass}`}>
                        <SentenceText text={s.gloss} highlights={glossLit} />
                      </span>
                    </span>
                    <SpeakButton
                      text={s.text}
                      lang={target}
                      audio={s.audio}
                      rate={rate}
                      label={t.common.play}
                      failedLabel={t.common.playFailed}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {look.minna.length ? (
          <section aria-labelledby="look-minna">
            <div className={styles.listHead}>
              <h2 id="look-minna">{t.me.lookMinna}</h2>
              <span className={styles.count}>{t.common.count(look.minna.length)}</span>
            </div>
            <ul className={styles.plainList}>
              {look.minna.map((s) => (
                <li key={s.id} className={styles.row}>
                  <span className={styles.rowText}>
                    <span className={`${styles.exampleText} ${targetClass}`}>
                      <SentenceText text={s.text} highlights={[{ ...s.mark, kind: "mark" }]} reading={readingFor(s.text, target)} />
                    </span>
                    {s.gloss ? <span className={`${styles.gloss} ${nativeClass}`}>{s.gloss}</span> : null}
                  </span>
                  <SpeakButton
                    text={s.text}
                    lang={target}
                    audio={{ src: audioUrl(s.text, target), fallback: `/api/tts?shared=${s.id}` }}
                    rate={rate}
                    label={t.common.play}
                    failedLabel={t.common.playFailed}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
