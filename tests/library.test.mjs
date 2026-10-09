import assert from "node:assert/strict";
import { test } from "node:test";
import { validateLibrary } from "../scripts/lib/library.mjs";

const meaning = { ja: "誘う", en: "invite", ko: "권유", zh: "邀请" };
const patterns = [
  { id: "ja-naii", lang: "ja", form: "〜ない？", meaning },
  { id: "en-wanna", lang: "en", form: "Wanna + V?", meaning },
  { id: "ko-eullae", lang: "ko", form: "V + (으)ㄹ래?", meaning },
  { id: "zh-yaobuyao", lang: "zh", form: "要不要 + V？", meaning },
];
const sentence = (marks) => ({
  key: "invite-cafe",
  ja: "明日カフェ行かない？",
  en: "Wanna go to a café tomorrow?",
  ko: "내일 카페 갈래?",
  zh: "明天要不要去咖啡厅？",
  marks,
});
const goodMarks = {
  ja: ["ja-naii", "ない"],
  en: ["en-wanna", "Wanna"],
  ko: ["ko-eullae", "갈래"],
  zh: ["zh-yaobuyao", "要不要"],
};

test("a correct set passes and yields one mark per language", () => {
  const { problems, marks } = validateLibrary({ patterns, sentences: [sentence(goodMarks)] });
  assert.deepEqual(problems, []);
  assert.equal(marks.length, 4);
  assert.deepEqual(marks.find((m) => m.lang === "ko"), {
    key: "invite-cafe",
    lang: "ko",
    pattern_id: "ko-eullae",
    start_index: 6,
    end_index: 8,
  });
});

test("a mark that is not in the sentence is reported", () => {
  const { problems } = validateLibrary({ patterns, sentences: [sentence({ ...goodMarks, ko: ["ko-eullae", "먹을래"] })] });
  assert.match(problems.join("\n"), /"먹을래" not found/);
});

test("a pattern used for the wrong language is reported", () => {
  const { problems } = validateLibrary({ patterns, sentences: [sentence({ ...goodMarks, ko: ["zh-yaobuyao", "갈래"] })] });
  assert.match(problems.join("\n"), /is zh, used for ko/);
});

test("a mark covering the whole sentence is reported", () => {
  const { problems } = validateLibrary({
    patterns,
    sentences: [sentence({ ...goodMarks, ko: ["ko-eullae", "내일 카페 갈래?"] })],
  });
  assert.match(problems.join("\n"), /covers the whole sentence/);
});

test("a mark that occurs twice in the sentence is reported", () => {
  const { problems } = validateLibrary({
    patterns,
    sentences: [{ ...sentence({ ...goodMarks, ja: ["ja-naii", "たい"] }), key: "x", ja: "冷たいもの飲みたくない？たい" }],
  });
  assert.match(problems.join("\n"), /appears more than once/);
});
