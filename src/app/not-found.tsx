import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 20,
        maxWidth: 480,
        margin: "0 auto",
        padding: "48px 20px",
      }}
    >
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>このページは見つかりませんでした</h1>
      <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.8 }}>
        URL が変わったか、削除されたページです。
      </p>
      <Link href="/app" className="btn">
        アプリを開く
      </Link>
    </main>
  );
}
