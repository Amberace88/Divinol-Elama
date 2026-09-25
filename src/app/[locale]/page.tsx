import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getCategories, getProducts, summarize, t18 } from "@/lib/catalog";
import { packLabel } from "@/lib/commerce";
import { alternates } from "@/lib/seo";
import { FEATURED_SLUGS, HERO_PRODUCTS } from "@/lib/shop/featured";
import { Hero } from "@/components/home/Hero";
import { ApprovalMarquee } from "@/components/home/ApprovalMarquee";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { FinderTeaser } from "@/components/home/FinderTeaser";
import { ToolsTeaser } from "@/components/home/ToolsTeaser";
import { B2BBlock } from "@/components/home/B2BBlock";
import { Heritage } from "@/components/home/Heritage";
import { WhyUs } from "@/components/home/WhyUs";
import { CatalogsTeaser } from "@/components/home/CatalogsTeaser";

export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const [t, meta] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "meta" }),
  ]);
  return {
    title: { absolute: meta("defaultTitle") },
    description: t("metaDescription"),
    alternates: alternates("/", locale as Locale),
    // openGraph images come from ./opengraph-image.tsx (setting openGraph here would drop them)
  };
}

export default async function HomePage({ params }: Props) {
  const { locale: l } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const [t, products, categories] = await Promise.all([getTranslations("home"), getProducts(), getCategories()]);

  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const counts: Record<string, number> = {};
  for (const p of products) counts[p.category] = (counts[p.category] ?? 0) + 1;

  // featured: hand-picked bestsellers, topped up with is_featured / first products
  const picked = FEATURED_SLUGS.map((s) => bySlug.get(s)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  for (const p of [...products.filter((x) => x.is_featured), ...products]) {
    if (picked.length >= 8) break;
    if (!picked.includes(p)) picked.push(p);
  }
  const featured = picked.slice(0, 8).map((p) => summarize(p, locale));

  const bottles = HERO_PRODUCTS.map((s) => bySlug.get(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => {
      const s = summarize(p, locale);
      const v = [...p.variants].sort((a, b) => Number(a.size ?? 0) - Number(b.size ?? 0))[0];
      return { slug: p.slug, name: s.name, image: (v?.image ?? s.image) as string, label: p.sae ?? packLabel(v ?? { size: null, unit: "pcs" }) };
    })
    .filter((b) => Boolean(b.image));

  const packCount = new Set(products.flatMap((p) => p.variants.filter((v) => v.size).map((v) => `${Number(v.size)}${v.unit}`))).size;

  const homeCategories = categories.map((c) => {
    const tx = t18(c.i18n, locale);
    return {
      slug: c.slug,
      icon: c.icon,
      name: tx?.name ?? c.slug,
      description: tx?.description ?? "",
      image: c.image ?? null,
      count: counts[c.slug] ?? 0,
    };
  });

  return (
    <>
      <Hero bottles={bottles} productCount={products.length} packCount={packCount} />
      <ApprovalMarquee label={t("marqueeLabel")} />
      <CategoryGrid categories={homeCategories} />
      <FeaturedProducts products={featured} />
      <FinderTeaser />
      <ToolsTeaser />
      <B2BBlock />
      <Heritage
        eyebrow={t("heritageEyebrow")}
        title={t("heritageTitle")}
        text={t("heritageText")}
        cta={t("heritageCta")}
        since={t("heritageSince")}
        imageAlt={t("heritageImageAlt")}
      />
      <WhyUs />
      <CatalogsTeaser />
    </>
  );
}
