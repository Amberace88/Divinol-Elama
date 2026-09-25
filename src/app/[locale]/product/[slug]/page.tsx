import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, BadgeCheck, FileText, Mail } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getCategory, getProduct, getProducts, productText, summarize, t18 } from "@/lib/catalog";
import { BASE_VAT, gross, packLabel } from "@/lib/commerce";
import { absoluteUrl, alternates, breadcrumbJsonLd, siteUrl } from "@/lib/seo";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { PackCalculator } from "@/components/product/PackCalculator";
import { AskExpertForm } from "@/components/product/AskExpertForm";
import { SectionNav } from "@/components/product/SectionNav";
import { ProductCard } from "@/components/catalog/ProductCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/ui/JsonLd";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

export const revalidate = 3600;

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  const products = await getProducts();
  return routing.locales.flatMap((locale) => products.map((p) => ({ locale, slug: p.slug })));
}

const abs = (locale: Locale, src: string) => (src.startsWith("http") ? src : `${siteUrl(locale)}${src}`);
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: l, slug } = await params;
  const locale = l as Locale;
  const p = await getProduct(slug);
  if (!p) return {};
  const tx = productText(p, locale);
  const title = tx.meta_title || `${tx.name}${tx.type ? ` — ${tx.type}` : ""}`;
  const description = tx.meta_description || tx.short || stripHtml(tx.description).slice(0, 160);
  const href = { pathname: "/product/[slug]" as const, params: { slug } };
  const image = p.images[0] ?? p.variants.find((v) => v.image)?.image;
  return {
    title: tx.meta_title ? { absolute: tx.meta_title } : title,
    description,
    alternates: alternates(href, locale),
    openGraph: {
      type: "website",
      title,
      description,
      url: absoluteUrl(href, locale),
      images: image ? [{ url: abs(locale, image), alt: tx.name }] : undefined,
    },
  };
}

function Chips({ items, tone = "light" }: { items: string[]; tone?: "light" | "brand" }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <li
          key={s}
          className={
            tone === "brand"
              ? "inline-flex items-center gap-1.5 rounded-lg bg-navy-700 px-2.5 py-1 text-[12.5px] font-bold text-white"
              : "rounded-lg border border-line bg-canvas px-2.5 py-1 text-[12.5px] font-semibold text-navy-700"
          }
        >
          {tone === "brand" && <BadgeCheck className="size-3.5 text-brand-300" aria-hidden />}
          {s}
        </li>
      ))}
    </ul>
  );
}

