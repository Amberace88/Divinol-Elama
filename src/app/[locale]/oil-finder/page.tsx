import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CircleCheck } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { getProducts, summarize } from "@/lib/catalog";
import { FINDER_CATEGORIES } from "@/lib/finder";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHero, SectionHeading } from "@/components/pages/PageHero";
import { Faq } from "@/components/pages/Faq";
import { faqJsonLd, pageBreadcrumbLd, pageMetadata } from "@/components/pages/meta";
import { OilFinder } from "@/components/tools/finder/OilFinder";

export async function generateMetadata({ params }: PageProps<"/[locale]/oil-finder">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale as Locale, "/oil-finder", { title: "finder.metaTitle", description: "finder.metaDescription" });
}

export default async function OilFinderPage({ params }: PageProps<"/[locale]/oil-finder">) {
  const { locale: l } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const [t, tNav, tUi, products] = await Promise.all([
    getTranslations({ locale, namespace: "finder" }),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "pagesUi" }),
    getProducts(),
  ]);
  const summaries = products.filter((p) => FINDER_CATEGORIES.includes(p.category)).map((p) => summarize(p, locale));
  const faq = t.raw("faq") as { q: string; a: string }[];

  return (
    <>
      <JsonLd data={await pageBreadcrumbLd(locale, "/oil-finder", tNav("oilFinder"))} />
      <JsonLd data={faqJsonLd(faq)} />
      <PageHero eyebrow={t("eyebrow")} title={t("title")} text={t("text")} crumbs={[{ name: tNav("oilFinder") }]}>
        <ul className="flex flex-wrap gap-x-6 gap-y-2.5">
          {(["heroPoint1", "heroPoint2", "heroPoint3"] as const).map((k) => (
            <li key={k} className="flex items-center gap-2 text-sm font-semibold text-white/85">
              <CircleCheck className="size-4 text-brand-400" aria-hidden />
              {t(k)}
            </li>
          ))}
        </ul>
      </PageHero>

      <section aria-label={t("title")} className="relative bg-canvas pb-20">
        <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-navy-950/[0.06] to-transparent" />
        <div className="container-x relative -mt-2 pt-10 sm:pt-12">
          <OilFinder products={summaries} />
        </div>
      </section>

      <section aria-labelledby="finder-faq" className="bg-page py-16 sm:py-24">
        <div className="container-x grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <SectionHeading id="finder-faq" eyebrow={tUi("faqEyebrow")} title={tUi("faqTitle")} text={t("disclaimer")} className="lg:sticky lg:top-28 lg:self-start" />
          <Faq items={faq} />
        </div>
      </section>
    </>
  );
}
