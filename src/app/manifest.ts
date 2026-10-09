import type { MetadataRoute } from "next";

// Replaces the old app's manifest, so a home-screen install opens the new app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PolyLinga",
    short_name: "PolyLinga",
    description: "言いたいことから、使える言葉へ。",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "ja",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
