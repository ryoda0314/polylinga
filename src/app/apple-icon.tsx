import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS rounds the corners itself, so this one is a full square.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#16181D",
          position: "relative",
        }}
      >
        <div style={{ color: "#FFFFFF", fontSize: 120, fontWeight: 700, lineHeight: 1, marginTop: -8 }}>P</div>
        <div
          style={{ position: "absolute", left: 54, right: 54, bottom: 34, height: 10, borderRadius: 5, background: "#2F4BD6" }}
        />
      </div>
    ),
    size,
  );
}
