import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { usernameOf } from "@/lib/username";

// Pages a new account reaches only once it has a name (/name asks for it first, then goes on).
const NAMED_ONLY = ["/app", "/start", "/tutorial", "/connect"];

// Refreshes the Supabase session cookie and sends signed-out visitors away from the app.
// An optimistic check only: every page and action verifies the user again.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Checks the token's signature locally (refreshing it first when it has expired), without asking Supabase Auth.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const path = request.nextUrl.pathname;
  const signedIn = Boolean(claims?.sub) && !claims?.is_anonymous;
  if (
    !signedIn &&
    (path.startsWith("/app") || path.startsWith("/start") || path.startsWith("/tutorial") || path.startsWith("/admin") || path === "/name")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // A page visit (not a server action from a page already open) by an account without a name yet. The token carries
  // the name, so this costs nothing once it is chosen; a token from before (the name chosen on another device) is renewed.
  if (signedIn && !usernameOf(claims?.user_metadata) && request.method === "GET" && NAMED_ONLY.some((p) => path.startsWith(p))) {
    const { data: fresh } = await supabase.auth.getUser();
    if (fresh.user && usernameOf(fresh.user.user_metadata)) {
      await supabase.auth.refreshSession();
    } else if (fresh.user) {
      const url = request.nextUrl.clone();
      url.pathname = "/name";
      url.search = `?${new URLSearchParams({ next: path + request.nextUrl.search })}`;
      // With the session cookies renewed above, if any: dropping them would leave a spent refresh token behind.
      const toName = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => toName.cookies.set(cookie));
      return toName;
    }
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/start", "/tutorial", "/admin/:path*", "/login/:path*", "/auth/:path*", "/connect", "/name"],
};
