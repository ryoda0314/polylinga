import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Ink square, white P, one stroke of the pen-blue accent: the app's palette in a tab-sized mark.
export default function Icon() {
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
          borderRadius: 112,
          position: "relative",
        }}
      >
        <div style={{ color: "#FFFFFF", fontSize: 340, fontWeight: 700, lineHeight: 1, marginTop: -20 }}>P</div>
        <div
          style={{
            position: "absolute",
            left: 150,
            right: 150,
            bottom: 92,
            height: 28,
            borderRadius: 14,
            background: "#2F4BD6",
          }}
        />
      </div>
    ),
    size,
  );
}
