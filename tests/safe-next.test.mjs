import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNext } from "../src/lib/safe-next.ts";

test("same-site paths pass through", () => {
  assert.equal(safeNext("/login/reset"), "/login/reset");
  assert.equal(safeNext("/app/s/123"), "/app/s/123");
});

test("anything that could leave the site falls back", () => {
  for (const value of [null, "", "https://evil.example", "//evil.example", "/\\evil.example", "app"]) {
    assert.equal(safeNext(value), "/app", String(value));
  }
});
