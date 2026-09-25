import { defineRouting } from "next-intl/routing";

export const locales = ["lv", "et", "lt", "en", "ru"] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  lv: "Latviešu",
  et: "Eesti",
  lt: "Lietuvių",
  en: "English",
  ru: "Русский",
};

/**
 * Localized, SEO-friendly pathnames. Keys are the internal route names used in <Link href>.
 * Account/auth pages keep one path in every language (they are not indexed).
 */
export const pathnames = {
  "/": "/",
  "/catalog": { lv: "/katalogs", et: "/kataloog", lt: "/katalogas", en: "/catalog", ru: "/katalog" },
  "/catalog/[category]": {
    lv: "/katalogs/[category]",
    et: "/kataloog/[category]",
    lt: "/katalogas/[category]",
    en: "/catalog/[category]",
    ru: "/katalog/[category]",
  },
  "/product/[slug]": {
    lv: "/produkts/[slug]",
    et: "/toode/[slug]",
    lt: "/produktas/[slug]",
    en: "/product/[slug]",
    ru: "/produkt/[slug]",
  },
  "/oil-finder": { lv: "/ellas-izvele", et: "/olivalik", lt: "/alyvos-parinkimas", en: "/oil-finder", ru: "/podbor-masla" },
  "/calculators": { lv: "/kalkulatori", et: "/kalkulaatorid", lt: "/skaiciuokles", en: "/calculators", ru: "/kalkulyatory" },
  "/business": { lv: "/uznemumiem", et: "/ettevotetele", lt: "/imonems", en: "/business", ru: "/dlya-biznesa" },
  "/about": { lv: "/par-mums", et: "/meist", lt: "/apie-mus", en: "/about", ru: "/o-nas" },
  "/contact": { lv: "/kontakti", et: "/kontakt", lt: "/kontaktai", en: "/contact", ru: "/kontakty" },
  "/downloads": { lv: "/katalogi", et: "/kataloogid", lt: "/katalogai", en: "/downloads", ru: "/katalogi" },
  "/cart": { lv: "/grozs", et: "/ostukorv", lt: "/krepselis", en: "/cart", ru: "/korzina" },
  "/checkout": { lv: "/noformet", et: "/kassa", lt: "/apmokejimas", en: "/checkout", ru: "/oformlenie" },
  "/checkout/success": {
    lv: "/noformet/paldies",
    et: "/kassa/aitah",
    lt: "/apmokejimas/aciu",
    en: "/checkout/success",
    ru: "/oformlenie/spasibo",
  },
  "/terms": { lv: "/noteikumi", et: "/tingimused", lt: "/taisykles", en: "/terms", ru: "/usloviya" },
  "/privacy": { lv: "/privatuma-politika", et: "/privaatsus", lt: "/privatumas", en: "/privacy", ru: "/konfidentsialnost" },
  "/delivery": { lv: "/piegade", et: "/tarne", lt: "/pristatymas", en: "/delivery", ru: "/dostavka" },
  "/login": "/login",
  "/register": "/register",
  "/forgot-password": "/forgot-password",
  "/reset-password": "/reset-password",
  "/account": "/account",
  "/account/orders": "/account/orders",
  "/account/orders/[id]": "/account/orders/[id]",
  "/account/invoices": "/account/invoices",
  "/account/profile": "/account/profile",
  "/account/addresses": "/account/addresses",
  "/account/business": "/account/business",
} as const;

export const routing = defineRouting({
  locales,
  defaultLocale: "lv",
  localePrefix: "as-needed",
  localeDetection: false,
  pathnames,
  domains: [
    { domain: "divinol.lv", defaultLocale: "lv", locales: ["lv", "lt", "en", "ru"] },
    { domain: "divinol.ee", defaultLocale: "et", locales: ["et", "ru", "en"] },
  ],
});
