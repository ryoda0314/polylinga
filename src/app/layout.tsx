import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  IBM_Plex_Sans_JP,
  IBM_Plex_Sans_KR,
  Noto_Sans_SC,
  Shippori_Mincho,
} from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex" });
const plexJp = IBM_Plex_Sans_JP({ weight: ["400", "500", "600"], variable: "--font-plex-jp", preload: false });
const plexKr = IBM_Plex_Sans_KR({ weight: ["400", "500", "600"], variable: "--font-plex-kr", preload: false });
const notoSc = Noto_Sans_SC({ weight: ["400", "500"], variable: "--font-noto-sc", preload: false });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-plex-mono" });
// Only the wordmark ことのあめ uses it.
const shippori = Shippori_Mincho({ weight: ["700"], variable: "--font-shippori", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://polylinga.app"),
  title: { default: "ことのあめ", template: "%s | ことのあめ" },
  description:
    "例文の雨を浴びて、使える言葉へ。同じかたちの短い文が音声付きで降ってきて、共通しているところに自分で気づく。韓国語・英語・中国語を、日本語から。",
  applicationName: "ことのあめ",
};

export const viewport: Viewport = {
  themeColor: "#fcfbf8",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${plex.variable} ${plexJp.variable} ${plexKr.variable} ${notoSc.variable} ${plexMono.variable} ${shippori.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
