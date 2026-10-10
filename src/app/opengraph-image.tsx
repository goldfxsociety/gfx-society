import { ImageResponse } from "next/og";

export const alt = "GFX Society — free gold trading education for Filipino traders";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "center", padding: 80, background: "#0b0b0b", color: "#fff",
        }}
      >
        <div style={{ fontSize: 40, color: "#d4af37", fontWeight: 700 }}>GFX Society</div>
        <div style={{ fontSize: 72, fontWeight: 700, marginTop: 20 }}>Learn gold trading the safe way.</div>
        <div style={{ fontSize: 32, marginTop: 24, color: "#bbb" }}>
          Free Academy · Demo first · 1% risk · Education only
        </div>
      </div>
    ),
    size,
  );
}
