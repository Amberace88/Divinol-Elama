import "server-only";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { absoluteUrl, alternates, breadcrumbJsonLd } from "@/lib/seo";
import type { Locale } from "@/i18n/routing";

type RouteKey = Parameters<typeof alternates>[0];

/** Standard metadata for a content page: title/description from messages + canonical/hreflang + OG. */
export async function pageMetadata(
  locale: Locale,
  route: RouteKey,
  keys: { title: string; description: string },
  image = "/media/brand/hero-barrels.webp",
): Promise<Metadata> {
  const t = await getTranslations({ locale });
  const title = t(keys.title);
  const description = t(keys.description);
  return {
    title,
    description,
    alternates: alternates(route, locale),
    openGraph: {
      title,
      description,
      url: absoluteUrl(route, locale),
      type: "website",
      images: [{ url: image }],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** BreadcrumbList JSON-LD for "Home › Page". */
export async function pageBreadcrumbLd(locale: Locale, route: RouteKey, name: string) {
  const t = await getTranslations({ locale, namespace: "nav" });
  return breadcrumbJsonLd([
    { name: t("home"), url: absoluteUrl("/", locale) },
    { name, url: absoluteUrl(route, locale) },
  ]);
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}
