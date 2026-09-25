import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { getProducts, summarize } from "@/lib/catalog";
import type { SearchDoc } from "@/lib/shop/search";

/** Lightweight product index for the instant header search (client-side matching). */
export async function GET(req: NextRequest) {
  const requested = req.nextUrl.searchParams.get("locale") ?? routing.defaultLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  let docs: SearchDoc[] = [];
  try {
    const products = await getProducts();
    docs = products.map((p) => {
      const s = summarize(p, locale);
      const prices = s.variants.map((v) => v.price_net).filter((n) => n > 0);
      return {
        slug: s.slug,
        name: s.name,
        type: s.type,
        category: s.category,
        sae: s.sae,
        iso_vg: s.iso_vg,
        specs: s.specs,
        approvals: s.approvals,
        skus: [p.base_sku, ...s.variants.map((v) => v.sku)].filter((x): x is string => Boolean(x)),
        image: s.image,
        price_net: prices.length ? Math.min(...prices) : null,
      };
    });
  } catch {
    docs = [];
  }
  return NextResponse.json(docs, {
    headers: {
      "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
