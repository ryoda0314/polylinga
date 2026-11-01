import Link from "next/link";
import { notFound } from "next/navigation";
import { loadLearner, loadLearnerDays } from "@/lib/admin-usage";
import {
  addDays,
  ago,
  dayLabel,
  isUuid,
  labelEvery,
  longDay,
  num,
  shortDay,
  tokyoDay,
  tokyoTime,
} from "@/lib/admin-usage-core";
import { getDict } from "@/lib/i18n";
import { ColumnChart } from "../../_usage/charts";
import { Tile } from "../../_usage/Tile";
import styles from "../../usage.module.css";
import { setExcluded } from "../actions";

export const metadata = { title: "利用者" };

const RECENT_DAYS = 30;
const PROVIDERS: Record<string, string> = { email: "メールとパスワード", google: "Google" };

// One learner's use of the app: counts only. What they wrote stays theirs and is not shown here.
export default async function LearnerPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [learner, days] = await Promise.all([loadLearner(id), loadLearnerDays(id)]);
  if (!learner) notFound();

  const today = tokyoDay();
  const langs = getDict("ja").common.langs;
  const when = (at: string) => `${dayLabel(tokyoDay(at), today)} ${tokyoTime(at).slice(-5)}`;
  const byDay = new Map(days.map((d) => [d.day, d]));
  const recent = Array.from({ length: RECENT_DAYS }, (_, i) => addDays(today, i - (RECENT_DAYS - 1)));

  return (
    <main className={styles.page}>
      <Link href="/admin/users" className={styles.back}>
        ← 利用者一覧
      </Link>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>{learner.name ?? "（名前なし）"}</h1>
          <p className={styles.sub}>{learner.email ?? ""}</p>
        </div>
        <form action={setExcluded.bind(null, learner.id, !learner.excluded)}>
          <button type="submit" className={styles.small}>
            {learner.excluded ? "集計に戻す" : "集計から外す"}
          </button>
        </form>
      </div>
      {learner.excluded ? (
        <p className={styles.notice}>この人は集計から外しています。利用状況の数には入りません（「含めて見る」では入ります）。</p>
      ) : (
        <p className={styles.help}>自分やテスト用のアカウントは「集計から外す」と、利用状況の数に入らなくなります。あとで戻せます。</p>
      )}

      <div className={styles.card}>
        <dl className={styles.facts}>
          <dt>始めた</dt>
          <dd>{when(learner.createdAt)}</dd>
          <dt>最後に来た</dt>
          <dd>{learner.lastActive ? `${dayLabel(learner.lastActive, today)}（${ago(learner.lastActive, today)}）` : "まだ"}</dd>
          <dt>最後のログイン</dt>
          <dd>{learner.lastSignInAt ? when(learner.lastSignInAt) : "—"}</dd>
          <dt>ログイン方法</dt>
          <dd>{PROVIDERS[learner.provider] ?? learner.provider}</dd>
          <dt>言語</dt>
          <dd>
            {langs[learner.native]} → {langs[learner.target]}
          </dd>
          <dt>チュートリアル</dt>
          <dd>{learner.tutorialSeen ? "見た（飛ばした場合も）" : "まだ"}</dd>
          <dt>雨のきっかけ</dt>
          <dd>{learner.rainCue ? "決めた" : "まだ"}</dd>
          <dt>みんなの雨に出す</dt>
          <dd>{learner.shareRain ? "オン" : "オフ"}</dd>
        </dl>
      </div>

      <div className={styles.tiles} data-count="8">
        <Tile label="来た日" value={learner.activeDays} unit="日" />
        <Tile
          label="雨を浴びた"
          value={learner.rains + learner.minnaRains}
          unit="回"
          note={learner.minnaRains > 0 ? `うちみんなの雨 ${num(learner.minnaRains)}回` : undefined}
        />
        <Tile label="出会ったかたち" value={learner.patterns} unit="個" />
        <Tile label="言ってみた" value={learner.sayings} unit="回" />
        <Tile label="添削" value={learner.corrections} unit="回" />
        <Tile label="詳しく解説" value={learner.explained} unit="回" />
        <Tile label="メモした単語" value={learner.words} unit="語" />
        <Tile label="みんなの雨に出た文" value={learner.shared} unit="文" />
      </div>

      <section className={styles.section} aria-labelledby="days">
        <h2 id="days" className={styles.h2}>
          日ごと
        </h2>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>この{RECENT_DAYS}日に雨を浴びた回数</h3>
          <ColumnChart
            series={[{ label: "雨", tone: "strong" }]}
            columns={recent.map((day) => {
              const d = byDay.get(day);
              return {
                label: shortDay(day),
                title: longDay(day),
                values: [(d?.rains ?? 0) + (d?.minnaRains ?? 0)],
                notes: d ? [`言ってみた ${num(d.sayings)}回`, `単語 ${num(d.words)}語`] : undefined,
              };
            })}
            unit="回"
            every={labelEvery(RECENT_DAYS)}
            height={120}
          />
        </div>
        <div className={styles.card}>
          {days.length === 0 ? (
            <p className={styles.empty}>まだ何もしていません</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">日付</th>
                    <th scope="col">雨</th>
                    <th scope="col">うちはじめてのかたち</th>
                    <th scope="col">みんなの雨</th>
                    <th scope="col">言ってみた</th>
                    <th scope="col">添削</th>
                    <th scope="col">単語</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d.day}>
                      <th scope="row">{longDay(d.day)}</th>
                      <td>{num(d.rains)}</td>
                      <td>{num(d.newPatterns)}</td>
                      <td>{num(d.minnaRains)}</td>
                      <td>{num(d.sayings)}</td>
                      <td>{num(d.corrections)}</td>
                      <td>{num(d.words)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
