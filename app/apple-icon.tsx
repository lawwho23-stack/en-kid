import { ImageResponse } from "next/og";

/** Generated apple-touch-icon (180x180 PNG) — no binary assets needed. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#8ED8F8",
          borderRadius: 40,
          fontSize: 110,
        }}
      >
        🐱
      </div>
    ),
    { ...size },
  );
}
