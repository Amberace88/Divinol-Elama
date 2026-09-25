import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import seed from "./src/data/products.seed.json";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

type SeedProduct = { slug: string; category: string; legacy_slugs: string[] };

// 301 redirects from the old WooCommerce URLs (divinol.lv) so existing Google rankings are kept.
const legacyCategory: Record<string, string> = {
  "vieglo-automasinu-ellas": "motorellas-vieglajiem",
  "kravas-automasinu-traktortehnikas-ellas": "kravas-un-lauksaimniecibas-tehnikai",
  "motociklu-kvadraciklu-motorella": "moto-un-darza-tehnikai",
  "divtaktu-cetrtaktu-dzineju-ellas": "moto-un-darza-tehnikai",
  "monograde-ellas": "kravas-un-lauksaimniecibas-tehnikai",
  "transmisijas-ellas": "transmisijas-ellas",
  "hidrauliskas-ellas": "hidrauliskas-ellas",
  "industrialas-ellas": "industrialas-ellas",
  "kompresoru-ella": "industrialas-ellas",
  aerosoli: "auto-kimija-un-aerosoli",
  "tirisanas-lidzekli": "auto-kimija-un-aerosoli",
  "vejstiklu-skidrumi": "sezonas-produkti",
  "viaform-bio-ledus-atkausetajs": "sezonas-produkti",
  "betona-asfalta-atdalisanas-lidzekli": "buvniecibai",
  "citi-produkti-citi-produkti": "auto-kimija-un-aerosoli",
};

async function legacyRedirects() {
  const out: { source: string; destination: string; permanent: boolean }[] = [];
  for (const p of seed as SeedProduct[]) {
    for (const old of p.legacy_slugs) {
      out.push({ source: `/product/${old}`, destination: `/produkts/${p.slug}`, permanent: true });
    }
  }
  const parents: Record<string, string> = { ellas: "", smervielas: "smervielas", kopsanai: "", kimija: "buvniecibai", "citi-produkti": "auto-kimija-un-aerosoli" };
  for (const [parent, target] of Object.entries(parents)) {
    out.push({ source: `/product-category/${parent}`, destination: target ? `/katalogs/${target}` : "/katalogs", permanent: true });
  }
  for (const [old, target] of Object.entries(legacyCategory)) {
    out.push({ source: `/product-category/:parent/${old}`, destination: `/katalogs/${target}`, permanent: true });
    out.push({ source: `/product-category/${old}`, destination: `/katalogs/${target}`, permanent: true });
  }
  out.push(
    { source: "/e-veikals", destination: "/katalogs", permanent: true },
    { source: "/politika-un-noteikumi", destination: "/privatuma-politika", permanent: true },
    { source: "/product-tag/:tag", destination: "/katalogs", permanent: true },
    { source: "/cart", destination: "/grozs", permanent: true },
    { source: "/my-account/:path*", destination: "/account", permanent: true },
  );
  return out;
}

const nextConfig: NextConfig = {
  trailingSlash: false,
  // Files read from disk at runtime by the invoice PDF route
  outputFileTracingIncludes: {
    "/api/invoices/\\[id\\]/pdf": [
      "./node_modules/@expo-google-fonts/manrope/**/*.ttf",
      "./public/media/brand/elama-logo.png",
    ],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  async redirects() {
    return legacyRedirects();
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/media/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
