import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Divinol — SIA Elama";

async function file(path: string) {
  try {
    return await readFile(join(/*turbopackIgnore: true*/ process.cwd(), path));
  } catch {
    return null;
  }
}

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = hasLocale(routing.locales, l) ? l : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "meta" });
  const [font, fontBold, logo] = await Promise.all([
    file("node_modules/@expo-google-fonts/manrope/600SemiBold/Manrope_600SemiBold.ttf"),
    file("node_modules/@expo-google-fonts/manrope/800ExtraBold/Manrope_800ExtraBold.ttf"),
    file("public/media/brand/elama-logo.png"),
  ]);
  const fonts = [
    ...(font ? [{ name: "Manrope", data: font, weight: 600 as const, style: "normal" as const }] : []),
    ...(fontBold ? [{ name: "Manrope", data: fontBold, weight: 800 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "linear-gradient(135deg, #1e2d51 0%, #111a31 100%)",
          fontFamily: fonts.length ? "Manrope" : undefined,
          color: "white",
          overflow: "hidden",
        }}
      >
        {/* grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* skewed yellow bars */}
        <div style={{ position: "absolute", right: 150, top: -40, width: 90, height: 720, background: "#ffc10e", transform: "skewX(-20deg)", display: "flex" }} />
        <div style={{ position: "absolute", right: 40, top: -40, width: 40, height: 720, background: "rgba(255,193,14,0.35)", transform: "skewX(-20deg)", display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "70px 80px", width: 880, height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {logo ? (
              <img src={`data:image/png;base64,${logo.toString("base64")}`} width={330} height={62} alt="" />
            ) : (
              <div style={{ fontSize: 44, fontWeight: 800, display: "flex" }}>ELAMA</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                background: "#ffc10e",
                color: "#111a31",
                fontSize: 22,
                fontWeight: 800,
                padding: "8px 18px",
                borderRadius: 8,
                transform: "skewX(-12deg)",
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              Divinol · Made in Germany
            </div>
            <div style={{ display: "flex", fontSize: 74, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2, marginTop: 28 }}>{t("ogTitle")}</div>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "rgba(255,255,255,0.72)", marginTop: 22, lineHeight: 1.35 }}>
              {t("ogSubtitle")}
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>divinol.lv · divinol.ee</div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
