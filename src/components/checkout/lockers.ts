/**
 * Parcel lockers: live pickup-point feeds via /api/parcel-lockers?provider=… . Which providers are offered is set in the
 * admin (Sūtījumi → Tarifi → Pārvadātāji → "Piedāvāt klientiem") and served by /api/parcel-lockers/providers.
 * The customer price is the same for every provider (settings → parcel_locker), so place_order is unchanged.
 */
export type LockerProvider = "omniva" | "dpd" | "venipak" | "smartposti" | (string & {});

export type LockerProviderOption = { id: LockerProvider; name: string; count: number };

/**
 * Shape stored on the order (orders.shipping_point) — unchanged, `provider` tells which network the `id` belongs to
 * (Omniva ZIP for the OMX API, DPD pudoId, Venipak / SmartPosti point id).
 */
export type ParcelLocker = {
  provider: LockerProvider;
  id: string | null;
  name: string;
  city?: string;
  address?: string;
};

export type LockerOption = {
  id: string;
  name: string;
  city: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

export function normalize(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function searchLockerOptions(list: LockerOption[], query: string, limit = 40): LockerOption[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return list.slice(0, limit);
  const scored: { l: LockerOption; s: number }[] = [];
  for (const l of list) {
    const hay = normalize(`${l.name} ${l.address} ${l.city}`);
    if (!terms.every((t) => hay.includes(t))) continue;
    const city = normalize(l.city);
    const s = terms.reduce((acc, t) => acc + (city.startsWith(t) ? 3 : 0) + (normalize(l.name).startsWith(t) ? 2 : 0), 0);
    scored.push({ l, s });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.l);
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
