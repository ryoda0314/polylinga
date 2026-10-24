// The sister apps that sign in with ことのあめ's accounts (the same Supabase project), and where つなぐ (/connect) may
// send a learner back: each one's public address, or an address on the learner's own computer while one is being
// built. Nothing else is ever a destination, because what is sent there signs the learner in.
// ことのね keeps its record on the device only; it has no account to つなぐ yet.
// Pure: tested in tests/sisters.test.mjs.

export type SisterId = "kotonoha" | "kotonooto" | "kotonome" | "kotonoeda";

export const SISTERS: Record<SisterId, { name: string; url: string }> = {
  kotonoha: { name: "ことのは", url: "https://kotonoha-ashy.vercel.app" },
  kotonooto: { name: "ことのおと", url: "https://kotonoame-ch.vercel.app" },
  kotonome: { name: "ことのめ", url: "https://kotonome-kappa.vercel.app" },
  kotonoeda: { name: "ことのえだ", url: "https://keigo-green.vercel.app" },
};

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
  if (origin !== new URL(SISTERS[id].url).origin && !ON_THIS_COMPUTER.test(origin)) return null;
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
 * Back to the sister's login page with a one-time sign-in token and the sister's state. They ride in the fragment,
 * which the browser sends to no server and puts in no Referer; the sister reads it and clears it at once.
 */
export function returnUrl(dest: Destination, tokenHash: string, state: string): string {
  return `${dest.origin}/login#${new URLSearchParams({ kotonoame: tokenHash, state })}`;
}
