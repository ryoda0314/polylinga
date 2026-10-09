import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Rain } from "@/components/Rain";
import styles from "./page.module.css";

const NOTE_URL = "https://note.com/ryoda_/n/n4e69c14a99cb";

const STEPS = [
  { title: "浴びる", body: "同じかたちの文が、音声付きで次々に降ってきます。訳も付いているので、聞き流すだけでも大丈夫です。" },
  { title: "気づく", body: "降ってきた文を見比べて、共通しているところを自分で探します。答え合わせは、文と訳の同じところに色が付くだけ。" },
  { title: "言ってみる", body: "浴びたかたちで自分の文を作ると、AI が直して理由を説明します。そのまま友だちに送れます。" },
  { title: "また出会う", body: "知らない語は自分で打ってメモ。見返さなくていい。日をあけて、別の文の中でまた降ってきます。" },
];

// The demo is a real rain from the library: three invitations, with the matching parts lit in both languages.
const DEMO = [
  { ko: ["내일 카페 ", "갈래", "?"], ja: ["明日カフェ行か", "ない", "？"] },
  { ko: ["같이 밥 ", "먹을래", "?"], ja: ["一緒にご飯食べ", "ない", "？"] },
  { ko: ["오늘 밤 같이 게임", "할래", "?"], ja: ["今夜一緒にゲームし", "ない", "？"] },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.container + " " + styles.headerRow}>
          <Logo size="md" href="/" />
          <nav aria-label="ページ内" className={styles.nav}>
            <a href="#how">使い方</a>
            <a href="#languages">対応言語</a>
            <a href="#price">料金</a>
            <Link href="/login" className={styles.navStrong}>
              ログイン
            </Link>
            <Link href="/app" className={styles.navButton}>
              はじめる
            </Link>
          </nav>
        </div>
      </header>

      <section className={styles.heroWrap}>
        <Rain />
        <div className={styles.container + " " + styles.hero}>
          <div className={styles.heroText}>
            <h1>
              例文の雨を浴びて、
              <br />
              使える言葉へ。
            </h1>
            <p>
              同じかたちの短い文が、音声付きで雨のように降ってくる。浴びているうちに、共通しているところに自分で気づく。気づいたら自分でも言ってみて、AI に直してもらう。忘れても、また降ってくる。
            </p>
            <div className={styles.ctaRow}>
              <Link href="/app" className="btn">
                無料ではじめる
              </Link>
              <a href="#how" className="btn-quiet">
                使い方を見る
              </a>
            </div>
          </div>

          <div className={styles.demo} aria-label="浴びる画面の例">
            <span className={styles.demoLabel}>はじめてのかたち</span>
            <ol className={styles.demoList}>
              {DEMO.map((d) => (
                <li key={d.ko.join("")} className={styles.demoRow}>
                  <span className={styles.demoDrop} aria-hidden="true" />
                  <span className={styles.demoText}>
                    <span className="t-ko">
                      {d.ko[0]}
                      <span className="mark">{d.ko[1]}</span>
                      {d.ko[2]}
                    </span>
                    <span className={styles.demoGloss}>
                      {d.ja[0]}
                      <span className="mark">{d.ja[1]}</span>
                      {d.ja[2]}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <div className={styles.demoAnswer}>
              <span>共通していたところ</span>
              <strong>誘う</strong>
            </div>
            <div className={styles.demoBlock}>
              <span className={styles.demoLabel}>これで言ってみる</span>
              <div className={`${styles.demoYours} t-ko`}>
                주말에 영화 <del className="hl-del">보을래</del>?
              </div>
              <div className={`${styles.demoFixed} t-ko`}>
                주말에 영화 <ins className="hl-ins">볼래</ins>?
              </div>
              <span className={styles.demoWhy}>보다 は 볼래 になります。</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.band}>
        <div className={styles.container + " " + styles.split}>
          <h2>
            「分かる」と「できる」の
            <br />
            あいだを埋める。
          </h2>
          <div className={styles.prose}>
            <p>
              文法の一覧から始めるのではなく、似た文をいくつも浴びて、共通しているところに自分で気づく。使ってみて、直してもらって、忘れてもまた出会う。テストで分かることと、実際に使えることは別だからです。
            </p>
            <p>ことのあめ は、作者が韓国語を1年で「勉強する言葉」から「使う言葉」にしたときのやり方を、そのまま道具にしたものです。</p>
            <a href={NOTE_URL} target="_blank" rel="noopener noreferrer" className={styles.textLink}>
              その1年の記録を読む（note）
            </a>
          </div>
        </div>
      </section>

      <section id="how" className={styles.container + " " + styles.section}>
        <h2 className={styles.h2}>使い方は4つだけ</h2>
        <ol className={styles.steps}>
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="mono">{String(i + 1).padStart(2, "0")}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.rule}>
        <div className={styles.container + " " + styles.section + " " + styles.split}>
          <h2 className={styles.nameTitle}>
            <span className="wordmark-kana">言の葉</span>を、
            <br />
            <span className="wordmark-kana">雨</span>に。
          </h2>
          <div className={styles.prose}>
            <p>
              古今和歌集の仮名序は、歌を「人の心を種として、よろづの言の葉とぞなれりける」と書きました。言葉は、心から茂る葉だという見方です。
            </p>
            <p>
              このアプリでは、言葉を葉のように茂らせて覚えるのではなく、雨のように降らせて浴びます。たくさん浴びて、自分で気づいて、忘れたころにまた降ってくる。それで「ことのあめ（言の雨）」と名付けました。
            </p>
          </div>
        </div>
      </section>

      <section id="languages" className={styles.rule}>
        <div className={styles.container + " " + styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>韓国語・英語・中国語を、日本語から</h2>
            <p>
              例文はすべて日本語・英語・韓国語・中国語の4言語でそろえています。いまは日本語を話す人向けで、韓国語・英語・中国語を話す人向けも準備中です。中国語にはピンインが付きます。
            </p>
          </div>
          <div className={styles.langs}>
            <div>
              <span className="mono">JA 日本語</span>
              <span className="t-ja">今日カラオケ行かない？</span>
            </div>
            <div>
              <span className="mono">KO 한국어</span>
              <span className="t-ko">오늘 노래방 갈래?</span>
            </div>
            <div>
              <span className="mono">EN English</span>
              <span className="t-en">Wanna go to karaoke?</span>
            </div>
            <div>
              <span className="mono">ZH 中文</span>
              <span className="t-zh">要不要去唱歌？</span>
            </div>
          </div>
        </div>
      </section>

      <section id="price" className={styles.rule}>
        <div className={styles.container + " " + styles.section + " " + styles.split}>
          <h2 className={styles.h2}>料金</h2>
          <div>
            <div className={styles.priceRow + " " + styles.priceFirst}>
              <span>浴びる・音声・メモ</span>
              <span>無料</span>
            </div>
            <div className={styles.priceRow}>
              <span>AI 添削</span>
              <span>1日3回まで無料</span>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.rule} ${styles.finalWrap}`}>
        <Rain />
        <div className={styles.container + " " + styles.section + " " + styles.final}>
          <h2>今日も、少し浴びてみる。</h2>
          <Link href="/app" className="btn">
            無料ではじめる
          </Link>
        </div>
      </section>

      <footer className={styles.rule}>
        <div className={styles.container + " " + styles.footer}>
          <Logo size="sm" href="/" />
          <nav aria-label="フッター">
            <Link href="/terms">利用規約</Link>
            <Link href="/privacy">プライバシーポリシー</Link>
            <a href={NOTE_URL} target="_blank" rel="noopener noreferrer">
              作者のnote
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
