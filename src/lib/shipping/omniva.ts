import "server-only";
import type { Market } from "@/lib/types";
import {
  CarrierError,
  envSet,
  extractEvents,
  fetchWithTimeout,
  normalizePhone,
  postcodeDigits,
  type CarrierAdapter,
  type CreateShipmentInput,
  type ShipmentRef,
} from "./adapter";
import { statusFromText } from "./tracking";
import type { PickupPoint } from "./types";

/**
 * Omniva integration
 *  - Parcel machine list: public feed https://www.omniva.ee/locations.json (no credentials).
 *  - Shipments, labels, tracking: OMX API with HTTP Basic auth.
 *    Docs: "OMX API manual for customers" https://www.omniva.ee/wp-content/uploads/sites/7/2025/08/OMX-API-Manual-for-Customers_nov.pdf
 *      POST shipments/business-to-client   (mainService PARCEL, deliveryChannel PARCEL_MACHINE | COURIER | POST_OFFICE,
 *                                           measurement.weight kg, length/width/height in metres)
 *      POST shipments/package-labels       (sendAddressCardTo RESPONSE → base64 PDF per barcode)
 *      GET  shipments/{barcode}            (all tracking events of a parcel; rate limit 5 queries / 5 min)
 *    No price-quote and no shipment-cancel endpoint is documented.
 *    Env (Netlify): OMNIVA_USERNAME, OMNIVA_PASSWORD, OMNIVA_CUSTOMER_CODE, optional OMNIVA_API_URL
 *    (test system https://test-omx.omniva.eu/api/v01/omx/), optional OMNIVA_INTEGRATION_AGENT_ID.
 */

export type OmnivaLocker = {
  id: string; // ZIP = offloadPostcode used by the OMX API
  name: string;
  city: string;
  address: string;
  country: Market;
  lat: number | null;
  lng: number | null;
};

type RawLocation = {
  ZIP: string;
  NAME: string;
  TYPE: string;
  A0_NAME: string;
  A1_NAME?: string;
  A2_NAME?: string;
  A3_NAME?: string;
  A5_NAME?: string;
  A7_NAME?: string;
  X_COORDINATE?: string;
  Y_COORDINATE?: string;
};

const LOCATIONS_URL = "https://www.omniva.ee/locations.json";

export async function getOmnivaLockers(country: Market): Promise<OmnivaLocker[]> {
  const res = await fetch(LOCATIONS_URL, { next: { revalidate: 60 * 60 * 12, tags: ["omniva-locations"] } });
  if (!res.ok) throw new Error(`omniva_locations_${res.status}`);
  const data = (await res.json()) as RawLocation[];
  return data
    .filter((l) => l.TYPE === "0" && l.A0_NAME === country)
    .map((l) => {
      const street = [l.A5_NAME, l.A7_NAME].filter(Boolean).join(" ").trim();
      const city = (l.A3_NAME || l.A2_NAME || l.A1_NAME || "").trim();
      return {
        id: l.ZIP,
        name: l.NAME.trim(),
        city,
        address: [street, city].filter(Boolean).join(", "),
        country,
        lat: l.Y_COORDINATE ? Number(l.Y_COORDINATE) : null,
        lng: l.X_COORDINATE ? Number(l.X_COORDINATE) : null,
      };
    })
    .sort((a, b) => a.city.localeCompare(b.city, "lv") || a.name.localeCompare(b.name, "lv"));
}

// ───────────────────────── OMX API ─────────────────────────

const API = () => (process.env.OMNIVA_API_URL || "https://omx.omniva.eu/api/v01/omx/").replace(/\/?$/, "/");
const ENV = ["OMNIVA_USERNAME", "OMNIVA_PASSWORD", "OMNIVA_CUSTOMER_CODE"];

export function omnivaConfigured() {
  return envSet(ENV).length === ENV.length;
}

function authHeaders() {
  const token = Buffer.from(`${process.env.OMNIVA_USERNAME}:${process.env.OMNIVA_PASSWORD}`).toString("base64");
  return {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(process.env.OMNIVA_INTEGRATION_AGENT_ID ? { "X-Integration-Agent-Id": process.env.OMNIVA_INTEGRATION_AGENT_ID } : {}),
  };
}

/** @deprecated kept for backward compatibility — prefer the adapter. */
export class OmnivaError extends CarrierError {}

function requireConfig() {
  if (!omnivaConfigured()) throw new OmnivaError("Omniva API nav konfigurēts (OMNIVA_USERNAME / OMNIVA_PASSWORD / OMNIVA_CUSTOMER_CODE).");
}

