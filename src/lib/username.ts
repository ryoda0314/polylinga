// The account's name (ユーザー名), kept in the Supabase user's metadata as `username`, where the old PolyLinga app kept
// it too: the session token carries it, and the sister apps signing in with the same account can read it. Not unique,
// not a way to log in, and never shown to other learners (みんなの雨 stays nameless).
// Pure: tested in tests/username.test.mjs.

export const USERNAME_MAX = 20;

/** The name as typed, without control or invisible characters and outer spaces; null when empty or too long. */
export function cleanUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.normalize("NFC").replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "").trim();
  const length = Array.from(text).length;
  return length >= 1 && length <= USERNAME_MAX ? text : null;
}

/** The name in a user's metadata, or null before they have chosen one. */
export function usernameOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const name = (metadata as { username?: unknown }).username;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}
