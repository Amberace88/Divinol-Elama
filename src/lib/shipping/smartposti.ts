import "server-only";
import type { Market } from "@/lib/types";
import { CarrierError, fetchWithTimeout, type CarrierAdapter } from "./adapter";
import type { PickupPoint } from "./types";

/**
 * SmartPosti (Itella) — pickup-point list only; shipments run in manual mode.
 *   Public locations feed used by SmartPosti's official e-shop plugins (https://github.com/ItellaPlugins/itella-api,
 *   src/Locations/PickupPoints.php): https://delivery.plugins.itella.com/api/locations?countryCode=LV (verified 2026-09-25).
 *   Shipment creation goes through the Pakettikauppa-based Itella API that requires a contract (user / secret / contract
 *   number) — not implemented; the admin enters the tracking number and uploads the label PDF.
 */

const FEED = "https://delivery.plugins.itella.com/api/locations";

type Loc = {
  id: number | string;
  pupCode?: string;
  type?: string;
  postalCode?: string;
  countryCode?: string;
  publicName?: Record<string, string>;
  address?: Record<string, { address?: string; municipality?: string; postalCodeName?: string; postalCode?: string }>;
  location?: { lat?: number; lon?: number };
  availability?: string;
};

const pick = <T,>(m: Record<string, T> | undefined, locale: string) => (m ? m[locale] ?? m.en ?? Object.values(m)[0] : undefined);

export const smartpostiAdapter: CarrierAdapter = {
  code: "smartposti",
  name: "SmartPosti",
  capabilities() {
    return {
      code: "smartposti",
      api: false,
      envVars: [],
      envSet: [],
      pickupPoints: true,
      tracking: false,
      docs: ["https://github.com/ItellaPlugins/itella-api", FEED],
      note: "Sūtījumu API pieejams tikai ar līgumu (Pakettikauppa) — manuālais režīms.",
    };
  },
  async listPickupPoints(country: Market) {
    const res = await fetchWithTimeout(`${FEED}?countryCode=${country}`, { next: { revalidate: 60 * 60 * 12, tags: ["smartposti-points"] } });
    if (!res.ok) throw new CarrierError(`SmartPosti punkti: HTTP ${res.status}`);
    const json = (await res.json()) as { locations?: Loc[] };
    const locale = country.toLowerCase();
    return (json.locations ?? [])
      .filter((l) => (l.countryCode ?? country) === country && l.availability !== "CLOSED" && ["LOCKER", "SMARTPOST", "PICKUPPOINT"].includes(l.type ?? "LOCKER"))
      .map((l): PickupPoint => {
        const a = pick(l.address, locale) ?? {};
        const city = (a.municipality || a.postalCodeName || "").trim();
        return {
          id: String(l.pupCode ?? l.id),
          name: (pick(l.publicName, locale) ?? String(l.id)).trim(),
          city,
          address: [a.address, city].filter(Boolean).join(", "),
          postcode: a.postalCode ?? l.postalCode,
          country,
          lat: l.location?.lat ?? null,
          lng: l.location?.lon ?? null,
        };
      })
      .sort((a, b) => a.city.localeCompare(b.city, "lv") || a.name.localeCompare(b.name, "lv"));
  },
};
