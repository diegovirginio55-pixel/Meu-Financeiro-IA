import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Meu Financeiro IA — Painel financeiro pessoal com IA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logoBuffer = readFileSync(join(process.cwd(), "public", "logo.png"));
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #09090b 0%, #0b1220 50%, #052e2b 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 64 }}>
          <img
            src={logoSrc}
            width={300}
            height={300}
            style={{
              borderRadius: 64,
              boxShadow: "0 40px 100px rgba(16, 185, 129, 0.35)",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 76,
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: -1.5,
                lineHeight: 1.05,
              }}
            >
              Meu Financeiro IA
            </div>
            <div
              style={{
                marginTop: 20,
                fontSize: 34,
                color: "#a1a1aa",
                fontWeight: 500,
              }}
            >
              Painel financeiro pessoal com IA
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
