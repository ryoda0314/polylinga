import Form from "next/form";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { SentenceText } from "@/components/SentenceText";
import { SpeakButton } from "@/components/SpeakButton";
import { lookUp } from "@/lib/corpus";
import { getDict } from "@/lib/i18n";
import { langClass } from "@/lib/langs";
import { requireSettings } from "@/lib/settings";
import styles from "../../app.module.css";
import { WordAddForm } from "../WordControls";

export const metadata = { title: "例文から探す" };

// Zero-width and bidi control characters, which would make a search miss.
function visible(text: string): string {
  return Array.from(text)
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      return !((c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202f) || c === 0xfeff);
    })
    .join("");
}

/**
 * 例文から探す: "what was that word again?" Type it in the language being learned or in Japanese, and the library
 * sentences that contain it come up with their translations and audio. There are no definitions; a few sentences side
 * by side show what it means, as in the rain. The memo form sits below, for typing in a word worth keeping.
 */
export default async function LookPage({ searchParams }: PageProps<"/app/memo/look">) {
  const [settings, params] = await Promise.all([requireSettings(), searchParams]);
  const t = getDict(settings.nativeLang);
  const target = settings.targetLang;
  const native = settings.nativeLang;
  const q = typeof params.q === "string" ? visible(params.q).trim().slice(0, 40) : "";
  const found = q ? await lookUp(q, target, native) : null;

  return (
    <>
      <header className={styles.subbar}>
        <Link href="/app/memo" className={styles.iconLink} aria-label={t.common.back}>
          <Icon name="back" size={22} />
        </Link>
        <h1 className={styles.subtitleStrong}>{t.look.title}</h1>
      </header>
      <div className={styles.bodyTight}>
        <Form action="/app/memo/look" className={styles.stackSm} role="search">
          <label htmlFor="look-q" className="label">
            {t.look.label(t.common.langs[target])}
          </label>
          <div className={styles.lookRow}>
            <input
              id="look-q"
              name="q"
              defaultValue={q}
              required
              maxLength={40}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className={`${styles.lookInput} ${langClass(target)}`}
            />
            <button type="submit" className="btn">
              {t.look.submit}
            </button>
          </div>
          <p className={styles.note}>{t.look.hint}</p>
        </Form>

        {found === null ? null : found.length === 0 ? (
          <p className={styles.empty}>{t.look.none(q)}</p>
        ) : (
          <section aria-labelledby="look-found">
            <div className={styles.listHead}>
              <h2 id="look-found">{t.look.found(q)}</h2>
              <span className={styles.count}>{t.common.count(found.length)}</span>
            </div>
            <ul className={styles.plainList}>
              {found.map((s) => (
                <li key={s.id} className={styles.row}>
                  <span className={styles.rowText}>
                    <span className={`${styles.exampleText} ${langClass(target)}`}>
                      <SentenceText text={s.text} highlights={s.hits.map((h) => ({ ...h, kind: "mark" as const }))} reading={s.reading} />
                    </span>
                    <span className={`${styles.gloss} ${langClass(native)}`}>
                      <SentenceText text={s.gloss} highlights={s.glossHits.map((h) => ({ ...h, kind: "mark" as const }))} />
                    </span>
                  </span>
                  <SpeakButton
                    text={s.text}
                    lang={target}
                    audio={s.audio}
                    rate={settings.speechRate}
                    label={t.common.play}
                    failedLabel={t.common.playFailed}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {found?.length ? (
          <section className={styles.stackSm}>
            <p className={styles.note}>{t.look.memo}</p>
            <WordAddForm native={native} target={target} />
          </section>
        ) : null}
      </div>
    </>
  );
}
