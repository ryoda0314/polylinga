import assert from "node:assert/strict";
import { test } from "node:test";
import { alignPinyin, hanCount } from "../src/lib/reading-core.ts";

test("checked pinyin lands on the Han characters only", () => {
  const text = "这个App很好用。";
  const out = alignPinyin(text, "zhè ge hěn hǎo yòng");
  assert.deepEqual(out, ["zhè", "ge", "", "", "", "hěn", "hǎo", "yòng", ""]);
});

test("a syllable count that does not match is refused, so generated pinyin is used instead", () => {
  assert.equal(alignPinyin("我只喝了咖啡。", "wǒ zhǐ hē le kā"), null);
  assert.equal(alignPinyin("我只喝了咖啡。", "wǒ zhǐ hē le kā fēi ma"), null);
});

test("counts what needs a syllable", () => {
  assert.equal(hanCount("Wi-Fi密码换了。"), 4);
  assert.equal(hanCount("30%"), 0);
});
