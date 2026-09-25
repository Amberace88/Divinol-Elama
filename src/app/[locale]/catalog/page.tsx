import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { absoluteUrl, alternates } from "@/lib/seo";
import { breadcrumbJsonLd, catalogData, itemListJsonLd } from "@/lib/shop/catalog-page";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { CatalogHero } from "@/components/catalog/CatalogHero";
import { JsonLd } from "@/components/ui/JsonLd";

export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternates("/catalog", locale as Locale),
  };
}

export default async function CatalogPage({ params }: Props) {
  const { locale: l } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const [t, nav, a11y, actions, data] = await Promise.all([
    getTranslations("catalog"),
    getTranslations("nav"),
    getTranslations("a11y"),
    getTranslations("actions"),
    catalogData(locale),
  ]);
  const { summaries, categoryLinks } = data;
  const inStock = summaries.filter((p) => p.variants.some((v) => v.in_stock)).length;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("breadcrumbHome"), url: absoluteUrl("/", locale) },
          { name: nav("catalog"), url: absoluteUrl("/catalog", locale) },
        ])}
      />
      <JsonLd data={itemListJsonLd(t("itemListName"), summaries, locale)} />
      <CatalogHero
        eyebrow={nav("allProducts")}
        title={t("title")}
        intro={t("allIntro")}
        crumbs={[{ name: t("breadcrumbHome"), href: "/" }, { name: nav("catalog") }]}
        crumbsLabel={a11y("breadcrumbs")}
        stats={[t("subtitle", { count: summaries.length }), `${actions("inStock")}: ${inStock}`]}
      />
      <div className="container-x py-10 sm:py-12">
        <CatalogBrowser products={summaries} categories={categoryLinks} totalCount={summaries.length} />
      </div>
    </>
  );
}
