import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export const alt = "OorjaMan - Solar rooftop care";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg, #f6faf9 0%, #d8eee4 100%)",
          color: "#0f2938",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 16,
            background: "linear-gradient(135deg, #1f8660, #9fc93c)",
            marginBottom: 32,
          }}
        />
        <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: "-0.02em" }}>OorjaMan</div>
        <div style={{ fontSize: 32, marginTop: 16, color: "#516a7b" }}>
          Solar panel cleaning &amp; AMC - India
        </div>
      </div>
    ),
    { ...size },
  );
}
