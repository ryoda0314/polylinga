import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadAppAccounts, loadAppCohorts, loadAppCounts, loadAppDays } from "@/lib/admin-apps";
import { appInfo, type AppDay } from "@/lib/admin-apps-core";
import { labelEvery, longDay, num, percent, shortDay, tokyoDay, tokyoTime } from "@/lib/admin-usage-core";
import { ColumnChart, type Column } from "../../_usage/charts";
import { Tile } from "../../_usage/Tile";
import styles from "../../usage.module.css";

export const metadata = { title: "姉妹アプリ" };

const SPANS = [14, 30, 90];
const DEFAULT_SPAN = 30;
const COHORT_DAYS = 14;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// One sister's devices day by day: how many came, how many were new, whether they came back, and what they did.
export default async function AppPage({ params, searchParams }: PageProps<"/admin/apps/[id]">) {
  const { id } = await params;
  // ことのあめ counts its learners by their account, on its own pages.
  if (id === "kotonoame") redirect("/admin");
  const app = appInfo(id);
  if (!app) notFound();
  const query = await searchParams;
  const span = SPANS.find((s) => String(s) === first(query.days)) ?? DEFAULT_SPAN;

  const [counts, accounts, days, cohorts] = await Promise.all([
    loadAppCounts(),
    loadAppAccounts(),
    loadAppDays(app.id, span),
    loadAppCohorts(app.id, COHORT_DAYS),
  ]);
  const c = counts.get(app.id);
  const a = accounts.get(app.id);
  const now = new Date().toISOString();
  const today = tokyoDay(now);
  const every = labelEvery(days.length);
  const href = (s: number) => (s === DEFAULT_SPAN ? `/admin/apps/${app.id}` : `/admin/apps/${app.id}?days=${s}`);
  const dayColumns = (values: (d: AppDay) => number[], notes?: (d: AppDay) => string[]): Column[] =>
    days.map((d) => ({ label: shortDay(d.day), title: longDay(d.day), values: values(d), notes: notes?.(d) }));
  const back = (n: number | null, of: number) => (n === null ? "—" : `${num(n)}台（${percent(n, of)}）`);

  return (
    <main className={styles.page}>
      <Link href="/admin/apps" className={styles.back}>
        ← 姉妹アプリ
      </Link>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>{app.name}</h1>
          <p className={styles.sub}>
            {app.what}
            {app.url ? (
              <>
                {" · "}
                <a href={app.url} target="_blank" rel="noreferrer">
                  {new URL(app.url).host}
                </a>
              </>
            ) : (
              " · 公開先はまだありません"
            )}
          </p>
        </div>
        <p className={styles.sub}>
          {longDay(today)} {tokyoTime(now).slice(-5)} 時点・数は端末の台数
        </p>
      </div>

      {c ? (
        <>
          <div className={styles.tiles}>
            <Tile
              hero
              label="この7日に来た端末"
              value={c.week}
              unit="台"
              note={`今日 ${num(c.today)}台 · この30日 ${num(c.month)}台`}
            />
            <Tile label="これまで" value={c.devices} unit="台" note={c.firstDay ? `${longDay(c.firstDay)}から` : undefined} />
            <Tile label="この7日にはじめて" value={c.newWeek} unit="台" />
            <Tile
              label="ホーム画面から"
              value={c.fromHomeWeek}
              unit="台"
              note={`この7日・来た端末の ${percent(c.fromHomeWeek, c.week)}`}
            />
            <Tile label="開いた（7日）" value={c.opensWeek} unit="回" />
            <Tile label={`${app.learn}（7日）`} value={c.learnsWeek} unit="回" />
            {app.say ? (
              <Tile label={`${app.say}（7日）`} value={c.saysWeek} unit="回" />
            ) : (
              <Tile label="アカウントで記録" value={a?.accounts ?? 0} unit="人" />
            )}
          </div>
          <p className={styles.help}>
            同じ人でも端末が違えば別の1台です。設定で「使われ方の数を送る」を切った端末と、公開先以外で開いた分は入りません。
            {app.accounts
              ? ` ことのあめ のアカウントで記録を残している人は ${num(a?.accounts ?? 0)}人（この7日に更新 ${num(a?.week ?? 0)}人、集計から外した人を除く）。`
              : ""}
          </p>

          <section className={styles.section} aria-labelledby="by-day">
            <div className={styles.sectionHead}>
              <h2 id="by-day" className={styles.h2}>
                日ごと
              </h2>
              <nav className={styles.choices} aria-label="期間">
                {SPANS.map((s) => (
                  <Link key={s} href={href(s)} className={styles.choice} aria-current={s === span ? "true" : undefined}>
                    {s}日
                  </Link>
                ))}
              </nav>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>来た端末</h3>
              <ColumnChart
                series={[
                  { label: "また来た端末", tone: "strong" },
                  { label: "はじめて来た端末", tone: "soft" },
                ]}
                columns={dayColumns(
                  (d) => [d.devices - d.newDevices, d.newDevices],
                  (d) => [`ホーム画面から ${num(d.fromHome)}台`],
                )}
                unit="台"
                every={every}
                height={180}
              />
            </div>
            <div className={styles.cards} data-cols={app.say ? "3" : "2"}>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>開いた回数</h3>
                <ColumnChart series={[{ label: "開いた", tone: "strong" }]} columns={dayColumns((d) => [d.opens])} unit="回" every={every} height={120} />
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>{app.learn}回数</h3>
                <ColumnChart series={[{ label: app.learn, tone: "strong" }]} columns={dayColumns((d) => [d.learns])} unit="回" every={every} height={120} />
              </div>
              {app.say ? (
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>{app.say}回数</h3>
                  <ColumnChart series={[{ label: app.say, tone: "strong" }]} columns={dayColumns((d) => [d.says])} unit="回" every={every} height={120} />
                </div>
              ) : null}
            </div>
            <details className={styles.tableView}>
              <summary>表で見る</summary>
              <div className={styles.card}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">日付</th>
                        <th scope="col">来た端末</th>
                        <th scope="col">うちはじめて</th>
                        <th scope="col">ホーム画面から</th>
                        <th scope="col">開いた</th>
                        <th scope="col">{app.learn}</th>
                        {app.say ? <th scope="col">{app.say}</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {days.toReversed().map((d) => (
                        <tr key={d.day}>
                          <th scope="row">{longDay(d.day)}</th>
                          <td>{num(d.devices)}</td>
                          <td>{num(d.newDevices)}</td>
                          <td>{num(d.fromHome)}</td>
                          <td>{num(d.opens)}</td>
                          <td>{num(d.learns)}</td>
                          {app.say ? <td>{num(d.says)}</td> : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          </section>

          <section className={styles.card} aria-labelledby="cohorts">
            <h2 id="cohorts" className={styles.cardTitle}>
              戻ってきたか
            </h2>
            <p className={styles.cardNote}>
              はじめて来た日ごとに、その端末がまた来たか（この{COHORT_DAYS}日）。まだその日が来ていない数は「—」。
            </p>
            {cohorts.length === 0 ? (
              <p className={styles.empty}>この{COHORT_DAYS}日にはじめて来た端末はありません</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">はじめて来た日</th>
                      <th scope="col">台数</th>
                      <th scope="col">次の日</th>
                      <th scope="col">7日以内</th>
                      <th scope="col">その後いつか</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohorts.map((k) => (
                      <tr key={k.firstDay}>
                        <th scope="row">{longDay(k.firstDay)}</th>
                        <td>{num(k.devices)}台</td>
                        <td>{back(k.backNext, k.devices)}</td>
                        <td>{back(k.backWeek, k.devices)}</td>
                        <td>{back(k.backAny, k.devices)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <div className={styles.card}>
          <p className={styles.empty}>
            {app.url
              ? "まだ数えていません。使われ方を数える版を公開すると、ここに出ます。"
              : "まだ公開先がありません。公開して NEXT_PUBLIC_SITE_URL を設定すると数えはじめます。"}
          </p>
          {app.accounts ? (
            <p className={styles.help}>
              ことのあめ のアカウントで記録を残している人：{num(a?.accounts ?? 0)}人（集計から外した人を除く）
            </p>
          ) : null}
        </div>
      )}
    </main>
  );
}
