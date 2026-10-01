/**
 * Redirects for URLs of the previous websites (WordPress/WooCommerce on divinol.lv, the old catalogue on divinol.ee),
 * so that Google results and old bookmarks land on the matching page of the new shop instead of a 404.
 */
export type SiteLang = "lv" | "et";

/** Static path → new localized path (unprefixed default locale of the domain). */
const STATIC: Record<SiteLang, [RegExp, string][]> = {
  lv: [
    [/^\/(product-category|e-veikals|veikals|shop|tilpums|zimols|product-tag|produkta-kategorija)(\/.*)?$/, "/katalogs"],
    [/^\/(cart|grozs-2)\/?$/, "/grozs"],
    [/^\/checkout(\/.*)?$/, "/grozs"],
    [/^\/(my-account|mans-konts)(\/.*)?$/, "/account"],
    [/^\/(privatuma-politika-un-noteikumi|privacy-policy|lietosanas-noteikumi)\/?$/, "/privatuma-politika"],
    [/^\/(sakums|home)\/?$/, "/"],
    [/^\/(ellas|smervielas|kopsana|kimija|viaform)(\/.*)?$/, "/katalogs"],
  ],
  et: [
    [/^\/catalog(\/.*)?$/, "/kataloog"],
    [/^\/(product-category|e-pood|pood|shop|tooted)(\/.*)?$/, "/kataloog"],
    [/^\/(cart)\/?$/, "/ostukorv"],
    [/^\/(my-account)(\/.*)?$/, "/account"],
  ],
};

export function siteLangForHost(host: string | null): SiteLang {
  return host && /(^|\.)divinol\.ee$/i.test(host.split(":")[0]) ? "et" : "lv";
}

/** Returns the new path for an old URL, "product:<slug>" for old product pages, or null when the path is not legacy. */
export function legacyTarget(pathname: string, lang: SiteLang): string | null {
  const m = /^\/product\/([^/]+)\/?$/.exec(pathname);
  if (m) return `product:${decodeURIComponent(m[1])}`;
  for (const [re, to] of STATIC[lang]) if (re.test(pathname)) return to;
  return null;
}

/** Best match for an old product slug among the new slugs (exact → without pack size → longest shared prefix). */
export function matchProductSlug(old: string, slugs: string[]): string | null {
  const o = old.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (slugs.includes(o)) return o;
  // "divinol-hlp-iso-32-5l", "divinol-bike-racer-4t-10w-40-5l-motociklu-ella" → drop the pack size and anything after it
  const base = o.replace(/-\d+(?:[.,]\d+)?(?:l|kg|ml|g|gab)(?:-.*)?$/, "");
  if (slugs.includes(base)) return base;
  let best: string | null = null;
  for (const s of slugs) {
    if ((base.startsWith(s + "-") || s.startsWith(base + "-") || base === s) && (!best || s.length > best.length)) best = s;
  }
  return best;
}
