"use server";

import { getSession } from "@/lib/auth";
import { destinationFor, returnUrl, validState } from "@/lib/sisters";
import { createAdminClient } from "@/lib/supabase/server";

export type ConnectResult = { ok: true; url: string } | { ok: false; reason: "invalid" | "signedOut" | "failed" };

/**
 * つなぐ: a one-time sign-in token for the learner signed in here, sent back to the sister that asked (src/lib/sisters.ts).
 * The link is only made, never mailed; the sister spends it at once (verifyOtp) and it cannot be used twice.
 */
export async function connect(app: string, back: string, state: string): Promise<ConnectResult> {
  const dest = destinationFor(app, back);
  if (!dest || !validState(state)) return { ok: false, reason: "invalid" };
  const { user } = await getSession();
  if (!user?.email) return { ok: false, reason: "signedOut" };
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "magiclink", email: user.email });
  const token = data?.properties?.hashed_token;
  if (error || !token) {
    console.error("[connect]", error?.code, error?.message);
    return { ok: false, reason: "failed" };
  }
  return { ok: true, url: returnUrl(dest, token, state) };
}
