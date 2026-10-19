import Link from "next/link";
import { Icon } from "@/components/Icon";
import { SentenceText, type Highlight } from "@/components/SentenceText";
import { diffRanges, type Range } from "@/lib/diff";
import type { Dict } from "@/lib/i18n";
import { LANG_LOCALE, langClass, type Lang } from "@/lib/langs";
import { loadDays, loadMine, loadPatterns, type DayRain, type MySaid } from "@/lib/me";
import { withdrawMine } from "../actions";
import styles from "../app.module.css";

// The three ways to look back in 自分. Each loads only what it shows.

type ViewProps = { userId: string; target: Lang; native: Lang; t: Dict };

/** A day as the learner would say it: 10月12日（月）. */
export function dayLabel(day: string, native: Lang) {
  return new Intl.DateTimeFormat(LANG_LOCALE[native], { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo" }).format(
    new Date(`${day}T12:00:00+09:00`),
  );
}

export function lookHref(patternId: string, from?: "forms") {
  return `/app/me/f/${encodeURIComponent(patternId)}${from ? `?from=${from}` : ""}`;
}

export async function DaysView({ userId, target, native, t, before }: ViewProps & { before: string | null }) {
  const { days, earlier, today, yesterday } = await loadDays(userId, target, native, before);
  if (days.length === 0) {
    return (
      <>
        <p className={styles.empty}>{t.me.daysNone}</p>
        {before ? (
          <Link href="/app/me" className={styles.moreLink}>
            {t.me.latest}
          </Link>
        ) : null}
      </>
    );
  }

  const chips = (list: DayRain[]) => (
    <dd className={styles.chips}>
      {list.map((r) => (
        <Link key={r.patternId} href={lookHref(r.patternId)} className={styles.chip}>
          {r.label}
          {r.times > 1 ? <span className={styles.chipTimes}>{t.me.timesShort(r.times)}</span> : null}
          {r.first ? <span className={styles.firstTag}>{t.me.first}</span> : null}
        </Link>
      ))}
    </dd>
  );

  return (
    <div className={styles.days}>
      {days.map((d) => (
        <section key={d.day} className={styles.day} aria-labelledby={`day-${d.day}`}>
          <h2 id={`day-${d.day}`} className={styles.dayHead}>
            {dayLabel(d.day, native)}
            {d.day === today ? <span>{t.me.today}</span> : d.day === yesterday ? <span>{t.me.yesterday}</span> : null}
          </h2>
          <dl className={styles.dayList}>
            {d.rains.length ? (
              <div className={styles.dayRow}>
                <dt>{t.me.dayRains}</dt>
                {chips(d.rains)}
              </div>
            ) : null}
            {d.minna.length ? (
              <div className={styles.dayRow}>
                <dt>{t.me.dayMinna}</dt>
                {chips(d.minna)}
              </div>
            ) : null}
            {d.words.length ? (
              <div className={styles.dayRow}>
                <dt>{t.me.dayWords}</dt>
                <dd className={`${styles.dayWords} ${langClass(target)}`}>{d.words.join(" · ")}</dd>
              </div>
            ) : null}
          </dl>
          {/* The sentences need the whole width (what they wrote above what it became), so they follow the short rows. */}
          {d.said.length ? (
            <div className={styles.daySaid}>
              <h3 className={styles.daySaidHead}>
                {t.me.daySaid}
                <span className={styles.count}>{t.common.count(d.said.length)}</span>
              </h3>
              <ul className={styles.plainList}>
                {d.said.map((s) => (
                  <li key={s.id}>
                    <SaidLink said={s} target={target} native={native} t={t} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ))}
      {earlier ? (
        <Link href={`/app/me?before=${earlier}`} className={styles.moreLink}>
          {t.me.earlier}
        </Link>
      ) : before ? (
        <Link href="/app/me" className={styles.moreLink}>
          {t.me.latest}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * What the learner wrote and what it became, as on the correction page: the removed parts struck through, the added
 * ones underlined. A sentence that needed nothing is shown once. `mark` lights a pattern in the corrected one.
 */
export function SaidPair({
  input,
  text,
  target,
  t,
  afterClass,
  mark = null,
  reading = null,
}: {
  input: string;
  text: string;
  target: Lang;
  t: Dict;
  afterClass: string;
  mark?: Range | null;
  reading?: string[] | null;
}) {
  const lit: Highlight[] = mark ? [{ ...mark, kind: "mark" }] : [];
  if (input.trim() === text.trim()) {
    return (
      <span className={`${afterClass} ${langClass(target)}`}>
        <SentenceText text={text} highlights={lit} reading={reading} />
      </span>
    );
  }
  const { removed, added } = diffRanges(input, text, target);
  return (
    <span className={styles.saidPair}>
      <span className={styles.saidTag}>{t.me.wrote}</span>
      <span className={`${styles.saidBefore} ${langClass(target)}`}>
        <SentenceText text={input} highlights={removed.map((r) => ({ ...r, kind: "del" as const }))} />
      </span>
      <span className={styles.saidTag}>{t.me.fixed}</span>
      <span className={`${afterClass} ${langClass(target)}`}>
        <SentenceText text={text} highlights={[...added.map((r) => ({ ...r, kind: "ins" as const })), ...lit]} reading={reading} />
      </span>
    </span>
  );
}

/** One of the learner's corrected sentences, opening its correction page. */
function SaidLink({ said, target, native, t }: { said: MySaid; target: Lang; native: Lang; t: Dict }) {
  const body = (
    <>
      <span className={styles.rowText}>
        <SaidPair input={said.input} text={said.text} target={target} t={t} afterClass={styles.rowMain} />
        {said.gloss ? <span className={`${styles.rowSub} ${langClass(native)}`}>{said.gloss}</span> : null}
      </span>
      {said.natural ? <span className={styles.usedTag}>{t.me.natural}</span> : null}
    </>
  );
  if (!said.sayingId) return <div className={styles.row}>{body}</div>;
  return (
    <Link href={`/app/s/${said.sayingId}`} className={styles.rowLink}>
      {body}
      <Icon name="arrow" size={18} />
    </Link>
  );
}

export async function FormsView({ userId, target, native, t }: ViewProps) {
  const patterns = await loadPatterns(userId, target, native);
  if (patterns.length === 0) return <p className={styles.empty}>{t.me.metNone}</p>;
  return (
    <section className={styles.stackSm} aria-label={t.me.views.forms}>
      <p className={styles.note}>{t.me.usedNote}</p>
      <ul className={styles.plainList} style={{ borderTop: "1px solid var(--line)" }}>
        {patterns.map((p) => (
          <li key={p.patternId}>
            <Link href={lookHref(p.patternId, "forms")} className={styles.rowLink}>
              <span className={styles.rowText}>
                <span className={styles.rowMain}>{p.label}</span>
              </span>
              {p.used ? <span className={styles.usedTag}>{t.me.used}</span> : null}
              <span className={styles.count}>{t.me.metTimes(p.times)}</span>
              <Icon name="arrow" size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function MineView({ userId, target, native, t, sharing }: ViewProps & { sharing: boolean }) {
  const { said, wanted, shared } = await loadMine(userId, target);
  const targetClass = langClass(target);
  const nativeClass = langClass(native);
  return (
    <>
      <section aria-labelledby="me-said">
        <div className={styles.listHead}>
          <h2 id="me-said">{t.me.saidTitle}</h2>
          <span className={styles.count}>{t.common.count(said.length)}</span>
        </div>
        {said.length === 0 ? (
          <p className={styles.empty}>{t.me.saidNone}</p>
        ) : (
          <ul className={styles.plainList}>
            {said.map((s) => (
              <li key={s.id}>
                <SaidLink said={s} target={target} native={native} t={t} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="me-wanted">
        <div className={styles.listHead}>
          <h2 id="me-wanted">{t.me.wantedTitle}</h2>
          <span className={styles.count}>{t.common.count(wanted.length)}</span>
        </div>
        <p className={styles.note} style={{ padding: "8px 0 4px" }}>
          {t.me.wantedNote}
        </p>
        {wanted.length === 0 ? (
          <p className={styles.empty}>{t.me.wantedNone}</p>
        ) : (
          <ul className={styles.plainList}>
            {wanted.map((s) => (
              <li key={s.id} className={styles.row}>
                <span className={styles.rowText}>
                  <span className={`${styles.rowMain} ${targetClass}`}>{s.text}</span>
                  {s.gloss ? <span className={`${styles.rowSub} ${nativeClass}`}>{s.gloss}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="me-shared">
        <div className={styles.listHead}>
          <h2 id="me-shared">{t.me.sharedTitle}</h2>
          <span className={styles.count}>{t.common.count(shared.length)}</span>
        </div>
        {!sharing && shared.length === 0 ? (
          <p className={styles.empty}>
            {t.me.sharedOff}
            <Link href="/app/me/settings" className={styles.inlineLink}>
              {t.me.sharedOffLink}
            </Link>
          </p>
        ) : shared.length === 0 ? (
          <p className={styles.empty}>{t.me.sharedNone}</p>
        ) : (
          <ul className={styles.plainList}>
            {shared.map((s) => (
              <li key={s.id} className={styles.row}>
                <span className={styles.rowText}>
                  <span className={`${styles.rowMain} ${targetClass}`}>{s.text}</span>
                  {s.gloss ? <span className={`${styles.rowSub} ${nativeClass}`}>{s.gloss}</span> : null}
                </span>
                <span className={styles.rowSide}>
                  {s.reached ? <span className={styles.usedTag}>{t.me.reached}</span> : null}
                  <form action={withdrawMine.bind(null, s.id)}>
                    <button type="submit" className={styles.quietLink}>
                      {t.me.withdraw}
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
