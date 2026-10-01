import { NextResponse, type NextRequest } from "next/server";
import { getProducts } from "@/lib/catalog";
import { matchProductSlug, type SiteLang } from "@/lib/legacy";

const PRODUCT_PATH: Record<SiteLang, string> = { lv: "/produkts", et: "/toode" };
const CATALOG_PATH: Record<SiteLang, string> = { lv: "/katalogs", et: "/kataloog" };

/** 301 from an old WooCommerce product URL (/product/<slug>/) to the matching product of the new shop. */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const old = (sp.get("slug") ?? "").slice(0, 200);
  const lang: SiteLang = sp.get("l") === "et" ? "et" : "lv";
  const products = await getProducts().catch(() => []);
  const slug = old ? matchProductSlug(old, products.map((p) => p.slug)) : null;
  const url = request.nextUrl.clone();
  url.search = "";
  if (slug) {
    url.pathname = `${PRODUCT_PATH[lang]}/${slug}`;
  } else {
    url.pathname = CATALOG_PATH[lang];
    const words = old.replace(/-\d+(?:[.,]\d+)?(?:l|kg|ml|g)(?:-.*)?$/i, "").replace(/-/g, " ").trim();
    if (words) url.searchParams.set("q", words);
  }
  return NextResponse.redirect(url, 301);
}
