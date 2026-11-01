// The sister apps that sign in with ことのあめ's accounts (the same Supabase project), and where つなぐ (/connect) may
// send a learner back: each one's public address, or an address on the learner's own computer while one is being
// built. Nothing else is ever a destination, because what is sent there signs the learner in. A sister not published
// yet has no address (null): only the learner's own computer, until its address is written here.
// ことのね keeps its record on the device only; it has no account to つなぐ yet.
// ことのたね and ことのはし are for Korean speakers: the pages and mails on the way to them are in Korean (`lang`,
// src/lib/i18n/sign-in.ts).
// Pure: tested in tests/sisters.test.mjs.

export type SisterId = "kotonoha" | "kotonooto" | "kotonome" | "kotonoeda" | "kotonomi" | "kotonotane" | "kotonohashi";

/** The language of a sister's learners: the pages and mails of its つなぐ are in it. */
export type SisterLang = "ja" | "ko";

export const SISTERS: Record<SisterId, { name: string; url: string | null; lang?: SisterLang }> = {
  kotonoha: { name: "ことのは", url: "https://kotonoha-ashy.vercel.app" },
  kotonooto: { name: "ことのおと", url: "https://kotonoame-ch.vercel.app" },
  kotonome: { name: "ことのめ", url: "https://kotonome-kappa.vercel.app" },
  kotonoeda: { name: "ことのえだ", url: "https://keigo-green.vercel.app" },
  kotonomi: { name: "ことのみ", url: null },
  kotonotane: { name: "ことのたね", url: null, lang: "ko" },
  kotonohashi: { name: "ことのはし", url: null, lang: "ko" },
};

/** The language of a sister (its `app` name at /connect): Japanese unless it says otherwise. */
export function sisterLang(app: string | null | undefined): SisterLang {
  return app && Object.prototype.hasOwnProperty.call(SISTERS, app) ? (SISTERS[app as SisterId].lang ?? "ja") : "ja";
}

export type Destination = { id: SisterId; name: string; origin: string };

// A sister run on the learner's own computer: only that computer can receive what is sent there.
const ON_THIS_COMPUTER = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

/** The sister `app` names and the origin to send its learner back to, when both are allowed; otherwise null. */
export function destinationFor(app: string | null | undefined, back: string | null | undefined): Destination | null {
  if (!app || !back || !Object.prototype.hasOwnProperty.call(SISTERS, app)) return null;
  const id = app as SisterId;
  let origin: string;
  try {
    origin = new URL(back).origin;
  } catch {
    return null;
  }
  // An origin and nothing more: no path, query or credentials riding along.
  if (origin !== back.replace(/\/$/, "")) return null;
  const home = SISTERS[id].url;
  if ((!home || origin !== new URL(home).origin) && !ON_THIS_COMPUTER.test(origin)) return null;
  return { id, name: SISTERS[id].name, origin };
}

/** The random value the sister made for this つなぐ; it checks the same value on return. */
export function validState(state: string | null | undefined): state is string {
  return typeof state === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(state);
}

/** /connect for these, to come back to after logging in or confirming a new account. */
export function connectPath(app: string, back: string, state: string): string {
  return `/connect?${new URLSearchParams({ app, back, state })}`;
}

/** The sister's name when `next` (a path in this site) is a /connect for it; otherwise null. */
export function connectingTo(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/connect?")) return null;
  const params = new URL(next, "http://x").searchParams;
  return destinationFor(params.get("app"), params.get("back"))?.name ?? null;
}

/**
 * The language of the pages and mails on the way somewhere (`next`, a path in this site): the sister's when it is a
 * /connect for one, or a page carrying such a /connect on (`/login/reset?next=/connect?…`); otherwise Japanese.
 */
export function connectLang(next: string | null | undefined): SisterLang {
  if (!next || !next.startsWith("/")) return "ja";
  const url = new URL(next, "http://x");
  if (url.pathname !== "/connect") return connectLang(url.searchParams.get("next"));
  const dest = destinationFor(url.searchParams.get("app"), url.searchParams.get("back"));
  return dest ? sisterLang(dest.id) : "ja";
}

/**
 * Back to the sister's login page with a one-time sign-in token and the sister's state. They ride in the fragment,
 * which the browser sends to no server and puts in no Referer; the sister reads it and clears it at once.
 */
export function returnUrl(dest: Destination, tokenHash: string, state: string): string {
  return `${dest.origin}/login#${new URLSearchParams({ kotonoame: tokenHash, state })}`;
}
