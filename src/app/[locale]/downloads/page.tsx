import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Download, Eye, FileText, Languages } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { absoluteUrl, siteUrl } from "@/lib/seo";
import { buttonClass } from "@/components/ui/Button";
import { JsonLd } from "@/components/ui/JsonLd";
import { Reveal } from "@/components/ui/Reveal";
import { PageHero } from "@/components/pages/PageHero";
import { pageBreadcrumbLd, pageMetadata } from "@/components/pages/meta";

export async function generateMetadata({ params }: PageProps<"/[locale]/downloads">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale as Locale, "/downloads", { title: "downloads.metaTitle", description: "downloads.metaDescription" }, "/media/catalogs/divinol-katalogs-vieglajiem-auto-cover.webp");
}

type Catalog = { key: string; file: string; langs: ("lv" | "de" | "en" | "ru")[]; pages: number; bytes: number };

/** Official catalogues served from /public/media/catalogs (cover = first page, `<file>-cover.webp`). */
const CATALOGS: Catalog[] = [
  { key: "cars", file: "divinol-katalogs-vieglajiem-auto", langs: ["lv", "de"], pages: 40, bytes: 1566918 },
  { key: "commercial", file: "divinol-katalogs-komerctransportam", langs: ["lv", "de"], pages: 40, bytes: 1565791 },
  { key: "industrial", file: "divinol-industrial-oils", langs: ["en"], pages: 13, bytes: 1733817 },
  { key: "greases", file: "divinol-greases", langs: ["en"], pages: 33, bytes: 2401933 },
  { key: "bio", file: "divinol-biolubricants", langs: ["en"], pages: 7, bytes: 2954110 },
  { key: "release", file: "divinol-release-agents", langs: ["en"], pages: 13, bytes: 2060905 },
  { key: "moto", file: "divinol-motorrad-sortiment", langs: ["de"], pages: 2, bytes: 1380378 },
  { key: "agro", file: "divinol-agro-programma", langs: ["ru"], pages: 2, bytes: 625739 },
];

function formatSize(bytes: number, locale: string) {
  const mb = bytes / 1024 / 1024;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: mb < 1 ? 2 : 1 }).format(mb)} MB`;
}

export default async function DownloadsPage({ params }: PageProps<"/[locale]/downloads">) {
  const { locale: l } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const [t, tNav] = await Promise.all([
    getTranslations({ locale, namespace: "downloads" }),
    getTranslations({ locale, namespace: "nav" }),
  ]);
  const base = siteUrl(locale);
  const items = CATALOGS.map((c) => ({ ...c, href: `/media/catalogs/${c.file}.pdf`, cover: `/media/catalogs/${c.file}-cover.webp` }));

  const listLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t("title"),
    url: absoluteUrl("/downloads", locale),
    hasPart: items.map((it) => ({
      "@type": "DigitalDocument",
      name: `Divinol — ${t(`items.${it.key}`)}`,
      encodingFormat: "application/pdf",
      url: `${base}${it.href}`,
      thumbnailUrl: `${base}${it.cover}`,
      inLanguage: it.langs,
      publisher: { "@type": "Organization", name: "Zeller+Gmelin GmbH & Co. KG" },
    })),
  };

  return (
    <>
      <JsonLd data={await pageBreadcrumbLd(locale, "/downloads", tNav("downloads"))} />
      <JsonLd data={listLd} />
      <PageHero eyebrow={t("eyebrow")} title={t("title")} text={t("text")} crumbs={[{ name: tNav("downloads") }]} compact />

      <section aria-label={t("title")} className="bg-canvas py-12 sm:py-16">
        <ul className="container-x grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((it, i) => {
            const title = t(`items.${it.key}`);
            return (
              <Reveal as="li" key={it.key} delay={(i % 4) * 0.06}>
                <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift">
                  <a
                    href={it.href}
                    target="_blank"
                    rel="noopener"
                    tabIndex={-1}
                    aria-hidden
                    className="relative block aspect-[3/4] overflow-hidden bg-navy-50"
                  >
                    <Image
                      src={it.cover}
                      alt=""
                      fill
                      sizes="(min-width:1280px) 22vw, (min-width:1024px) 30vw, (min-width:640px) 45vw, 90vw"
                      className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-navy-950/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <span className="absolute top-3 left-3 skew-tag bg-navy-900/85 text-[11px] font-extrabold uppercase tracking-wide text-white backdrop-blur">
                      <span className="flex items-center gap-1">
                        <FileText className="size-3.5" aria-hidden />
                        PDF
                      </span>
                    </span>
                  </a>
                  <div className="flex flex-1 flex-col p-5">
                    <h2 className="text-lg font-extrabold leading-snug text-navy-700">{title}</h2>
                    <p className="mt-1.5 text-[13.5px] leading-5 text-muted">{t(`descriptions.${it.key}`)}</p>
                    <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]">
                      <div className="flex items-center gap-1.5">
                        <dt className="sr-only">{t("lang")}</dt>
                        <Languages className="size-3.5 text-navy-400" aria-hidden />
                        <dd className="font-semibold text-ink/80">{it.langs.map((lg) => t(`langs.${lg}`)).join(" / ")}</dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <dt className="sr-only">{t("size")}</dt>
                        <dd className="font-semibold text-ink/80">
                          {formatSize(it.bytes, locale)} · {t("pages", { count: it.pages })}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                      <a href={it.href} target="_blank" rel="noopener" className={buttonClass("outline", "sm")} aria-label={`${t("open")}: ${title}`}>
                        <Eye className="size-4" aria-hidden />
                        {t("open")}
                      </a>
                      <a href={it.href} download className={buttonClass("dark", "sm")} aria-label={`${t("download")}: ${title}`}>
                        <Download className="size-4" aria-hidden />
                        {t("download")}
                      </a>
                    </div>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </ul>

        <div className="container-x mt-12">
          <div className="flex flex-col items-start justify-between gap-5 rounded-2xl border border-dashed border-navy-200 bg-white p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <h2 className="text-xl font-extrabold text-navy-700">{t("helpTitle")}</h2>
              <p className="mt-1.5 max-w-2xl text-[14.5px] leading-6 text-muted">{t("helpText")}</p>
            </div>
            <Link href="/contact" className={buttonClass("primary", "md", "shrink-0")}>
              {t("helpCta")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
