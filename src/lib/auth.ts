import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

// Once per request, however many server components ask. The session token's signature is checked here against the
// project's published signing keys (cached for a while), so no round trip to Supabase Auth is needed for each page.
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  // Anonymous sign-ins are enabled on the shared project; they never count as a learner here.
  const user: SessionUser | null =
    claims?.sub && !claims.is_anonymous ? { id: claims.sub, email: claims.email ?? null } : null;
  return { supabase, user };
});

export async function requireUser() {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login");
  return { supabase, user };
}

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export async function requireAdmin() {
  const session = await requireUser();
  if (!isAdmin(session.user.email)) redirect("/app");
  return session;
}
