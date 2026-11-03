import Link from "next/link";
import { loadCohorts, loadDays, loadLearners, loadWeekHours } from "@/lib/admin-usage";
import {
  bucketLabel,
  buckets,
  byTarget,
  features,
  labelEvery,
  longDay,
  num,
  percent,
  shortDay,
  steps,
  summarize,
  tokyoDay,
  tokyoTime,
  type DayRow,
} from "@/lib/admin-usage-core";
import { getDict } from "@/lib/i18n";
import { LIMITS } from "@/lib/metering";
import { BarRows, ColumnChart, Meter, WeekHeat, type Column } from "./_usage/charts";
import { Tile } from "./_usage/Tile";
import styles from "./usage.module.css";

export const metadata = { title: "利用状況" };

const SPANS = [14, 30, 90];
const DEFAULT_SPAN = 30;
// Rains per learner: 0, 1, 2, 3–5, 6–10, 11–30, 31+. Days per learner: 0, 1, 2, 3–4, 5–9, 10+.
const RAIN_EDGES = [0, 1, 2, 3, 6, 11, 31];
const DAY_EDGES = [0, 1, 2, 3, 5, 10];
const COHORT_DAYS = 14;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function UsagePage({ searchParams }: PageProps<"/admin">) {
  const params = await searchParams;
  const span = SPANS.find((s) => String(s) === first(params.days)) ?? DEFAULT_SPAN;
  const withExcluded = first(params.all) === "1";
  const href = (next: { days?: number; all?: boolean }) => {
    const query = new URLSearchParams();
    const days = next.days ?? span;
    if (days !== DEFAULT_SPAN) query.set("days", String(days));
    if (next.all ?? withExcluded) query.set("all", "1");
    return query.size ? `/admin?${query}` : "/admin";
  };

  const [everyone, days, weekHours, cohorts] = await Promise.all([
    loadLearners(),
    loadDays(span, withExcluded),
    loadWeekHours(span, withExcluded),
    loadCohorts(COHORT_DAYS, withExcluded),
  ]);
  const back = (n: number | null, of: number) => (n === null ? "—" : `${num(n)}人（${percent(n, of)}）`);
  const excluded = everyone.filter((l) => l.excluded).length;
  const learners = withExcluded ? everyone : everyone.filter((l) => !l.excluded);
  const now = new Date().toISOString();
  const today = tokyoDay(now);
  const sum = summarize(learners, today);
  const step = steps(learners);
  const usage = features(learners);
  const langs = getDict("ja").common.langs;
  const every = labelEvery(days.length);
  const todayUsage = days.at(-1);

  const dayColumns = (values: (d: DayRow) => number[], notes?: (d: DayRow) => string[]): Column[] =>
    days.map((d) => ({ label: shortDay(d.day), title: longDay(d.day), values: values(d), notes: notes?.(d) }));
  const bucketColumns = (values: number[], edges: number[], unit: string): Column[] =>
    buckets(values, edges).map((b) => ({ label: bucketLabel(b), title: `${bucketLabel(b)}${unit}`, values: [b.count] }));

  const featureRows = [
    { key: "rain", label: "例文の雨", people: usage.rain.people, times: usage.rain.times, unit: "回" },
    { key: "minna", label: "みんなの雨", people: usage.minna.people, times: usage.minna.times, unit: "回" },
    { key: "said", label: "言ってみる（添削）", people: usage.said.people, times: usage.said.times, unit: "回" },
    { key: "explained", label: "詳しく解説", people: usage.explained.people, times: usage.explained.times, unit: "回" },
    { key: "words", label: "単語のメモ", people: usage.words.people, times: usage.words.times, unit: "語" },
    { key: "tutorial", label: "チュートリアル（飛ばした人も）", people: usage.tutorial.people, times: null, unit: "" },
    { key: "cue", label: "雨のきっかけを決めた", people: usage.cue.people, times: null, unit: "" },
    { key: "shareOn", label: "みんなの雨に出す（オン）", people: usage.shareOn.people, times: null, unit: "" },
    { key: "shared", label: "みんなの雨に出た文", people: usage.shared.people, times: usage.shared.times, unit: "文" },
    { key: "hearts", label: "これ言いたかった", people: usage.hearts.people, times: usage.hearts.times, unit: "回" },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>利用状況</h1>
          <p className={styles.sub}>
            {longDay(today)} {tokyoTime(now).slice(-5)} 時点・日付は日本時間
          </p>
        </div>
        <p className={styles.scope}>
          {excluded === 0 ? (
            <>集計から外している人はいません</>
          ) : withExcluded ? (
            <>
              集計から外した {excluded}人も数えています · <Link href={href({ all: false })}>外して見る</Link>
            </>
          ) : (
            <>
              集計から外した {excluded}人を除いています · <Link href={href({ all: true })}>含めて見る</Link>
            </>
          )}
        </p>
      </div>

      <div className={styles.tiles}>
        <Tile
          hero
          label="利用者（言語を選んで始めた人）"
          value={sum.learners}
          unit="人"
          note={`今日 +${num(sum.joinedToday)}人 · この7日 +${num(sum.joinedWeek)}人`}
        />
        <Tile label="雨を浴びた人" value={sum.bathed} unit="人" note={`利用者の ${percent(sum.bathed, sum.learners)}`} />
        <Tile label="言ってみた人" value={step.said} unit="人" note={`利用者の ${percent(step.said, sum.learners)}`} />
        <Tile label="今日来た人" value={sum.activeToday} unit="人" />
        <Tile label="この7日に来た人" value={sum.activeWeek} unit="人" />
        <Tile label="この30日に来た人" value={sum.activeMonth} unit="人" />
        <Tile
          label="2日以上来た人"
          value={sum.returned}
          unit="人"
          note={`雨を浴びた人の ${percent(sum.returned, sum.bathed)}`}
        />
      </div>
      <p className={styles.help}>
        「来た」は、その日に雨を浴び終えた・言ってみた・添削を受けた・単語をメモしたのどれかがあったこと。アプリを開いただけの日は数えていません。
      </p>

      <section className={styles.section} aria-labelledby="by-day">
        <div className={styles.sectionHead}>
          <h2 id="by-day" className={styles.h2}>
            日ごと
          </h2>
          <nav className={styles.choices} aria-label="期間">
            {SPANS.map((s) => (
              <Link key={s} href={href({ days: s })} className={styles.choice} aria-current={s === span ? "true" : undefined}>
                {s}日
              </Link>
            ))}
          </nav>
        </div>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>来た人</h3>
          <ColumnChart
            series={[
              { label: "また来た人", tone: "strong" },
              { label: "はじめて来た人", tone: "soft" },
            ]}
            columns={dayColumns(
              (d) => [d.active - d.firstTime, d.firstTime],
              (d) => [`この日に始めた ${num(d.joined)}人`],
            )}
            unit="人"
            every={every}
            height={180}
          />
        </div>
        <div className={styles.cards} data-cols="3">
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>雨を浴びた回数</h3>
            <ColumnChart series={[{ label: "雨", tone: "strong" }]} columns={dayColumns((d) => [d.rains])} unit="回" every={every} height={120} />
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>言ってみた回数</h3>
            <ColumnChart
              series={[{ label: "言ってみた", tone: "strong" }]}
              columns={dayColumns((d) => [d.sayings])}
              unit="回"
              every={every}
              height={120}
            />
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>メモした単語</h3>
            <ColumnChart series={[{ label: "単語", tone: "strong" }]} columns={dayColumns((d) => [d.words])} unit="語" every={every} height={120} />
          </div>
        </div>
        <details className={styles.tableView}>
          <summary>表で見る</summary>
          <div className={styles.card}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">日付</th>
                    <th scope="col">始めた</th>
                    <th scope="col">来た</th>
                    <th scope="col">うちはじめて</th>
                    <th scope="col">雨</th>
                    <th scope="col">言ってみた</th>
                    <th scope="col">添削</th>
                    <th scope="col">単語</th>
                    <th scope="col">AI 添削（全体）</th>
                    <th scope="col">音声の生成（全体）</th>
                    <th scope="col">メール（全体）</th>
                  </tr>
                </thead>
                <tbody>
                  {days.toReversed().map((d) => (
                    <tr key={d.day}>
                      <th scope="row">{longDay(d.day)}</th>
                      <td>{num(d.joined)}</td>
                      <td>{num(d.active)}</td>
                      <td>{num(d.firstTime)}</td>
                      <td>{num(d.rains)}</td>
                      <td>{num(d.sayings)}</td>
                      <td>{num(d.corrections)}</td>
                      <td>{num(d.words)}</td>
                      <td>{num(d.aiCorrections)}</td>
                      <td>{num(d.tts)}</td>
                      <td>{num(d.emails)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.help}>
              「全体」の3列は、集計から外した人も含むサービス全体の回数です。10月16日より前の雨は、かたちごとに最後に浴びた日の1回だけが残っています。
            </p>
          </div>
        </details>
      </section>

      <div className={styles.cards} data-cols="2">
        <section className={styles.card} aria-labelledby="steps">
          <h2 id="steps" className={styles.cardTitle}>
            どこまで進んだか
          </h2>
          <p className={styles.cardNote}>利用者全体に対する割合</p>
          <BarRows
            unit="人"
            rows={[
              { key: "started", label: "始めた", value: step.started },
              { key: "bathed", label: "雨を浴びた", value: step.bathed, note: percent(step.bathed, step.started) },
              { key: "said", label: "言ってみた", value: step.said, note: percent(step.said, step.started) },
              { key: "two", label: "2日以上来た", value: step.twoDays, note: percent(step.twoDays, step.started) },
              { key: "three", label: "3日以上来た", value: step.threeDays, note: percent(step.threeDays, step.started) },
            ]}
          />
        </section>
        <section className={styles.card} aria-labelledby="langs">
          <h2 id="langs" className={styles.cardTitle}>
            学んでいる言語
          </h2>
          <BarRows
            unit="人"
            rows={byTarget(learners).map((t) => ({
              key: t.lang,
              label: langs[t.lang],
              value: t.count,
              note: percent(t.count, sum.learners),
            }))}
          />
        </section>
      </div>

      <section className={styles.section} aria-labelledby="per-person">
        <h2 id="per-person" className={styles.h2}>
          一人あたり
        </h2>
        <div className={styles.cards} data-cols="2">
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>雨を浴びた回数ごとの人数</h3>
            <ColumnChart
              series={[{ label: "人数", tone: "strong" }]}
              columns={bucketColumns(
                learners.map((l) => l.rains + l.minnaRains),
                RAIN_EDGES,
                "回",
              )}
              unit="人"
              height={140}
            />
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>来た日数ごとの人数</h3>
            <ColumnChart
              series={[{ label: "人数", tone: "strong" }]}
              columns={bucketColumns(
                learners.map((l) => l.activeDays),
                DAY_EDGES,
                "日",
              )}
              unit="人"
              height={140}
            />
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="when">
        <h2 id="when" className={styles.h2}>
          いつ使われ、戻ってきたか
        </h2>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>曜日と時間（この{span}日・日本時間）</h3>
          <p className={styles.cardNote}>雨を浴び終えた・言ってみた・単語をメモした時間に、その人を数えています。</p>
          <WeekHeat cells={weekHours} unit="人" />
        </div>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>戻ってきたか</h3>
          <p className={styles.cardNote}>
            はじめて来た日ごとに、その人がまた来たか（この{COHORT_DAYS}日）。まだその日が来ていない数は「—」。
          </p>
          {cohorts.length === 0 ? (
            <p className={styles.empty}>この{COHORT_DAYS}日にはじめて来た人はいません</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">はじめて来た日</th>
                    <th scope="col">人数</th>
                    <th scope="col">次の日</th>
                    <th scope="col">7日以内</th>
                    <th scope="col">その後いつか</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((k) => (
                    <tr key={k.firstDay}>
                      <th scope="row">{longDay(k.firstDay)}</th>
                      <td>{num(k.devices)}人</td>
                      <td>{back(k.backNext, k.devices)}</td>
                      <td>{back(k.backWeek, k.devices)}</td>
                      <td>{back(k.backAny, k.devices)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <div className={styles.cards} data-cols="2">
        <section className={styles.card} aria-labelledby="features">
          <h2 id="features" className={styles.cardTitle}>
            機能ごと
          </h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">機能</th>
                  <th scope="col">使った人</th>
                  <th scope="col">割合</th>
                  <th scope="col">回数</th>
                </tr>
              </thead>
              <tbody>
                {featureRows.map((f) => (
                  <tr key={f.key}>
                    <th scope="row">{f.label}</th>
                    <td>{num(f.people)}人</td>
                    <td>{percent(f.people, sum.learners)}</td>
                    <td>{f.times === null ? "—" : `${num(f.times)}${f.unit}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className={styles.card} aria-labelledby="limits">
          <h2 id="limits" className={styles.cardTitle}>
            今日の上限（サービス全体）
          </h2>
          <p className={styles.cardNote}>集計から外した人も含みます。日本時間の0時に戻ります。</p>
          <Meter label="AI の添削" used={todayUsage?.aiCorrections ?? 0} limit={LIMITS.corrections.global} unit="回" />
          <Meter label="音声の生成" used={todayUsage?.tts ?? 0} limit={LIMITS.tts.global} unit="件" />
          <Meter label="登録・再設定のメール" used={todayUsage?.emails ?? 0} limit={LIMITS.emails.global} unit="通" />
        </section>
      </div>

      <Link href="/admin/patterns" className={styles.more}>
        かたちごとに見る（どこで止まっているか）→
      </Link>
      <Link href="/admin/users" className={styles.more}>
        一人ずつ見る →
      </Link>
    </main>
  );
}
