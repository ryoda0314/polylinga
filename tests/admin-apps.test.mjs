import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { APPS, appInfo, appRows } from "../src/lib/admin-apps-core.ts";

const sql = readFileSync(new URL("../supabase/migrations/20261103000000_app_usage.sql", import.meta.url), "utf8");

test("every app is listed once", () => {
  const ids = APPS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(appInfo("kotonoha")?.name, "ことのは");
  assert.equal(appInfo("nope"), null);
});

test("the sisters the database counts are the ones listed here (ことのあめ and ことのね count their own way)", () => {
  const allowed = [...sql.match(/app in \(([^)]*)\)/)[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
  const listed = APPS.map((a) => a.id)
    .filter((id) => id !== "kotonoame" && id !== "kotonone")
    .sort();
  assert.deepEqual(allowed, listed);
  // The ping takes the same names as the table.
  const pinged = [...sql.match(/p_app not in \(([^)]*)\)/)[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(pinged, listed);
});

test("an app that has not counted anything still gets its row", () => {
  const counts = new Map([["kotonone", { devices: 3 }]]);
  const rows = appRows(counts, new Map());
  assert.equal(rows.length, APPS.length);
  assert.equal(rows.find((r) => r.app.id === "kotonone").counts.devices, 3);
  assert.equal(rows.find((r) => r.app.id === "kotonoha").counts, null);
});
