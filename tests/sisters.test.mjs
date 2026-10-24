import assert from "node:assert/strict";
import { test } from "node:test";
import { connectingTo, connectPath, destinationFor, returnUrl, validState } from "../src/lib/sisters.ts";

test("a sister's own public address, or this computer, is a destination", () => {
  assert.deepEqual(destinationFor("kotonoha", "https://kotonoha-ashy.vercel.app"), {
    id: "kotonoha",
    name: "ことのは",
    origin: "https://kotonoha-ashy.vercel.app",
  });
  assert.equal(destinationFor("kotonoha", "https://kotonoha-ashy.vercel.app/")?.origin, "https://kotonoha-ashy.vercel.app");
  assert.equal(destinationFor("kotonome", "http://localhost:3230")?.name, "ことのめ");
  assert.equal(destinationFor("kotonoeda", "http://127.0.0.1:3000")?.name, "ことのえだ");
});

test("anything else is not", () => {
  const no = [
    ["kotonoha", "https://evil.example"],
    ["kotonoha", "https://keigo-green.vercel.app"], // another sister's address under this sister's name
    ["kotonoha", "https://kotonoha-ashy.vercel.app.evil.example"],
    ["kotonoha", "https://kotonoha-ashy.vercel.app/login"], // a path rides along
    ["kotonoha", "https://user@kotonoha-ashy.vercel.app"],
    ["kotonoha", "http://kotonoha-ashy.vercel.app"],
    ["kotonoha", "http://localhost.evil.example"],
    ["kotonoha", "javascript:alert(1)"],
    ["kotonoha", "not a url"],
    ["polylinga", "https://polylinga.vercel.app"],
    ["toString", "http://localhost:3000"],
    ["kotonoha", null],
    [null, "https://kotonoha-ashy.vercel.app"],
  ];
  for (const [app, back] of no) assert.equal(destinationFor(app, back), null, `${app} ${back}`);
});

test("a state is a long random token", () => {
  assert.ok(validState("Ab3_-xY9Ab3_-xY9Ab3_"));
  for (const value of [null, "", "short", "has space in it here", "x".repeat(129), "abc<script>abcdefgh"]) {
    assert.equal(validState(value), false, String(value));
  }
});

test("a /connect path names its sister; other paths do not", () => {
  const path = connectPath("kotonooto", "https://kotonoame-ch.vercel.app", "Ab3_-xY9Ab3_-xY9Ab3_");
  assert.equal(path, "/connect?app=kotonooto&back=https%3A%2F%2Fkotonoame-ch.vercel.app&state=Ab3_-xY9Ab3_-xY9Ab3_");
  assert.equal(connectingTo(path), "ことのおと");
  assert.equal(connectingTo("/connect?app=kotonooto&back=https%3A%2F%2Fevil.example&state=x"), null);
  assert.equal(connectingTo("/app"), null);
  assert.equal(connectingTo(null), null);
});

test("the token and the state go back in the fragment", () => {
  const dest = destinationFor("kotonoha", "https://kotonoha-ashy.vercel.app");
  assert.equal(returnUrl(dest, "abc123", "Ab3_-xY9Ab3_-xY9Ab3_"), "https://kotonoha-ashy.vercel.app/login#kotonoame=abc123&state=Ab3_-xY9Ab3_-xY9Ab3_");
});
