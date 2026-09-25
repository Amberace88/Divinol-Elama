import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowRight,
  BadgePercent,
  Boxes,
  CircleCheck,
  Construction,
  Factory,
  FileCheck,
  Headset,
  Receipt,
  TreePine,
  Tractor,
  Truck,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getProducts } from "@/lib/catalog";
import { getStoreSettings } from "@/lib/settings";
import { absoluteUrl, siteUrl } from "@/lib/seo";
import { buttonClass } from "@/components/ui/Button";
import { JsonLd } from "@/components/ui/JsonLd";
import { Reveal } from "@/components/ui/Reveal";
import { PageHero, SectionHeading } from "@/components/pages/PageHero";
import { CountUp } from "@/components/pages/CountUp";
import { pageBreadcrumbLd, pageMetadata } from "@/components/pages/meta";
import { QuoteForm } from "@/components/pages/business/QuoteForm";
import { SEGMENTS } from "@/components/pages/business/segments";

export async function generateMetadata({ params }: PageProps<"/[locale]/business">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale as Locale, "/business", { title: "business.metaTitle", description: "business.metaDescription" }, "/media/brand/f2.webp");
}

const SEGMENT_ICON: Record<(typeof SEGMENTS)[number], LucideIcon> = {
  service: Wrench,
  fleet: Truck,
  agro: Tractor,
  construction: Construction,
  forestry: TreePine,
  industry: Factory,
};

const BENEFITS: { key: string; icon: LucideIcon }[] = [
  { key: "prices", icon: BadgePercent },
  { key: "invoice", icon: Receipt },
  { key: "bulk", icon: Boxes },
  { key: "manager", icon: Headset },
  { key: "portal", icon: UserCheck },
  { key: "docs", icon: FileCheck },
];

