import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Award, BadgeCheck, Factory, FlaskConical, Handshake, MapPin, MessageSquare, ShieldCheck, Truck, Users, type LucideIcon } from "lucide-react";
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

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale as Locale, "/about", { title: "about.metaTitle", description: "about.metaDescription" });
}

const PARTNERS = ["BMW", "Porsche", "Bosch", "BASF", "Deutsche Bahn", "Metabo"];
const FOUNDED = 1866;
const SUBSIDIARIES = 15;

const VALUES: { n: 1 | 2 | 3 | 4; icon: LucideIcon }[] = [
  { n: 1, icon: ShieldCheck },
  { n: 2, icon: MessageSquare },
  { n: 3, icon: Truck },
  { n: 4, icon: Handshake },
];

const BADGES: { key: string; icon: LucideIcon }[] = [
  { key: "iso", icon: BadgeCheck },
  { key: "top100", icon: Award },
  { key: "made", icon: Factory },
  { key: "family", icon: Users },
];

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale: l } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const [t, tNav, products, settings] = await Promise.all([
    getTranslations({ locale, namespace: "about" }),
    getTranslations({ locale, namespace: "nav" }),
    getProducts(),
    getStoreSettings(),
  ]);
  const years = new Date().getFullYear() - FOUNDED;

  const facts = [
    { value: FOUNDED, suffix: "", grouping: false, label: t("facts.founded") },
    { value: years, suffix: "+", grouping: true, label: t("facts.years") },
    { value: SUBSIDIARIES, suffix: "", grouping: true, label: t("facts.subsidiaries") },
    { value: products.length, suffix: "+", grouping: true, label: t("facts.products") },
  ];

  const aboutLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: t("metaTitle"),
    description: t("metaDescription"),
    url: absoluteUrl("/about", locale),
    mainEntity: { "@id": `${siteUrl(locale)}/#organization` },
  };

  return (
    <>
      <JsonLd data={await pageBreadcrumbLd(locale, "/about", tNav("about"))} />
      <JsonLd data={aboutLd} />
      <PageHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        text={t("text")}
        crumbs={[{ name: tNav("about") }]}
        visual={
          <div className="relative mx-auto max-w-xl lg:ml-auto">
            <div className="relative aspect-[16/11] overflow-hidden rounded-3xl shadow-lift ring-1 ring-white/15">
              <Image src="/media/brand/hero-barrels.webp" alt={`Divinol — ${t("badges.made")}`} fill priority sizes="(min-width:1024px) 40vw, 90vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-tr from-navy-950/50 to-transparent" />
            </div>
            <div className="absolute -bottom-6 -left-3 animate-float rounded-2xl bg-brand-400 px-5 py-4 text-navy-900 shadow-glow sm:-left-8">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]">Zeller+Gmelin</p>
              <p className="h-display text-3xl leading-none">
                <CountUp value={FOUNDED} grouping={false} />
              </p>
            </div>
          </div>
        }
      />

      {/* story */}
      <section aria-labelledby="story" className="py-16 sm:py-24">
        <div className="container-x grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal className="relative order-2 lg:order-1">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-lift">
              <Image src="/media/brand/f2.webp" alt="" fill sizes="(min-width:1024px) 45vw, 90vw" className="object-cover" />
            </div>
            <div aria-hidden className="absolute -top-4 -right-4 -z-10 h-full w-full -skew-x-3 rounded-3xl bg-brand-400/30" />
            <div className="absolute right-4 bottom-4 flex items-center gap-2 rounded-xl bg-white/95 px-3.5 py-2.5 text-[13px] font-bold text-navy-700 shadow-card backdrop-blur">
              <MapPin className="size-4 text-brand-600" aria-hidden />
              {settings.company.warehouse}
            </div>
          </Reveal>
          <div className="order-1 lg:order-2">
            <SectionHeading id="story" eyebrow={t("storyEyebrow")} title={t("storyTitle")} />
            <Reveal delay={0.05}>
              <p className="mt-5 text-[16px] leading-8 text-ink/80">{t("storyText1")}</p>
              <p className="mt-4 text-[16px] leading-8 text-ink/80">{t("storyText2")}</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Zeller+Gmelin heritage */}
      <section aria-labelledby="zg" className="relative isolate overflow-hidden bg-navy-800 py-16 text-white sm:py-24">
        <div aria-hidden className="grid-bg absolute inset-0 -z-10 opacity-60" />
        <div aria-hidden className="absolute -right-40 -bottom-40 -z-10 size-[520px] rounded-full bg-brand-400/10 blur-3xl" />
        <div className="container-x">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <SectionHeading id="zg" eyebrow={t("zgEyebrow")} title={t("zgTitle")} tone="dark" />
              <Reveal delay={0.05}>
                <p className="mt-5 text-[16px] leading-8 text-white/75">{t("zgText1")}</p>
                <p className="mt-4 text-[16px] leading-8 text-white/75">{t("zgText2")}</p>
              </Reveal>
              <ul className="mt-8 flex flex-wrap gap-2">
                {BADGES.map(({ key, icon: Icon }) => (
                  <li key={key} className="skew-tag bg-white/10 text-[13px] font-bold ring-1 ring-white/15">
                    <span className="flex items-center gap-1.5">
                      <Icon className="size-4 text-brand-400" aria-hidden />
                      {t(`badges.${key}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <dl className="grid grid-cols-2 gap-4 self-center">
              {facts.map((f, i) => (
                <Reveal key={f.label} delay={i * 0.06} className="flex flex-col-reverse rounded-2xl bg-white/[0.06] p-6 ring-1 ring-white/10">
                  <dt className="mt-2 text-[14px] font-medium leading-snug text-white/65">{f.label}</dt>
                  <dd className="h-display text-4xl text-brand-400 sm:text-5xl">
                    <CountUp value={f.value} suffix={f.suffix} grouping={f.grouping} />
                  </dd>
                </Reveal>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* trust / partners */}
      <section aria-labelledby="trust" className="border-b border-line py-16 sm:py-20">
        <div className="container-x grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <SectionHeading id="trust" eyebrow={t("trustEyebrow")} title={t("trustTitle")} text={t("trustText")} />
          <ul className="flex flex-wrap gap-3 lg:justify-end">
            {PARTNERS.map((p, i) => (
              <Reveal as="li" key={p} delay={i * 0.05}>
                <span className="flex h-14 items-center rounded-2xl border border-line bg-white px-6 text-lg font-extrabold tracking-tight text-navy-700 shadow-card transition hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-lift">
                  {p}
                </span>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* values */}
      <section aria-labelledby="values" className="bg-canvas py-16 sm:py-24">
        <div className="container-x">
          <SectionHeading id="values" eyebrow={t("valuesEyebrow")} title={t("valuesTitle")} align="center" />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ n, icon: Icon }, i) => (
              <Reveal as="li" key={n} delay={i * 0.06}>
                <div className="group h-full rounded-2xl border border-line bg-white p-6 shadow-card transition duration-300 hover:shadow-lift">
                  <span className="grid size-12 place-items-center rounded-xl bg-brand-400 text-navy-900 transition-transform duration-300 group-hover:rotate-6">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-lg font-extrabold text-navy-700">{t(`value${n}`)}</h3>
                  <p className="mt-2 text-[14.5px] leading-6 text-muted">{t(`value${n}Text`)}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20">
        <div className="container-x">
          <Reveal>
            <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-navy-700 to-navy-950 px-6 py-12 text-white shadow-lift sm:px-12 sm:py-14">
              <div aria-hidden className="grid-bg absolute inset-0 -z-10 opacity-60" />
              <div aria-hidden className="absolute top-0 right-10 -z-10 h-full w-28 -skew-x-12 bg-brand-400/20" />
              <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-xl">
                  <h2 className="h-display text-3xl sm:text-4xl">{t("ctaTitle")}</h2>
                  <p className="mt-3 text-white/70">{t("ctaText")}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/oil-finder" className={buttonClass("primary", "lg")}>
                    <FlaskConical className="size-4" aria-hidden />
                    {t("ctaFinder")}
                  </Link>
                  <Link href="/contact" className={buttonClass("light", "lg")}>
                    {t("ctaContact")}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
