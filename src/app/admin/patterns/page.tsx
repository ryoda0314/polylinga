import Link from "next/link";
import { loadPatterns } from "@/lib/admin-usage";
import { num, percent } from "@/lib/admin-usage-core";
import { getDict } from "@/lib/i18n";
import { isLang, langClass, type Lang } from "@/lib/langs";
import type { CSSProperties } from "react";
import styles from "../usage.module.css";

export const metadata = { title: "かたちごと" };

const TARGETS: Lang[] = ["ko", "en", "zh"];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// かたちごと: each pattern of a language in the order new learners meet them, and how far learners get. Where the share
// kept from the pattern before drops, learners stop; where few said something with it, or few of those sentences came
// back natural, the pattern may need plainer sentences.
export default async function PatternsPage({ searchParams }: PageProps<"/admin/patterns">) {
  const params = await searchParams;
  const asked = first(params.lang);
  const lang: Lang = isLang(asked) && TARGETS.includes(asked) ? asked : "ko";
  const withExcluded = first(params.all) === "1";
  const href = (next: { lang?: Lang; all?: boolean }) => {
    const query = new URLSearchParams({ lang: next.lang ?? lang });
    if (next.all ?? withExcluded) query.set("all", "1");
    return `/admin/patterns?${query}`;
  };

  const patterns = await loadPatterns(lang, withExcluded);
  const langs = getDict("ja").common.langs;
  const reached = patterns.filter((p) => p.learners > 0);
  const unreached = patterns.filter((p) => p.learners === 0);
  const most = Math.max(1, ...reached.map((p) => p.learners));

  return (
    <main className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>かたちごと</h1>
          <p className={styles.sub}>
            はじめての人が出会う順に並べています。「前のかたちから」が大きく減るところが、止まりやすいところです。
          </p>
        </div>
        <p className={styles.scope}>
          {withExcluded ? (
            <>
              集計から外した人も数えています · <Link href={href({ all: false })}>外して見る</Link>
            </>
          ) : (
            <>
              集計から外した人を除いています · <Link href={href({ all: true })}>含めて見る</Link>
            </>
          )}
        </p>
      </div>

      <nav className={styles.choices} aria-label="学んでいる言語">
        {TARGETS.map((l) => (
          <Link key={l} href={href({ lang: l })} className={styles.choice} aria-current={l === lang ? "true" : undefined}>
            {langs[l]}
          </Link>
        ))}
      </nav>

      <div className={styles.card}>
        {reached.length === 0 ? (
          <p className={styles.empty}>{langs[lang]}のかたちを浴びた人はまだいません</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.people}`}>
              <thead>
                <tr>
                  <th scope="col">かたち</th>
                  <th scope="col">浴びた人</th>
                  <th scope="col">最初のかたちから</th>
                  <th scope="col">前のかたちから</th>
                  <th scope="col">また出会った人</th>
                  <th scope="col">言ってみた人</th>
                  <th scope="col">そのまま自然</th>
                  <th scope="col">浴びた回数</th>
                </tr>
              </thead>
              <tbody>
                {reached.map((p, i) => {
                  // Only the pattern just before in the order says how many stopped there; with steps skipped it does not.
                  const prev = i > 0 ? reached[i - 1] : null;
                  const before = prev && prev.step !== null && p.step === prev.step + 1 ? prev.learners : null;
                  const kept = before ? p.learners / before : null;
                  return (
                    <tr key={p.id} data-drop={kept !== null && kept < 0.6 ? "" : undefined}>
                      <td>
                        <span className={styles.person}>
                          <span className={langClass(lang)}>{p.form}</span>
                          <span className={styles.email}>
                            {p.step !== null ? `${p.step}. ` : ""}
                            {p.label}
                          </span>
                        </span>
                      </td>
                      <td>
                        {num(p.learners)}人
                        <span className={styles.inlineBar} style={{ "--f": p.learners / most } as CSSProperties} aria-hidden="true" />
                      </td>
                      <td>{percent(p.learners, reached[0].learners)}</td>
                      <td>{before ? percent(p.learners, before) : "—"}</td>
                      <td>
                        {num(p.again)}人（{percent(p.again, p.learners)}）
                      </td>
                      <td>
                        {num(p.saidLearners)}人（{percent(p.saidLearners, p.learners)}）
                      </td>
                      <td>{p.corrections > 0 ? `${percent(p.natural, p.corrections)}（${num(p.natural)}/${num(p.corrections)}）` : "—"}</td>
                      <td>{num(p.rains)}回</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className={styles.help}>
        「前のかたちから」は順番がすぐ前のかたちと比べた割合で、6割を切ったところに印を付けています（前の順番のかたちをだれも浴びていなければ「—」）。「そのまま自然」は、そのかたちで言ってみた文のうち、添削で直すところがなかった割合です。
        「言ってみた人」は、そのかたちの雨から言ってみた人だけ（自由に添削で書いた文は入りません）。
      </p>
      {unreached.length > 0 ? (
        <details className={styles.tableView}>
          <summary>まだだれも浴びていないかたち（{num(unreached.length)}個）</summary>
          <div className={styles.card}>
            <p className={`${styles.help} ${langClass(lang)}`}>{unreached.map((p) => p.form).join("　")}</p>
          </div>
        </details>
      ) : null}
    </main>
  );
}
