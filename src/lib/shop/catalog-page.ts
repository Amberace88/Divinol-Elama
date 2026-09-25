import "server-only";
import { getCategories, getProducts, summarize, type ProductSummary } from "@/lib/catalog";
import { absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";
import type { Locale } from "@/i18n/routing";

/** Data shared by the catalog listing pages. */
export async function catalogData(locale: Locale) {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const counts: Record<string, number> = {};
  for (const p of products) counts[p.category] = (counts[p.category] ?? 0) + 1;
  const categoryLinks = categories.map((c) => ({
    slug: c.slug,
    icon: c.icon,
    name: c.i18n[locale]?.name ?? c.i18n.en?.name ?? c.i18n.lv?.name ?? c.slug,
    count: counts[c.slug] ?? 0,
  }));
  return { products, categories, categoryLinks, summaries: products.map((p) => summarize(p, locale)) };
}

export function itemListJsonLd(name: string, items: ProductSummary[], locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl({ pathname: "/product/[slug]", params: { slug: p.slug } }, locale),
      name: p.name,
    })),
  };
}

export { breadcrumbJsonLd };
