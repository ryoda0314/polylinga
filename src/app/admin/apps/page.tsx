import Link from "next/link";
import { loadAppAccounts, loadAppCounts, loadAppDays } from "@/lib/admin-apps";
import { appRows, type AppDay } from "@/lib/admin-apps-core";
import { loadDays, loadLearners } from "@/lib/admin-usage";
import { labelEvery, longDay, num, shortDay, summarize, tokyoDay, type DayRow } from "@/lib/admin-usage-core";
import { ColumnChart, type Column } from "../_usage/charts";
import styles from "../usage.module.css";

export const metadata = { title: "姉妹アプリ" };

const SPAN = 14;

function columns(days: { day: string; value: number }[]): Column[] {
  return days.map((d) => ({ label: shortDay(d.day), title: longDay(d.day), values: [d.value] }));
}

export default async function AppsPage() {
  const [counts, accounts, learners, ameDays] = await Promise.all([
    loadAppCounts(),
    loadAppAccounts(),
    loadLearners(),
    loadDays(SPAN, false),
  ]);
  const rows = appRows(counts, accounts);
  const counted = rows.filter((r) => r.counts && r.app.id !== "kotonoame");
  const days = new Map<string, AppDay[]>(
    await Promise.all(counted.map(async (r) => [r.app.id, await loadAppDays(r.app.id, SPAN)] as const)),
  );
  const today = tokyoDay();
  const ame = summarize(
    learners.filter((l) => !l.excluded),
    today,
  );
  const every = labelEvery(SPAN);
  const ameColumns = (d: DayRow[]) => columns(d.map((x) => ({ day: x.day, value: x.active })));

  return (
    <main className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>姉妹アプリ</h1>
          <p className={styles.sub}>日付は日本時間・ことのあめ は人（アカウント）、ほかは端末の数（同じ端末は何度来ても1台）</p>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.people}`}>
            <thead>
              <tr>
                <th scope="col">アプリ</th>
                <th scope="col">今日</th>
                <th scope="col">この7日</th>
                <th scope="col">うちゲスト</th>
                <th scope="col">この30日</th>
                <th scope="col">これまで</th>
                <th scope="col">この7日にはじめて</th>
                <th scope="col">ホーム画面から（7日）</th>
                <th scope="col">アカウントで記録</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ app, counts: c, accounts: a }) => {
                const ameRow = app.id === "kotonoame";
                const unit = ameRow ? "人" : "台";
                const cell = (n: number | undefined) => (n === undefined ? "—" : `${num(n)}${unit}`);
                return (
                  <tr key={app.id}>
                    <td>
                      <span className={styles.person}>
                        <Link href={ameRow ? "/admin" : `/admin/apps/${app.id}`}>{app.name}</Link>
                        <span className={styles.email}>{app.what}</span>
                      </span>
                    </td>
                    {ameRow ? (
                      <>
                        <td>{cell(ame.activeToday)}</td>
                        <td>{cell(ame.activeWeek)}</td>
                        <td>—</td>
                        <td>{cell(ame.activeMonth)}</td>
                        <td>{cell(ame.learners)}</td>
                        <td>{cell(ame.joinedWeek)}</td>
                        <td>—</td>
                        <td>{num(ame.learners)}人</td>
                      </>
                    ) : c ? (
                      <>
                        <td>{cell(c.today)}</td>
                        <td>{cell(c.week)}</td>
                        <td>{cell(app.accounts ? c.week - c.signedWeek : c.week)}</td>
                        <td>{cell(c.month)}</td>
                        <td>{cell(c.devices)}</td>
                        <td>{cell(c.newWeek)}</td>
                        <td>{cell(c.fromHomeWeek)}</td>
                        <td>{app.accounts ? `${num(a?.accounts ?? 0)}人` : "—"}</td>
                      </>
                    ) : (
                      <>
                        <td colSpan={7} className={styles.waiting}>
                          {app.url ? "まだ数えていません（数える版を公開すると始まります）" : "公開先が決まると数えはじめます"}
                        </td>
                        <td>{app.accounts ? `${num(a?.accounts ?? 0)}人` : "—"}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className={styles.help}>
        「来た」は、そのアプリを開いた日があること。アプリの設定で「使われ方の数を送る」を切った端末と、公開先以外（手元の開発や試しの公開）で開いた分は数えません。自分の端末を数に入れたくないときは、その端末のアプリの設定で切ってください。
      </p>

      <section className={styles.section} aria-labelledby="by-app">
        <h2 id="by-app" className={styles.h2}>
          この{SPAN}日に来た数
        </h2>
        <div className={styles.cards} data-cols="2">
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              <Link href="/admin">ことのあめ</Link>（人）
            </h3>
            <ColumnChart series={[{ label: "来た人", tone: "strong" }]} columns={ameColumns(ameDays)} unit="人" every={every} height={110} />
          </div>
          {counted.map(({ app }) => (
            <div key={app.id} className={styles.card}>
              <h3 className={styles.cardTitle}>
                <Link href={`/admin/apps/${app.id}`}>{app.name}</Link>（端末）
              </h3>
              <ColumnChart
                series={[{ label: "来た端末", tone: "strong" }]}
                columns={columns((days.get(app.id) ?? []).map((d) => ({ day: d.day, value: d.devices })))}
                unit="台"
                every={every}
                height={110}
              />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
