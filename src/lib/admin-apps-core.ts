// 管理 › 姉妹アプリ (/admin/apps): which apps there are and how their counts are named. Pure, so tests can load it.
// The sisters count devices, not people (pl_app_ping, supabase/migrations/20261103000000_app_usage.sql; ことのね its
// own kn_ping): each sends open, learn and say, named here in the words of its own flow. ことのあめ itself counts
// learners by their account and has its own pages (/admin).

export type AppId =
  | "kotonoame"
  | "kotonone"
  | "kotonoha"
  | "kotonooto"
  | "kotonome"
  | "kotonoeda"
  | "kotonokage"
  | "kotonomi";

export type AppInfo = {
  id: AppId;
  name: string;
  /** What it is, in a few words. */
  what: string;
  /** Its public address; null while it has none (nothing is counted until it has one). */
  url: string | null;
  /** The names of its `learn` and `say` counts. */
  learn: string;
  say: string | null;
  /** Whether learners can keep their record in a ことのあめ account there. */
  accounts: boolean;
};

export const APPS: AppInfo[] = [
  {
    id: "kotonoame",
    name: "ことのあめ",
    what: "例文の雨（韓国語・英語・中国語）",
    url: "https://polylinga.vercel.app",
    learn: "雨を浴びた",
    say: "言ってみた",
    accounts: true,
  },
  {
    id: "kotonone",
    name: "ことのね",
    what: "韓国語の漢字語を、漢字の根でつなぐ",
    url: "https://hanja-xi.vercel.app",
    learn: "あつめた",
    say: "読めた",
    accounts: false,
  },
  {
    id: "kotonoha",
    name: "ことのは",
    what: "英会話の表現",
    url: "https://kotonoha-ashy.vercel.app",
    learn: "会話に出会った",
    say: "文を送った",
    accounts: true,
  },
  {
    id: "kotonooto",
    name: "ことのおと",
    what: "中国語の音を聞き分ける",
    url: "https://kotonoame-ch.vercel.app",
    learn: "雨を聞き終えた",
    say: "言ってみた",
    accounts: true,
  },
  {
    id: "kotonome",
    name: "ことのめ",
    what: "ハングルを読んで打つ",
    url: "https://kotonome-kappa.vercel.app",
    learn: "雨を浴び終えた",
    say: "打ってみた",
    accounts: true,
  },
  {
    id: "kotonoeda",
    name: "ことのえだ",
    what: "韓国語の敬語",
    url: "https://keigo-green.vercel.app",
    learn: "雨を終えた",
    say: "場面で言った",
    accounts: true,
  },
  {
    id: "kotonokage",
    name: "ことのかげ",
    what: "英会話のシャドーイング",
    url: null,
    learn: "会話を追いかけた",
    say: "自分で返した",
    accounts: true,
  },
  {
    id: "kotonomi",
    name: "ことのみ",
    what: "TOEIC・TOEFL の英単語を打って覚える",
    url: null,
    learn: "ひと回りを終えた",
    say: "思い出して打った",
    accounts: true,
  },
];

export function appInfo(id: string): AppInfo | null {
  return APPS.find((a) => a.id === id) ?? null;
}

/** An app's counts over the last days, as pl_admin_apps returns them. */
export type AppCounts = {
  devices: number;
  today: number;
  week: number;
  month: number;
  newWeek: number;
  fromHomeWeek: number;
  opensWeek: number;
  learnsWeek: number;
  saysWeek: number;
  firstDay: string | null;
  lastDay: string | null;
};

export type AppAccounts = { accounts: number; week: number; month: number };

export type AppDay = {
  day: string;
  devices: number;
  newDevices: number;
  fromHome: number;
  opens: number;
  learns: number;
  says: number;
};

/** Devices first seen on a day, and how many came back: the next day, within 7 days, on any later day. */
export type Cohort = { firstDay: string; devices: number; backNext: number | null; backWeek: number | null; backAny: number };

/** Every app's row for the list, the counted ones in the order of APPS and none left out. */
export function appRows(counts: Map<string, AppCounts>, accounts: Map<string, AppAccounts>) {
  return APPS.map((app) => ({ app, counts: counts.get(app.id) ?? null, accounts: accounts.get(app.id) ?? null }));
}
