import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getCategories, getProducts } from "@/lib/catalog";
import { absoluteUrl, alternates, siteUrl } from "@/lib/seo";

export const revalidate = 3600;

type Href = Parameters<typeof absoluteUrl>[0];

const STATIC: { href: Href; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { href: "/", priority: 1, freq: "weekly" },
  { href: "/catalog", priority: 0.9, freq: "daily" },
  { href: "/oil-finder", priority: 0.8, freq: "monthly" },
  { href: "/calculators", priority: 0.6, freq: "monthly" },
  { href: "/business", priority: 0.7, freq: "monthly" },
  { href: "/about", priority: 0.5, freq: "yearly" },
  { href: "/contact", priority: 0.5, freq: "yearly" },
  { href: "/downloads", priority: 0.5, freq: "monthly" },
  { href: "/delivery", priority: 0.4, freq: "yearly" },
  { href: "/terms", priority: 0.2, freq: "yearly" },
  { href: "/privacy", priority: 0.2, freq: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  const add = (href: Href, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"], images?: string[]) => {
    for (const locale of routing.locales) {
      entries.push({
        url: absoluteUrl(href, locale),
        lastModified: now,
        changeFrequency,
        priority,
        alternates: { languages: alternates(href, locale).languages },
        ...(images?.length ? { images: images.map((src) => (src.startsWith("http") ? src : `${siteUrl(locale)}${src}`)) } : {}),
      });
    }
  };

  for (const s of STATIC) add(s.href, s.priority, s.freq);
  for (const c of categories) add({ pathname: "/catalog/[category]", params: { category: c.slug } }, 0.8, "weekly");
  for (const p of products) {
    add({ pathname: "/product/[slug]", params: { slug: p.slug } }, 0.7, "weekly", p.images.slice(0, 1));
  }
  return entries;
}
