import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Building2, Clock, ExternalLink, Mail, MapPin, Navigation, Phone, Warehouse, type LucideIcon } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { getStoreSettings } from "@/lib/settings";
import { absoluteUrl, siteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/ui/JsonLd";
import { Reveal } from "@/components/ui/Reveal";
import { FacebookIcon, InstagramIcon } from "@/components/ui/SocialIcons";
import { PageHero, SectionHeading } from "@/components/pages/PageHero";
import { pageBreadcrumbLd, pageMetadata } from "@/components/pages/meta";
import { ContactForm } from "@/components/pages/contact/ContactForm";
import { CopyButton } from "@/components/pages/contact/CopyButton";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale as Locale, "/contact", { title: "contact.metaTitle", description: "contact.metaDescription" });
}

const GEO = { lat: 56.9366, lon: 24.0719 };
const D = 0.006;
const MAP_EMBED = `https://www.openstreetmap.org/export/embed.html?bbox=${GEO.lon - D * 1.8}%2C${GEO.lat - D}%2C${GEO.lon + D * 1.8}%2C${GEO.lat + D}&layer=mapnik&marker=${GEO.lat}%2C${GEO.lon}`;
const MAP_LINK = `https://www.openstreetmap.org/?mlat=${GEO.lat}&mlon=${GEO.lon}#map=17/${GEO.lat}/${GEO.lon}`;
const SOCIAL = [
  { href: "https://www.facebook.com/ELDivinol", label: "Facebook", Icon: FacebookIcon },
  { href: "https://www.instagram.com/divinol.lv/", label: "Instagram", Icon: InstagramIcon },
];

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale: l } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const [t, tNav, settings] = await Promise.all([
    getTranslations({ locale, namespace: "contact" }),
    getTranslations({ locale, namespace: "nav" }),
    getStoreSettings(),
  ]);
  const c = settings.company;
  const tel = c.phone.replace(/[^\d+]/g, "");
  const googleMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.warehouse)}`;
  const base = siteUrl(locale);

  const contactLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: t("metaTitle"),
    url: absoluteUrl("/contact", locale),
    mainEntity: {
      "@type": "LocalBusiness",
      "@id": `${base}/#store`,
      name: "Divinol — SIA Elama",
      legalName: c.name.replace(/"/g, ""),
      image: `${base}/media/brand/hero-barrels.webp`,
      url: base,
      telephone: c.phone,
      email: c.email,
      vatID: c.vat_no,
      taxID: c.reg_no,
      address: { "@type": "PostalAddress", streetAddress: "Ventspils iela 51", addressLocality: "Rīga", postalCode: "LV-1002", addressCountry: "LV" },
      geo: { "@type": "GeoCoordinates", latitude: GEO.lat, longitude: GEO.lon },
      hasMap: MAP_LINK,
      areaServed: ["LV", "EE", "LT"],
      parentOrganization: { "@id": `${base}/#organization` },
      contactPoint: [
        { "@type": "ContactPoint", contactType: "customer service", telephone: c.phone, email: c.email, availableLanguage: ["lv", "en", "ru"] },
      ],
      sameAs: SOCIAL.map((s) => s.href),
    },
  };

  const cards: { icon: LucideIcon; title: string; value: string; href?: string; sub?: string; copy?: boolean }[] = [
    { icon: Phone, title: t("phone"), value: c.phone, href: `tel:${tel}`, copy: true },
    { icon: Mail, title: t("email"), value: c.email, href: `mailto:${c.email}`, copy: true },
    { icon: Warehouse, title: t("warehouse"), value: c.warehouse, href: MAP_LINK },
    { icon: Building2, title: t("legal"), value: c.address },
  ];

  const requisites = [
    { k: t("company"), v: c.name },
    { k: t("regNo"), v: c.reg_no },
    { k: t("vatNo"), v: c.vat_no },
    ...(c.bank_name ? [{ k: t("bank"), v: c.bank_name }] : []),
    ...(c.iban ? [{ k: t("iban"), v: c.iban }] : []),
    ...(c.swift ? [{ k: t("swift"), v: c.swift }] : []),
  ];

  return (
    <>
      <JsonLd data={await pageBreadcrumbLd(locale, "/contact", tNav("contact"))} />
      <JsonLd data={contactLd} />
      <PageHero eyebrow={t("eyebrow")} title={t("title")} text={t("text")} crumbs={[{ name: tNav("contact") }]}>
        <div className="flex flex-wrap gap-3">
          <a href={`tel:${tel}`} className="inline-flex items-center gap-2 rounded-xl bg-brand-400 px-5 py-3 text-[15px] font-extrabold text-navy-900 shadow-glow transition hover:bg-brand-300">
            <Phone className="size-4" aria-hidden />
            {c.phone}
          </a>
          <a href={`mailto:${c.email}`} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-[15px] font-bold text-white ring-1 ring-white/20 transition hover:bg-white/20">
            <Mail className="size-4" aria-hidden />
            {c.email}
          </a>
        </div>
      </PageHero>

      {/* contact cards */}
      <section aria-label={t("title")} className="relative z-10 -mt-px bg-canvas pt-12 pb-4 sm:pt-16">
        <div className="container-x grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ icon: Icon, title, value, href, copy }, i) => (
            <Reveal key={title} delay={i * 0.05}>
              <div className="group flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-navy-700 text-brand-400 transition-transform duration-300 group-hover:-rotate-6">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {copy && <CopyButton value={value} label={t("copy")} doneLabel={t("copied")} />}
                </div>
                <h2 className="mt-4 text-[12px] font-extrabold uppercase tracking-[0.14em] text-muted">{title}</h2>
                {href ? (
                  <a
                    href={href}
                    {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="mt-1 text-[16px] font-bold break-words text-navy-700 hover:text-navy-500"
                  >
                    {value}
                  </a>
                ) : (
                  <p className="mt-1 text-[16px] font-bold break-words text-navy-700">{value}</p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* form + map */}
      <section aria-labelledby="contact-form" className="bg-canvas pt-8 pb-20">
        <div className="container-x grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="card p-6 sm:p-8">
            <SectionHeading id="contact-form" eyebrow={t("formEyebrow")} title={t("formTitle")} text={t("formText")} />
            <div className="mt-7">
              <ContactForm />
            </div>
          </div>

          <div className="grid content-start gap-6">
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
              <div className="relative aspect-[4/3] bg-navy-50 sm:aspect-[16/10] lg:aspect-[4/3]">
                <iframe
                  title={t("mapTitle")}
                  src={MAP_EMBED}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="absolute inset-0 size-full border-0 grayscale-[20%]"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="flex items-center gap-2 text-[14px] font-bold text-navy-700">
                  <MapPin className="size-4 text-brand-600" aria-hidden />
                  {c.warehouse}
                </p>
                <div className="flex gap-2">
                  <a href={MAP_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-navy-700 px-3 text-[13px] font-bold text-white transition hover:bg-navy-600">
                    <Navigation className="size-3.5" aria-hidden />
                    {t("directions")}
                  </a>
                  <a href={googleMaps} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-bold text-navy-700 transition hover:border-navy-300">
                    {t("googleMaps")}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-muted">{t("requisites")}</h2>
              <dl className="mt-3 divide-y divide-line">
                {requisites.map((r) => (
                  <div key={r.k} className="flex items-center justify-between gap-4 py-2.5 text-[14px]">
                    <dt className="text-muted">{r.k}</dt>
                    <dd className="flex items-center gap-1 text-right font-bold text-ink">
                      {r.v}
                      <CopyButton value={r.v} label={t("copy")} doneLabel={t("copied")} />
                    </dd>
                  </div>
                ))}
              </dl>
              {c.hours && (
                <p className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-[14px] text-ink/80">
                  <Clock className="size-4 text-navy-400" aria-hidden />
                  <span className="font-semibold">{t("hours")}:</span> {c.hours}
                </p>
              )}
              <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                <span className="text-[13px] font-bold text-navy-700">{t("social")}</span>
                <div className="flex gap-2">
                  {SOCIAL.map(({ href, label, Icon }) => (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="grid size-10 place-items-center rounded-xl bg-navy-50 text-navy-700 transition hover:bg-brand-400 hover:text-navy-900"
                    >
                      <Icon className="size-5" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
