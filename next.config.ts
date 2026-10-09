import type { NextConfig } from "next";

// Old poly-lang URLs that have a clear counterpart. Anything else under /app/* falls through to
// src/app/app/[...rest]/page.tsx, which sends people to /app.
const OLD_ROUTES: [string, string][] = [
  ["/app/dashboard", "/app"],
  ["/app/corrections", "/app"],
  ["/app/awareness", "/app/memo"],
  ["/app/my-phrases", "/app/memo"],
  ["/app/settings", "/app/me"],
  ["/app/account", "/app/me"],
  ["/register", "/login"],
  ["/register-flow", "/login"],
  ["/login-flow", "/login"],
  ["/onboarding", "/start"],
  ["/install", "/"],
  ["/tour", "/"],
  ["/experience", "/"],
];

const nextConfig: NextConfig = {
  async redirects() {
    return OLD_ROUTES.map(([source, destination]) => ({ source, destination, permanent: false }));
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // The kill-switch worker must never be served from a cache.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
