import assert from "node:assert/strict";
import { test } from "node:test";
import { formatExport } from "../src/lib/export.ts";
import { ja } from "../src/lib/i18n/ja.ts";

const base = {
  targetName: "韓国語",
  nativeName: "日本語",
  cue: "電車に乗ったら",
  today: "2026-10-19",
  totals: { rains: 12, patterns: 3, said: 2, words: 2 },
  said: [
    {
      day: "2026-10-19",
      intent: "コーヒー飲みたい",
      input: "커피 마시다 싶어요",
      corrected: "커피 마시고 싶어요",
      natural: false,
      explanation: "「다」ではなく「고」でつなぐ。\n語幹のあとに付けます。",
      meaning: "コーヒー飲みたい。",
      patterns: ["-고 싶어요（〜したい）"],
    },
    { day: "2026-10-18", intent: null, input: "좀 피곤해.", corrected: "좀 피곤해.", natural: true, explanation: "", meaning: "ちょっと疲れた。", patterns: [] },
  ],
  saidAll: 2,
  patterns: [
    { form: "-(으)ㄹ래?", label: "誘う", times: 2, used: false, lastDay: "2026-10-17" },
    { form: "-고 싶어요", label: "〜したい", times: 5, used: true, lastDay: "2026-10-19" },
  ],
  words: [{ text: "주말", note: "週末 | 土日", stage: "seen", encounters: 3, uses: 0, since: "2026-10-15" }],
  days: [
    { day: "2026-10-19", rains: 4, said: 1, words: 0 },
    { day: "2026-10-15", rains: 2, said: 0, words: 1 },
  ],
};

test("the record opens with the request and how the app works, then the summary", () => {
  const md = formatExport(base, ja.exportDoc);
  assert.ok(md.startsWith("# ことのあめ 学習の記録\n\n以下は、語学学習アプリ「ことのあめ」での私の韓国語の学習記録です。"));
  assert.match(md, /記録の期間: 2026-10-15 〜 2026-10-19（記録のある日 2日）/);
  assert.match(md, /言ってみた文 2（うち直しなし 1）/);
  assert.match(md, /浴びるきっかけ: 電車に乗ったら/);
});

test("a corrected sentence shows what was written, what it became and why; one that needed nothing, once", () => {
  const md = formatExport(base, ja.exportDoc);
  assert.match(md, /1\. 2026-10-19\n {3}- 言いたかったこと: コーヒー飲みたい\n {3}- 書いた文: 커피 마시다 싶어요\n {3}- 直した文: 커피 마시고 싶어요/);
  assert.match(md, /- 直したところ: 「다」ではなく「고」でつなぐ。 語幹のあとに付けます。/);
  assert.match(md, /- 書いた文: 좀 피곤해\.（直しなし）/);
  assert.doesNotMatch(md, /- 直した文: 좀 피곤해/);
});

test("tables are sorted, and a bar in the learner's own words does not break a cell", () => {
  const md = formatExport(base, ja.exportDoc);
  const rows = md.split("\n").filter((l) => l.startsWith("| -"));
  assert.deepEqual(rows, ["| -고 싶어요 | 〜したい | 5 | 使った | 2026-10-19 |", "| -(으)ㄹ래? | 誘う | 2 | まだ | 2026-10-17 |"]);
  assert.match(md, /\| 주말 \| 週末 ｜ 土日 \| 前に見た \| 3 \| 0 \| 2026-10-15 \|/);
});

test("an empty record still reads, section by section", () => {
  const md = formatExport({ ...base, cue: null, totals: { rains: 0, patterns: 0, said: 0, words: 0 }, said: [], saidAll: 0, patterns: [], words: [], days: [] }, ja.exportDoc);
  assert.equal(md.match(/まだありません。/g)?.length, 4);
  assert.doesNotMatch(md, /記録の期間/);
  assert.doesNotMatch(md, /浴びるきっかけ/);
});
