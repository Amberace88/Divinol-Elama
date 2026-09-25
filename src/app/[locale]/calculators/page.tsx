import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getProducts, summarize } from "@/lib/catalog";
import { CATEGORY, isLawnmowerOil, isMoto4T, isTwoStroke } from "@/lib/finder";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHero } from "@/components/pages/PageHero";
import { pageBreadcrumbLd, pageMetadata } from "@/components/pages/meta";
import { absoluteUrl } from "@/lib/seo";
import { CalcNav } from "@/components/tools/calculators/CalcNav";
import { OilPlanner } from "@/components/tools/calculators/OilPlanner";
import { FleetCalculator } from "@/components/tools/calculators/FleetCalculator";
import { TwoStrokeCalculator } from "@/components/tools/calculators/TwoStrokeCalculator";
import { WasherCalculator } from "@/components/tools/calculators/WasherCalculator";

export async function generateMetadata({ params }: PageProps<"/[locale]/calculators">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale as Locale, "/calculators", { title: "calc.metaTitle", description: "calc.metaDescription" });
}

const hasLitres = (p: { variants: { unit: string; size: number | null; price_net: number }[] }) =>
  p.variants.some((v) => v.unit === "l" && v.size && v.price_net > 0);

export default async function CalculatorsPage({ params }: PageProps<"/[locale]/calculators">) {
  const { locale: l } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const [t, tNav, products] = await Promise.all([
    getTranslations({ locale, namespace: "calc" }),
    getTranslations({ locale, namespace: "nav" }),
    getProducts(),
  ]);

  const all = products.map((p) => summarize(p, locale));
  const engineOils = all
    .filter((p) => (p.category === CATEGORY.car || p.category === CATEGORY.truck || isMoto4T(p) || isLawnmowerOil(p)) && hasLitres(p))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const heavy = all.filter((p) => p.category === CATEGORY.truck && hasLitres(p));
  const twoT = all.filter((p) => p.category === CATEGORY.moto && isTwoStroke(p)).map((p) => ({ slug: p.slug, name: p.name, image: p.image }));
  const washer = all.find((p) => /koncentr|concentrate/i.test(`${p.slug} ${p.name}`) && /60/.test(p.slug)) ?? null;

  const oilDefault = engineOils.find((p) => p.slug === "divinol-syntholight-dpf-5w-30")?.slug ?? engineOils[0]?.slug ?? "";
  const fleetDefault =
    heavy.find((p) => p.slug === "divinol-multimax-top-15w-40")?.slug ??
    heavy.find((p) => p.variants.some((v) => v.size === 20) && p.variants.some((v) => v.size === 200))?.slug ??
    heavy[0]?.slug ??
    "";

  const nav = [
    { id: "oil", label: t("oil.title") },
    { id: "fleet", label: t("fleet.title") },
    { id: "2t", label: t("twoT.title") },
    { id: "washer", label: t("washer.title") },
  ];

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t("title"),
    itemListElement: nav.map((n, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: n.label,
      url: `${absoluteUrl("/calculators", locale)}#${n.id}`,
    })),
  };

  return (
    <>
      <JsonLd data={await pageBreadcrumbLd(locale, "/calculators", tNav("calculators"))} />
      <JsonLd data={itemListLd} />
      <PageHero eyebrow={t("eyebrow")} title={t("title")} text={t("text")} crumbs={[{ name: tNav("calculators") }]} />

      <div className="bg-canvas pb-20">
        <div className="container-x pt-6 sm:pt-8">
          <CalcNav items={nav} label={t("nav")} />
          <div className="mt-8 grid gap-8 sm:gap-10">
            {engineOils.length > 0 && <OilPlanner products={engineOils} defaultSlug={oilDefault} />}
            {heavy.length > 0 && <FleetCalculator products={heavy} defaultSlug={fleetDefault} />}
            <TwoStrokeCalculator products={twoT} />
            <WasherCalculator productSlug={washer?.slug ?? null} />
          </div>
        </div>
      </div>
    </>
  );
}
