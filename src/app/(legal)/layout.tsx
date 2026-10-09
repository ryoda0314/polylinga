import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px 64px", display: "flex", flexDirection: "column", gap: 24 }}>
      <Link href="/" style={{ fontSize: 18, fontWeight: 600, textDecoration: "none" }}>
        PolyLinga
      </Link>
      <article style={{ lineHeight: 1.9 }}>{children}</article>
    </div>
  );
}