async function createShipments(input: CreateShipmentInput): Promise<string[]> {
  requireConfig();
  const r = input.receiver;
  const channel = input.serviceType === "locker" ? "PARCEL_MACHINE" : "COURIER";
  if (channel === "PARCEL_MACHINE" && !input.pickupPoint?.id) throw new OmnivaError("Nav norādīts Omniva pakomāts.");
  const address =
    channel === "PARCEL_MACHINE"
      ? { offloadPostcode: input.pickupPoint!.id, country: r.country }
      : { street: r.street, deliverypoint: r.city, postcode: postcodeDigits(r.postcode), country: r.country };
  const s = input.sender;
  const many = input.parcels.length > 1;
  const body = {
    customerCode: process.env.OMNIVA_CUSTOMER_CODE,
    fileId: `${input.reference}-${Date.now()}`,
    // One OMX shipment per parcel: parcel machines accept single parcels only (consolidation is courier-only).
    shipments: input.parcels.map((p, i) => ({
      partnerShipmentId: many ? `${input.reference}-${i + 1}` : input.reference,
      mainService: "PARCEL",
      deliveryChannel: channel,
      measurement: {
        weight: Math.max(0.1, Math.round(p.weightKg * 1000) / 1000),
        ...(p.l && p.w && p.h ? { length: p.l / 100, width: p.w / 100, height: p.h / 100 } : {}),
      },
      receiverAddressee: {
        personName: r.company ? `${r.company} (${r.name})` : r.name,
        contactMobile: normalizePhone(r.phone, r.country),
        contactEmail: r.email || undefined,
        address,
      },
      senderAddressee: {
        personName: s.name,
        contactMobile: normalizePhone(s.phone, s.country),
        contactEmail: s.email || undefined,
        address: { street: s.street, deliverypoint: s.city, postcode: postcodeDigits(s.postcode), country: s.country },
      },
    })),
  };
  const res = await fetchWithTimeout(`${API()}shipments/business-to-client`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body), cache: "no-store" });
  const json = (await res.json().catch(() => null)) as {
    savedShipments?: { barcode: string; partnerShipmentId?: string }[];
    failedShipments?: unknown[];
    message?: string;
  } | null;
  const barcodes = (json?.savedShipments ?? []).map((x) => x.barcode).filter(Boolean);
  if (!res.ok || barcodes.length === 0) {
    const detail = json?.failedShipments?.length ? JSON.stringify(json.failedShipments).slice(0, 400) : json?.message ?? `HTTP ${res.status}`;
    throw new OmnivaError(`Omniva atteica sūtījumu: ${detail}`);
  }
  return barcodes;
}

async function labels(barcodes: string[]): Promise<Buffer[]> {
  requireConfig();
  const res = await fetchWithTimeout(`${API()}shipments/package-labels`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ customerCode: process.env.OMNIVA_CUSTOMER_CODE, barcodes, sendAddressCardTo: "RESPONSE" }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { successAddressCards?: { barcode: string; fileData?: string; filedata?: string }[] } | null;
  const files = (json?.successAddressCards ?? []).map((c) => c.fileData ?? c.filedata).filter((x): x is string => Boolean(x));
  if (!res.ok || files.length === 0) throw new OmnivaError(`Neizdevās saņemt Omniva uzlīmi (HTTP ${res.status}).`);
  return files.map((f) => Buffer.from(f, "base64"));
}

/** Backward compatible single-parcel helpers. */
export async function getOmnivaLabel(barcode: string): Promise<Buffer> {
  return (await labels([barcode]))[0];
}

export function omnivaTrackingUrl(barcode: string, locale = "lv") {
  const host = locale === "et" ? "www.omniva.ee" : locale === "lt" ? "www.omniva.lt" : "www.omniva.lv";
  return `https://${host}/en/track-and-receive-parcels/?barcode=${encodeURIComponent(barcode)}`;
}

export const omnivaAdapter: CarrierAdapter = {
  code: "omniva",
  name: "Omniva",
  capabilities() {
    const api = omnivaConfigured();
    return {
      code: "omniva",
      api,
      envVars: ENV,
      envSet: envSet(ENV),
      pickupPoints: true,
      tracking: api,
      docs: ["https://www.omniva.ee/wp-content/uploads/sites/7/2025/08/OMX-API-Manual-for-Customers_nov.pdf", LOCATIONS_URL],
    };
  },
  async listPickupPoints(country) {
    const list = await getOmnivaLockers(country);
    return list.map((l): PickupPoint => ({ ...l }));
  },
  async createShipment(input) {
    return { trackingNumbers: await createShipments(input), carrierRef: null };
  },
  async getLabel(ref: ShipmentRef) {
    return labels(ref.trackingNumbers);
  },
  async track(ref: ShipmentRef) {
    requireConfig();
    const events = [];
    // rate limit: 5 queries / 5 minutes → only the first 3 parcels are refreshed
    for (const code of ref.trackingNumbers.slice(0, 3)) {
      const res = await fetchWithTimeout(`${API()}shipments/${encodeURIComponent(code)}`, { headers: authHeaders(), cache: "no-store" });
      if (res.status === 429) throw new OmnivaError("Omniva izsekošanas limits (5 pieprasījumi / 5 min). Mēģiniet vēlāk.");
      if (!res.ok) throw new OmnivaError(`Omniva izsekošana: HTTP ${res.status}`);
      events.push(...extractEvents(await res.json().catch(() => null)));
    }
    events.sort((a, b) => a.at.localeCompare(b.at));
    const last = events[events.length - 1];
    return { status: last ? statusFromText(last.text) : null, events };
  },
};
