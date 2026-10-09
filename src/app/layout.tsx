import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_JP, IBM_Plex_Sans_KR, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex" });
const plexJp = IBM_Plex_Sans_JP({ weight: ["400", "500", "600"], variable: "--font-plex-jp", preload: false });
const plexKr = IBM_Plex_Sans_KR({ weight: ["400", "500", "600"], variable: "--font-plex-kr", preload: false });
const notoSc = Noto_Sans_SC({ weight: ["400", "500"], variable: "--font-noto-sc", preload: false });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://polylinga.app"),
  title: { default: "PolyLinga", template: "%s | PolyLinga" },
  description:
    "言いたいことから、使える言葉へ。日本語・英語・韓国語・中国語の例文と、共通する言い方のかたちが見つかります。",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${plex.variable} ${plexJp.variable} ${plexKr.variable} ${notoSc.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
