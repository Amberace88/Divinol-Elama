import type { Market } from "@/lib/types";

/**
 * TEMPORARY placeholder data for the parcel-locker picker.
 * Will be replaced by a live Omniva / DPD / Smartpost locker feed — keep all locker logic inside
 * `ParcelLockerPicker` + this file so the swap is local.
 */
export type LockerProvider = "omniva" | "dpd" | "smartpost";

export const LOCKER_PROVIDERS: { id: LockerProvider; name: string; markets: Market[] }[] = [
  { id: "omniva", name: "Omniva", markets: ["LV", "EE", "LT"] },
  { id: "dpd", name: "DPD Pickup", markets: ["LV", "EE", "LT"] },
  { id: "smartpost", name: "Smartpost", markets: ["EE"] },
];

export type ParcelLocker = {
  provider: LockerProvider;
  /** provider's locker id once a live feed exists; null for free-text entries */
  id: string | null;
  name: string;
  city?: string;
  address?: string;
};

/** Larger towns per market, used as typeahead suggestions until the live feed is connected. */
export const LOCKER_CITIES: Record<Market, string[]> = {
  LV: ["Rīga", "Daugavpils", "Liepāja", "Jelgava", "Jūrmala", "Ventspils", "Rēzekne", "Valmiera", "Jēkabpils", "Ogre", "Tukums", "Cēsis", "Salaspils", "Kuldīga", "Sigulda", "Bauska", "Dobele", "Talsi", "Limbaži", "Madona"],
  EE: ["Tallinn", "Tartu", "Narva", "Pärnu", "Kohtla-Järve", "Viljandi", "Maardu", "Rakvere", "Kuressaare", "Sillamäe", "Valga", "Võru", "Jõhvi", "Haapsalu", "Keila", "Paide"],
  LT: ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys", "Alytus", "Marijampolė", "Mažeikiai", "Jonava", "Utena", "Kėdainiai", "Telšiai", "Tauragė", "Ukmergė", "Visaginas", "Palanga"],
};

export function searchLockers(market: Market, provider: LockerProvider, query: string): ParcelLocker[] {
  const q = query
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  const providerName = LOCKER_PROVIDERS.find((p) => p.id === provider)?.name ?? provider;
  return LOCKER_CITIES[market]
    .filter((city) =>
      !q
        ? true
        : city
            .normalize("NFKD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase()
            .includes(q),
    )
    .slice(0, 8)
    .map((city) => ({ provider, id: null, name: `${providerName} — ${city}`, city }));
}
