import assert from "node:assert/strict";
import { test } from "node:test";
import { connectingTo, connectLang, connectPath, destinationFor, returnUrl, sisterLang, validState } from "../src/lib/sisters.ts";

test("a sister's own public address, or this computer, is a destination", () => {
  assert.deepEqual(destinationFor("kotonoha", "https://kotonoha-ashy.vercel.app"), {
    id: "kotonoha",
    name: "ことのは",
    origin: "https://kotonoha-ashy.vercel.app",
  });
  assert.equal(destinationFor("kotonoha", "https://kotonoha-ashy.vercel.app/")?.origin, "https://kotonoha-ashy.vercel.app");
  assert.equal(destinationFor("kotonome", "http://localhost:3230")?.name, "ことのめ");
  assert.equal(destinationFor("kotonoeda", "http://127.0.0.1:3000")?.name, "ことのえだ");
  assert.equal(destinationFor("kotonomi", "http://localhost:3250")?.name, "ことのみ", "not published yet: this computer only");
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
    ["kotonomi", "https://kotonomi.vercel.app"], // no address of its own yet
    ["kotonomi", "null"],
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

test("ことのたね and ことのはし (for Korean speakers) are sisters too: this computer only, until they are published", () => {
  assert.equal(destinationFor("kotonotane", "http://localhost:5191")?.name, "ことのたね");
  assert.equal(destinationFor("kotonohashi", "http://127.0.0.1:5192")?.name, "ことのはし");
  assert.equal(destinationFor("kotonotane", "https://kotonotane.vercel.app"), null);
  assert.equal(destinationFor("kotonohashi", "https://evil.example"), null);
});

test("the pages and mails on the way to a sister for Korean speakers are in Korean", () => {
  const state = "Ab3_-xY9Ab3_-xY9Ab3_";
  const tane = connectPath("kotonotane", "http://localhost:5191", state);
  assert.equal(sisterLang("kotonotane"), "ko");
  assert.equal(sisterLang("kotonohashi"), "ko");
  assert.equal(sisterLang("kotonoha"), "ja");
  assert.equal(sisterLang("toString"), "ja");
  assert.equal(sisterLang(null), "ja");
  assert.equal(connectLang(tane), "ko");
  assert.equal(connectLang(connectPath("kotonohashi", "http://localhost:5192", state)), "ko");
  assert.equal(connectLang(`/login/reset?${new URLSearchParams({ next: tane })}`), "ko", "a page carrying the つなぐ on");
  assert.equal(connectLang(connectPath("kotonoha", "https://kotonoha-ashy.vercel.app", state)), "ja");
  assert.equal(connectLang(connectPath("kotonotane", "https://evil.example", state)), "ja", "not a destination");
  assert.equal(connectLang("/app"), "ja");
  assert.equal(connectLang("https://evil.example/connect?app=kotonotane"), "ja");
  assert.equal(connectLang(undefined), "ja");
});