export default async function BusinessPage({ params }: PageProps<"/[locale]/business">) {
  const { locale: l } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const [t, tNav, products, settings] = await Promise.all([
    getTranslations({ locale, namespace: "business" }),
    getTranslations({ locale, namespace: "nav" }),
    getProducts(),
    getStoreSettings(),
  ]);
  const markets = Object.keys(settings.vat).length || 3;

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: t("title"),
    description: t("metaDescription"),
    serviceType: "B2B lubricant supply",
    url: absoluteUrl("/business", locale),
    provider: { "@id": `${siteUrl(locale)}/#organization` },
    areaServed: [
      { "@type": "Country", name: "Latvia" },
      { "@type": "Country", name: "Estonia" },
      { "@type": "Country", name: "Lithuania" },
    ],
    brand: { "@type": "Brand", name: "Divinol" },
  };

  const stats = [
    { value: products.length, suffix: "+", label: t("stats.products"), grouping: true },
    { value: 1866, suffix: "", label: t("stats.since"), grouping: false },
    { value: markets, suffix: "", label: t("stats.markets"), grouping: true },
    { value: 200, suffix: " L", label: t("stats.drum"), grouping: true },
  ];

  return (
    <>
      <JsonLd data={await pageBreadcrumbLd(locale, "/business", tNav("business"))} />
      <JsonLd data={serviceLd} />
      <PageHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        text={t("text")}
        crumbs={[{ name: tNav("business") }]}
        visual={
          <div className="relative mx-auto max-w-xl lg:ml-auto">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-lift ring-1 ring-white/15">
              <Image src="/media/brand/f2.webp" alt="" fill priority sizes="(min-width:1024px) 40vw, 90vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-navy-900/10 to-transparent" />
            </div>
            <div className="absolute -bottom-6 -left-4 flex max-w-[16rem] animate-float items-center gap-3 rounded-2xl bg-surface p-4 text-ink shadow-lift sm:-left-8">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-400 text-navy-900">
                <BadgePercent className="size-5" aria-hidden />
              </span>
              <span className="text-[13px] font-bold leading-snug text-navy-700">{t("benefits.prices")}</span>
            </div>
            <div className="absolute -top-5 -right-3 hidden items-center gap-2 rounded-xl bg-navy-900/90 px-3.5 py-2.5 text-[13px] font-bold text-white shadow-lift ring-1 ring-white/10 backdrop-blur sm:flex">
              <Receipt className="size-4 text-brand-400" aria-hidden />
              {t("benefits.invoice")}
            </div>
          </div>
        }
      >
        <div className="flex flex-wrap gap-3">
          <a href="#quote" className={buttonClass("primary", "lg")}>
            {t("heroCta")}
            <ArrowRight className="size-4" aria-hidden />
          </a>
          <Link href="/register" className={buttonClass("light", "lg")}>
            {t("heroCta2")}
          </Link>
        </div>
      </PageHero>

      {/* segments */}
      <section aria-labelledby="segments" className="py-16 sm:py-24">
        <div className="container-x">
          <SectionHeading id="segments" eyebrow={t("segmentsEyebrow")} title={t("segmentsTitle")} />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SEGMENTS.map((s, i) => {
              const Icon = SEGMENT_ICON[s];
              return (
                <Reveal as="li" key={s} delay={i * 0.05}>
                  <div className="group relative h-full overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-card transition duration-300 hover:border-navy-200 hover:shadow-lift">
                    <div aria-hidden className="absolute -top-10 -right-10 size-32 rounded-full bg-brand-400/0 transition-colors duration-500 group-hover:bg-brand-400/15" />
                    <span className="relative grid size-12 place-items-center rounded-xl bg-navy-700 text-brand-400 transition-transform duration-300">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <h3 className="relative mt-5 text-lg font-extrabold text-navy-700">{t(`segments.${s}`)}</h3>
                    <p className="relative mt-2 text-[14.5px] leading-6 text-muted">{t(`segmentsText.${s}`)}</p>
                  </div>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      {/* benefits */}
      <section aria-labelledby="benefits" className="relative isolate overflow-hidden bg-navy-800 py-16 text-white sm:py-24">
        <div aria-hidden className="grid-bg absolute inset-0 -z-10 opacity-60" />
        <div aria-hidden className="absolute top-0 -left-40 -z-10 size-[480px] rounded-full bg-brand-400/10 blur-3xl" />
        <div className="container-x">
          <SectionHeading id="benefits" eyebrow={t("benefitsEyebrow")} title={t("benefitsTitle")} tone="dark" />
          <ul className="mt-10 grid gap-px overflow-hidden rounded-3xl bg-white/10 ring-1 ring-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(({ key, icon: Icon }, i) => (
              <Reveal as="li" key={key} delay={i * 0.05} className="bg-navy-800">
                <div className="h-full p-6 transition-colors hover:bg-white/[0.04] sm:p-8">
                  <Icon className="size-7 text-brand-400" aria-hidden />
                  <h3 className="mt-4 text-lg font-extrabold">{t(`benefits.${key}`)}</h3>
                  <p className="mt-2 text-[14.5px] leading-6 text-white/65">{t(`benefits.${key}Text`)}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* stats */}
      <section aria-label={t("statsTitle")} className="border-b border-line bg-page py-14">
        <dl className="container-x grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="relative flex flex-col-reverse pl-5">
              <span aria-hidden className="absolute top-1 bottom-1 left-0 w-1 -skew-x-12 rounded-sm bg-brand-400" />
              <dt className="mt-1 text-[14px] font-medium text-muted">{s.label}</dt>
              <dd className="h-display text-4xl text-navy-700 sm:text-5xl">
                <CountUp value={s.value} suffix={s.suffix} grouping={s.grouping} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* how it works */}
      <section aria-labelledby="how" className="bg-canvas py-16 sm:py-24">
        <div className="container-x">
          <SectionHeading id="how" eyebrow={t("howEyebrow")} title={t("howTitle")} align="center" />
          <div className="relative mt-12">
          <div aria-hidden className="absolute top-8 right-[16%] left-[16%] hidden h-0.5 bg-gradient-to-r from-brand-400 via-navy-200 to-brand-400 md:block" />
          <ol className="relative grid gap-6 md:grid-cols-3">
            {([1, 2, 3] as const).map((n, i) => (
              <Reveal as="li" key={n} delay={i * 0.1} className="relative text-center">
                <span className="relative mx-auto grid size-16 place-items-center rounded-2xl bg-navy-700 text-2xl font-extrabold text-brand-400 shadow-lift ring-8 ring-canvas">
                  {n}
                </span>
                <h3 className="mt-5 text-lg font-extrabold text-navy-700">{t(`how${n}`)}</h3>
                <p className="mx-auto mt-2 max-w-xs text-[14.5px] leading-6 text-muted">{t(`how${n}Text`)}</p>
              </Reveal>
            ))}
          </ol>
          </div>
          <div className="mt-12 flex justify-center">
            <Link href="/register" className={buttonClass("dark", "lg")}>
              {t("registerCta")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* quote form */}
      <section id="quote" aria-labelledby="quote-title" className="scroll-mt-24 py-16 sm:py-24">
        <div className="container-x grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading id="quote-title" eyebrow={t("formEyebrow")} title={t("formTitle")} text={t("formText")} />
            <ul className="mt-6 grid gap-3">
              {(["formPoint1", "formPoint2", "formPoint3"] as const).map((k) => (
                <li key={k} className="flex items-center gap-2.5 text-[15px] font-semibold text-navy-700">
                  <CircleCheck className="size-5 text-success" aria-hidden />
                  {t(k)}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex items-center gap-3 rounded-2xl border border-line bg-canvas p-4">
              <Headset className="size-6 shrink-0 text-navy-500" aria-hidden />
              <div className="text-sm">
                <a href={`tel:${settings.company.phone.replace(/\s/g, "")}`} className="block font-extrabold text-navy-700 hover:underline">
                  {settings.company.phone}
                </a>
                <a href={`mailto:${settings.company.email}`} className="block text-muted hover:text-navy-700">
                  {settings.company.email}
                </a>
              </div>
            </div>
          </div>
          <div className="card p-6 sm:p-8">
            <QuoteForm />
          </div>
        </div>
      </section>
    </>
  );
}
