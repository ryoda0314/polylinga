import type { MetadataRoute } from "next";

// Replaces the old app's manifest, so a home-screen install opens the new app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ことのあめ",
    short_name: "ことのあめ",
    description: "例文の雨を浴びて、使える言葉へ。",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#fcfbf8",
    theme_color: "#fcfbf8",
    lang: "ja",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
