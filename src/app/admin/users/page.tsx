import Form from "next/form";
import Link from "next/link";
import { loadLearners } from "@/lib/admin-usage";
import { ago, dayLabel, num, tokyoDay, type Learner } from "@/lib/admin-usage-core";
import { getDict } from "@/lib/i18n";
import { isLang, LANGS } from "@/lib/langs";
import styles from "../usage.module.css";

export const metadata = { title: "利用者" };

const SORTS = {
  last: "最後に来た日が新しい順",
  joined: "始めた日が新しい順",
  rains: "雨が多い順",
  days: "来た日が多い順",
  said: "言ってみたが多い順",
} as const;
type Sort = keyof typeof SORTS;

function isSort(value: unknown): value is Sort {
  return typeof value === "string" && Object.hasOwn(SORTS, value);
}

/** Newer first, never-active last. */
function newer(a: string | null, b: string | null) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? 1 : -1;
}

const ORDER: Record<Sort, (a: Learner, b: Learner) => number> = {
  last: (a, b) => newer(a.lastActive, b.lastActive) || newer(a.createdAt, b.createdAt),
  joined: (a, b) => newer(a.createdAt, b.createdAt),
  rains: (a, b) => b.rains + b.minnaRains - (a.rains + a.minnaRains) || newer(a.lastActive, b.lastActive),
  days: (a, b) => b.activeDays - a.activeDays || newer(a.lastActive, b.lastActive),
  said: (a, b) => b.sayings - a.sayings || newer(a.lastActive, b.lastActive),
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LearnersPage({ searchParams }: PageProps<"/admin/users">) {
  const params = await searchParams;
  const q = (first(params.q) ?? "").trim();
  const lang = first(params.lang);
  const target = isLang(lang) ? lang : null;
  const sortParam = first(params.sort);
  const sort: Sort = isSort(sortParam) ? sortParam : "last";

  const everyone = await loadLearners();
  const today = tokyoDay();
  const langs = getDict("ja").common.langs;
  const needle = q.toLowerCase();
  const shown = everyone
    .filter((l) => !target || l.target === target)
    .filter((l) => !needle || [l.name, l.email].some((s) => s?.toLowerCase().includes(needle)))
    .sort(ORDER[sort]);
  const excluded = everyone.filter((l) => l.excluded).length;

  return (
    <main className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>利用者</h1>
          <p className={styles.sub}>
            {shown.length === everyone.length ? `${num(everyone.length)}人` : `${num(shown.length)}人 / 全${num(everyone.length)}人`}
            {excluded > 0 ? `・うち集計から外した人 ${num(excluded)}人` : ""}
          </p>
        </div>
      </div>

      <Form action="/admin/users" className={styles.filters}>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="名前・メールで探す"
          aria-label="名前・メールで探す"
          className={styles.input}
        />
        <select name="lang" defaultValue={target ?? ""} aria-label="学んでいる言語" className={styles.select}>
          <option value="">すべての言語</option>
          {LANGS.filter((l) => l !== "ja").map((l) => (
            <option key={l} value={l}>
              {langs[l]}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} aria-label="並べ方" className={styles.select}>
          {Object.entries(SORTS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className={styles.small}>
          表示
        </button>
      </Form>

      <div className={styles.card}>
        {shown.length === 0 ? (
          <p className={styles.empty}>当てはまる人はいません</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.people}`}>
              <thead>
                <tr>
                  <th scope="col">名前</th>
                  <th scope="col">始めた</th>
                  <th scope="col">最後に来た</th>
                  <th scope="col">言語</th>
                  <th scope="col">来た日</th>
                  <th scope="col">雨</th>
                  <th scope="col">かたち</th>
                  <th scope="col">言ってみた</th>
                  <th scope="col">単語</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.id} data-excluded={l.excluded ? "" : undefined}>
                    <td>
                      <span className={styles.person}>
                        <span>
                          <Link href={`/admin/users/${l.id}`}>{l.name ?? "（名前なし）"}</Link>
                          {l.excluded ? (
                            <span className={styles.badge} data-kind="excluded">
                              集計外
                            </span>
                          ) : null}
                        </span>
                        <span className={styles.email}>{l.email ?? ""}</span>
                      </span>
                    </td>
                    <td>{dayLabel(tokyoDay(l.createdAt), today)}</td>
                    <td>{l.lastActive ? ago(l.lastActive, today) : "—"}</td>
                    <td>{langs[l.target]}</td>
                    <td>{num(l.activeDays)}</td>
                    <td>{num(l.rains + l.minnaRains)}</td>
                    <td>{num(l.patterns)}</td>
                    <td>{num(l.sayings)}</td>
                    <td>{num(l.words)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
