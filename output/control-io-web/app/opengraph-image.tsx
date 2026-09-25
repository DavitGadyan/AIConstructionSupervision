export const dynamic = "force-static";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { tokens } from "@/lib/tokens";

export const alt = "control.io — independent drone supervision for multistorey construction";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The September drone orbit of the demo tower as a JPEG data URL (satori has no WebP decoder). */
async function backdrop() {
  const file = path.join(process.cwd(), "public/images/flights/m8/orbit-se.webp");
  const jpeg = await sharp(await readFile(file)).resize(size.width, size.height, { fit: "cover", position: "centre" }).jpeg({ quality: 82 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

export default async function OpengraphImage() {
  const c = tokens.color;
  const photo = await backdrop();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: c.ink }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="" width={size.width} height={size.height} style={{ position: "absolute", inset: 0, objectFit: "cover" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(20,26,30,0.25) 0%, rgba(20,26,30,0.35) 45%, rgba(20,26,30,0.88) 100%)",
          }}
        />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 700, color: "#fff" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 22, height: 22, borderRadius: 4, background: c.accent }} />
            </div>
            <div style={{ display: "flex" }}>
              control<span style={{ color: c.accent }}>.io</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: -8, lineHeight: 0.86, color: "#fff" }}>BUILT</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontSize: 150, fontWeight: 800, letterSpacing: -8, lineHeight: 0.86, color: "#fff" }}>
                <span>ON</span>
                <span>TIME?</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "rgba(255,255,255,0.82)" }}>
              <span>Drone flights · 3D reconstruction · Schedule comparison</span>
              <span style={{ color: "#7fd5e1" }}>Evidence-grade delay reports</span>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
