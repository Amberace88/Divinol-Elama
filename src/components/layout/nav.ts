export type HeaderCategory = { slug: string; icon: string; name: string };

/** Primary navigation (after the "Products" mega-menu trigger). Keys live in common `nav.*`. */
export const NAV_LINKS = [
  { href: "/oil-finder", key: "oilFinder" },
  { href: "/calculators", key: "calculators" },
  { href: "/business", key: "business" },
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
] as const;

export const POPULAR_SEARCHES = ["5W-30", "VW 504", "dexos2", "MB 229.51", "15W-40", "HLP 46", "ATF", "Lithogrease"];

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
