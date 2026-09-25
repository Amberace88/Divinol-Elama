import { routing, type Locale } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import type { CompanySettings } from "./settings";

/**
 * Public base URLs. divinol.lv serves lv/lt/en/ru, divinol.ee serves et (+ru/en).
 * During preview (before the domains are connected) everything is served from NEXT_PUBLIC_SITE_URL.
 */
const LV_URL = process.env.NEXT_PUBLIC_SITE_URL_LV || process.env.NEXT_PUBLIC_SITE_URL || "https://divinol.lv";
const EE_URL = process.env.NEXT_PUBLIC_SITE_URL_EE || "";

export function siteUrl(locale: Locale) {
  if (locale === "et" && EE_URL) return EE_URL;
  return LV_URL;
}

const hreflang: Record<Locale, string> = { lv: "lv-LV", et: "et-EE", lt: "lt-LT", en: "en", ru: "ru" };

type Href = Parameters<typeof getPathname>[0]["href"];

/** Absolute URL of a route for a locale (respects domain + localized pathnames). */
export function absoluteUrl(href: Href, locale: Locale) {
  const base = siteUrl(locale);
  let path = getPathname({ href, locale });
  // On its own domain the domain's default locale has no prefix.
  if (locale === "et" && EE_URL) path = path.replace(/^\/et(?=\/|$)/, "") || "/";
  return `${base}${path === "/" ? "" : path}` || base;
}

/** canonical + hreflang alternates for generateMetadata */
export function alternates(href: Href, locale: Locale) {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[hreflang[l]] = absoluteUrl(href, l);
  languages["x-default"] = absoluteUrl(href, "lv");
  return { canonical: absoluteUrl(href, locale), languages };
}

export function organizationJsonLd(locale: Locale, company: CompanySettings) {
  const base = siteUrl(locale);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${base}/#organization`,
        name: "SIA Elama — Divinol",
        legalName: company.name.replace(/"/g, ""),
        url: base,
        logo: `${base}/media/brand/elama-logo.png`,
        email: company.email,
        telephone: company.phone,
        vatID: company.vat_no,
        taxID: company.reg_no,
        address: { "@type": "PostalAddress", streetAddress: company.address, addressCountry: "LV" },
        sameAs: ["https://www.facebook.com/ELDivinol", "https://www.instagram.com/divinol.lv/"],
        brand: { "@type": "Brand", name: "Divinol" },
      },
      {
        "@type": "Store",
        "@id": `${base}/#store`,
        name: "Divinol — ELAMA noliktava",
        image: `${base}/media/brand/hero-barrels.webp`,
        telephone: company.phone,
        email: company.email,
        address: { "@type": "PostalAddress", streetAddress: "Ventspils iela 51", addressLocality: "Rīga", postalCode: "LV-1002", addressCountry: "LV" },
        geo: { "@type": "GeoCoordinates", latitude: 56.9366, longitude: 24.0719 },
        parentOrganization: { "@id": `${base}/#organization` },
      },
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        url: base,
        name: "Divinol",
        inLanguage: locale,
        publisher: { "@id": `${base}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${absoluteUrl("/catalog", locale)}?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
  };
}
