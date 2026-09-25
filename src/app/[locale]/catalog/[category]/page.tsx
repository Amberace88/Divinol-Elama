import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getCategories, getCategory, t18 } from "@/lib/catalog";
import { absoluteUrl, alternates } from "@/lib/seo";
import { breadcrumbJsonLd, catalogData, itemListJsonLd } from "@/lib/shop/catalog-page";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { CatalogHero } from "@/components/catalog/CatalogHero";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { JsonLd } from "@/components/ui/JsonLd";

export const revalidate = 3600;

type Props = { params: Promise<{ locale: string; category: string }> };

export async function generateStaticParams() {
  const categories = await getCategories();
  return routing.locales.flatMap((locale) => categories.map((c) => ({ locale, category: c.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: l, category: slug } = await params;
  const locale = l as Locale;
  const category = await getCategory(slug);
  if (!category) return {};
  const t = await getTranslations({ locale, namespace: "catalog" });
  const text = t18(category.i18n, locale);
  const name = text?.name ?? slug;
  const title = t("metaTitleCategory", { name });
  const description = `${text?.description ?? ""} ${t("metaSuffix")}`.trim();
  const href = { pathname: "/catalog/[category]" as const, params: { category: slug } };
  return {
    title,
    description,
    alternates: alternates(href, locale),
    // keep the branded opengraph-image unless the category has its own picture
    ...(category.image ? { openGraph: { title, description, url: absoluteUrl(href, locale), images: [{ url: category.image, alt: name }] } } : {}),
  };
}

export default async function CategoryPage({ params }: Props) {
  const { locale: l, category: slug } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const category = await getCategory(slug);
  if (!category) notFound();
  const [t, nav, a11y, data] = await Promise.all([
    getTranslations("catalog"),
    getTranslations("nav"),
    getTranslations("a11y"),
    catalogData(locale),
  ]);
  const text = t18(category.i18n, locale);
  const name = text?.name ?? slug;
  const items = data.summaries.filter((p) => p.category === slug);
  const href = { pathname: "/catalog/[category]" as const, params: { category: slug } };
  const saes = [...new Set(items.map((p) => p.sae).filter(Boolean))];
  const others = data.categoryLinks.filter((c) => c.slug !== slug);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("breadcrumbHome"), url: absoluteUrl("/", locale) },
          { name: nav("catalog"), url: absoluteUrl("/catalog", locale) },
          { name, url: absoluteUrl(href, locale) },
        ])}
      />
      <JsonLd data={itemListJsonLd(name, items, locale)} />
      <CatalogHero
        eyebrow={nav("catalog")}
        title={name}
        intro={text?.description}
        icon={category.icon}
        crumbs={[{ name: t("breadcrumbHome"), href: "/" }, { name: nav("catalog"), href: "/catalog" }, { name }]}
        crumbsLabel={a11y("breadcrumbs")}
        stats={[t("results", { count: items.length }), ...saes.slice(0, 5).map(String)]}
      />
      <div className="container-x py-10 sm:py-12">
        <CatalogBrowser products={items} categories={data.categoryLinks} activeCategory={slug} totalCount={items.length} />
      </div>

      {text?.seo_text && (
        <section className="container-x pb-12">
          <div className="rounded-3xl border border-line bg-canvas p-6 sm:p-10">
            <h2 className="text-xl font-extrabold tracking-tight text-ink">
              {t("aboutCategory")}: {name}
            </h2>
            <div className="prose-product mt-4 max-w-3xl" dangerouslySetInnerHTML={{ __html: text.seo_text }} />
          </div>
        </section>
      )}

      <nav aria-label={t("otherCategories")} className="container-x pb-16">
        <h2 className="mb-4 text-[13px] font-extrabold uppercase tracking-[0.12em] text-muted">{t("otherCategories")}</h2>
        <ul className="flex flex-wrap gap-2">
          {others.map((c) => (
            <li key={c.slug}>
              <Link
                href={{ pathname: "/catalog/[category]", params: { category: c.slug } }}
                className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-bold text-ink/80 transition hover:border-navy-300 hover:text-navy-700"
              >
                <CategoryIcon name={c.icon} className="size-4 text-navy-400" aria-hidden />
                {c.name}
                <span className="text-muted">{c.count}</span>
                <ArrowUpRight className="size-3.5 opacity-0 transition group-hover:opacity-100" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
