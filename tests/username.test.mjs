import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanUsername, USERNAME_MAX, usernameOf } from "../src/lib/username.ts";

test("a name is kept as typed, in any script, without outer spaces", () => {
  assert.equal(cleanUsername("  あめ  "), "あめ");
  assert.equal(cleanUsername("山田　花子"), "山田　花子");
  assert.equal(cleanUsername("민지"), "민지");
  assert.equal(cleanUsername("Rio K."), "Rio K.");
});

test("control and invisible characters are dropped", () => {
  assert.equal(cleanUsername("あ​め\n"), "あめ");
  assert.equal(cleanUsername("‮あめ﻿"), "あめ");
  assert.equal(cleanUsername("​ ​"), null);
});

test("empty, too long or not text is no name", () => {
  assert.equal(cleanUsername(""), null);
  assert.equal(cleanUsername("   "), null);
  assert.equal(cleanUsername(null), null);
  assert.equal(cleanUsername(42), null);
  assert.equal(cleanUsername("あ".repeat(USERNAME_MAX)), "あ".repeat(USERNAME_MAX));
  assert.equal(cleanUsername("あ".repeat(USERNAME_MAX + 1)), null);
  // Counted by character, so a name of emoji is not cut short by their surrogate pairs.
  assert.equal(cleanUsername("🌧".repeat(USERNAME_MAX)), "🌧".repeat(USERNAME_MAX));
});

test("the name is read from a user's metadata", () => {
  assert.equal(usernameOf({ username: "あめ", full_name: "Ame" }), "あめ");
  assert.equal(usernameOf({ username: "  " }), null);
  assert.equal(usernameOf({ full_name: "Ame" }), null);
  assert.equal(usernameOf({ username: 3 }), null);
  assert.equal(usernameOf(undefined), null);
});