export default async function ProductPage({ params }: Props) {
  const { locale: l, slug } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const p = await getProduct(slug);
  if (!p) notFound();

  const [t, tc, nav, a11y, tu, category, all] = await Promise.all([
    getTranslations("product"),
    getTranslations("catalog"),
    getTranslations("nav"),
    getTranslations("a11y"),
    getTranslations("units"),
    getCategory(p.category),
    getProducts(),
  ]);
  const tx = productText(p, locale);
  const s = summarize(p, locale);
  const catName = category ? (t18(category.i18n, locale)?.name ?? category.slug) : "";
  const href = { pathname: "/product/[slug]" as const, params: { slug } };
  const catHref = { pathname: "/catalog/[category]" as const, params: { category: p.category } };

  // gallery: product images + per-pack images (deduped)
  const packOf = new Map(p.variants.filter((v) => v.image).map((v) => [v.image as string, packLabel(v)]));
  const srcs = [...new Set([...p.images, ...p.variants.map((v) => v.image).filter((x): x is string => Boolean(x))])];
  const images = srcs.map((src) => ({
    src,
    alt: packOf.get(src) ? t("imageAlt", { name: tx.name, pack: packOf.get(src)! }) : tx.name,
  }));

  const keyApprovals = [...p.oem_approvals, ...p.performance].slice(0, 4);
  const viscosity = p.sae ?? p.iso_vg;

  // related: same category, same viscosity first
  const related = all
    .filter((x) => x.slug !== p.slug && x.category === p.category)
    .sort((a, b) => Number(b.sae != null && b.sae === p.sae) - Number(a.sae != null && a.sae === p.sae))
    .slice(0, 4)
    .map((x) => summarize(x, locale));

  // JSON-LD Product (prices incl. LV VAT)
  const offers = p.variants.map((v) => ({
    "@type": "Offer",
    sku: v.sku ?? undefined,
    name: `${tx.name} ${packLabel(v)}`.trim(),
    price: gross(v.price_net, BASE_VAT).toFixed(2),
    priceCurrency: "EUR",
    availability: v.in_stock ? "https://schema.org/InStock" : "https://schema.org/BackOrder",
    itemCondition: "https://schema.org/NewCondition",
    url: absoluteUrl(href, locale),
    seller: { "@id": `${siteUrl(locale)}/#organization` },
  }));
  const prices = p.variants.map((v) => gross(v.price_net, BASE_VAT));
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${absoluteUrl(href, locale)}#product`,
    name: tx.name,
    description: tx.meta_description || tx.short || stripHtml(tx.description).slice(0, 300),
    image: srcs.map((src) => abs(locale, src)),
    sku: p.base_sku ?? p.variants[0]?.sku ?? undefined,
    mpn: p.base_sku ?? undefined,
    category: catName || undefined,
    brand: { "@type": "Brand", name: "Divinol" },
    manufacturer: { "@type": "Organization", name: "Zeller+Gmelin GmbH & Co. KG", url: "https://www.zeller-gmelin.de" },
    countryOfOrigin: "DE",
    additionalProperty: [
      ...(p.sae ? [{ "@type": "PropertyValue", name: "SAE", value: p.sae }] : []),
      ...(p.iso_vg ? [{ "@type": "PropertyValue", name: "ISO VG", value: p.iso_vg }] : []),
      ...p.specs.map((v) => ({ "@type": "PropertyValue", name: "Specification", value: v })),
      ...p.oem_approvals.map((v) => ({ "@type": "PropertyValue", name: "OEM approval", value: v })),
    ],
    offers: prices.length
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "EUR",
          lowPrice: Math.min(...prices).toFixed(2),
          highPrice: Math.max(...prices).toFixed(2),
          offerCount: offers.length,
          availability: p.variants.some((v) => v.in_stock) ? "https://schema.org/InStock" : "https://schema.org/BackOrder",
          offers,
        }
      : undefined,
  };

  const specRows: { label: string; value: React.ReactNode }[] = [
    ...(p.sae ? [{ label: `${t("viscosity")} (SAE)`, value: <span className="font-bold">{p.sae}</span> }] : []),
    ...(p.iso_vg ? [{ label: `${t("viscosity")} (ISO VG)`, value: <span className="font-bold">{p.iso_vg}</span> }] : []),
    ...(catName
      ? [
          {
            label: t("category"),
            value: (
              <Link href={catHref} className="font-semibold text-navy-600 hover:underline">
                {catName}
              </Link>
            ),
          },
        ]
      : []),
    ...(p.base_sku ? [{ label: t("sku"), value: <span className="font-mono text-[13px]">{p.base_sku}</span> }] : []),
    {
      label: t("packsAvailable"),
      value: <span className="font-semibold">{p.variants.map((v) => packLabel(v) || tu("piece")).join(" · ")}</span>,
    },
    ...(p.specs.length ? [{ label: t("specifications"), value: <Chips items={p.specs} /> }] : []),
    ...(p.oem_approvals.length ? [{ label: t("approvals"), value: <Chips items={p.oem_approvals} tone="brand" /> }] : []),
    ...(p.performance.length ? [{ label: t("performance"), value: <Chips items={p.performance} /> }] : []),
  ];

  const header = (
    <div>
      {tx.type && <p className="eyebrow">{tx.type}</p>}
      <h1 className="h-display mt-2 text-[28px] leading-[1.1] text-ink sm:text-4xl">{tx.name}</h1>
      {tx.short && <p className="mt-3 text-[15px] leading-relaxed text-ink/70">{tx.short}</p>}
      {(viscosity || keyApprovals.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {viscosity && (
            <span className="skew-tag bg-navy-700 text-[13px] font-extrabold text-brand-300">
              <span>{viscosity}</span>
            </span>
          )}
          {keyApprovals.map((a) => (
            <span key={a} className="inline-flex items-center gap-1 rounded-lg border border-navy-100 bg-navy-50 px-2 py-1 text-[12px] font-bold text-navy-700">
              <BadgeCheck className="size-3.5 text-navy-500" aria-hidden />
              {a}
            </span>
          ))}
          {p.oem_approvals.length + p.performance.length > keyApprovals.length && (
            <a href="#specifications" className="px-1 text-[12px] font-bold text-navy-500 hover:underline">
              +{p.oem_approvals.length + p.performance.length - keyApprovals.length}
            </a>
          )}
        </div>
      )}
      {p.base_sku && (
        <p className="mt-3 text-[12px] text-muted">
          {t("sku")}: <span className="font-mono">{p.base_sku}</span>
        </p>
      )}
    </div>
  );

  const sections = [
    { id: "description", label: t("description") },
    { id: "specifications", label: t("specifications") },
    { id: "documents", label: t("documents") },
    { id: "expert", label: t("askExpert") },
  ];

  return (
    <>
      <JsonLd data={productLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: tc("breadcrumbHome"), url: absoluteUrl("/", locale) },
          { name: nav("catalog"), url: absoluteUrl("/catalog", locale) },
          ...(catName ? [{ name: catName, url: absoluteUrl(catHref, locale) }] : []),
          { name: tx.name, url: absoluteUrl(href, locale) },
        ])}
      />

      <div className="bg-gradient-to-b from-canvas to-page">
        <div className="container-x pb-12 pt-6 sm:pt-8">
          <Breadcrumbs
            label={a11y("breadcrumbs")}
            className="mb-6"
            items={[
              { name: tc("breadcrumbHome"), href: "/" },
              { name: nav("catalog"), href: "/catalog" },
              ...(catName ? [{ name: catName, href: catHref }] : []),
              { name: tx.name },
            ]}
          />
          <ProductPurchase
            product={s}
            images={images}
            header={header}
            badge={
              category ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-[11.5px] font-bold text-navy-700 shadow-sm ring-1 ring-line backdrop-blur">
                  <CategoryIcon name={category.icon} className="size-3.5" aria-hidden />
                  {catName}
                </span>
              ) : undefined
            }
          />
        </div>
      </div>

      <div className="container-x pb-16">
        <SectionNav items={sections} />
        <div className="mt-8 grid gap-10 lg:grid-cols-12">
          <div className="grid gap-12 lg:col-span-7 xl:col-span-8">
            <section id="description" className="scroll-mt-32" aria-labelledby="h-description">
              <h2 id="h-description" className="text-2xl font-extrabold tracking-tight text-ink">
                {t("description")}
              </h2>
              {tx.description ? (
                <div className="prose-product mt-5 max-w-3xl" dangerouslySetInnerHTML={{ __html: tx.description }} />
              ) : (
                <p className="prose-product mt-5">{tx.short}</p>
              )}
            </section>

            <section id="specifications" className="scroll-mt-32" aria-labelledby="h-specs">
              <h2 id="h-specs" className="text-2xl font-extrabold tracking-tight text-ink">
                {t("technical")}
              </h2>
              <div className="mt-5 overflow-hidden rounded-2xl border border-line">
                <table className="w-full text-left text-[14px]">
                  <tbody className="divide-y divide-line">
                    {specRows.map((r) => (
                      <tr key={r.label} className="align-top odd:bg-canvas/60">
                        <th scope="row" className="w-2/5 px-4 py-3.5 text-[13px] font-semibold text-muted sm:w-1/3 sm:px-5">
                          {r.label}
                        </th>
                        <td className="px-4 py-3.5 text-ink sm:px-5">{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!p.specs.length && !p.oem_approvals.length && !p.performance.length && (
                <p className="mt-3 text-[13px] text-muted">{t("noApprovals")}</p>
              )}
              {p.sae && (
                <Link
                  href={{ pathname: "/catalog", query: { sae: p.sae } }}
                  className="group mt-4 inline-flex items-center gap-1.5 text-[14px] font-bold text-navy-600 hover:text-navy-800"
                >
                  {t("sameViscosity", { sae: p.sae })}
                  <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                </Link>
              )}
            </section>

            <section id="documents" className="scroll-mt-32" aria-labelledby="h-docs">
              <h2 id="h-docs" className="text-2xl font-extrabold tracking-tight text-ink">
                {t("documents")}
              </h2>
              {p.tds_url || p.sds_url ? (
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    { url: p.tds_url, label: t("tds") },
                    { url: p.sds_url, label: t("sds") },
                  ]
                    .filter((d): d is { url: string; label: string } => Boolean(d.url))
                    .map((d) => (
                      <li key={d.url}>
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener"
                          className="group flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-lift"
                        >
                          <span className="grid size-11 place-items-center rounded-xl bg-red-50 text-red-600">
                            <FileText className="size-5" aria-hidden />
                          </span>
                          <span className="flex-1">
                            <span className="block text-[14px] font-bold text-ink">{d.label}</span>
                            <span className="text-[12px] font-semibold uppercase text-muted">PDF</span>
                          </span>
                          <ArrowRight className="size-4 text-navy-400 transition group-hover:translate-x-0.5" aria-hidden />
                        </a>
                      </li>
                    ))}
                </ul>
              ) : (
                <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-dashed border-navy-200 bg-canvas p-5 sm:flex-row sm:items-center">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-navy-500 shadow-card">
                    <FileText className="size-5" aria-hidden />
                  </span>
                  <p className="flex-1 text-[14px] text-ink/75">{t("docsOnRequest")}</p>
                  <Link
                    href="/contact"
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-navy-700 px-4 text-[13px] font-bold text-white transition hover:bg-navy-600"
                  >
                    <Mail className="size-4" aria-hidden />
                    {t("requestDocs")}
                  </Link>
                </div>
              )}
            </section>
          </div>

          <aside className="grid content-start gap-5 lg:sticky lg:top-32 lg:col-span-5 xl:col-span-4">
            <PackCalculator product={s} />
            <AskExpertForm slug={p.slug} productName={tx.name} />
          </aside>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="h-related" className="mt-20">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">{catName}</p>
                <h2 id="h-related" className="h-display mt-2 text-2xl text-ink sm:text-3xl">
                  {t("related")}
                </h2>
              </div>
              <Link href={catHref} className="group inline-flex items-center gap-1.5 text-[14px] font-bold text-navy-600 hover:text-navy-800">
                {t("viewCategory")}
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:gap-5">
              {related.map((r) => (
                <li key={r.slug}>
                  <ProductCard product={r} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
