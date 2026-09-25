import "server-only";
import type { Market } from "@/lib/types";

/**
 * Omniva integration
 *  - Parcel machine list: public feed https://www.omniva.ee/locations.json (no credentials).
 *  - Shipments & labels: OMX API (https://omx.omniva.eu/api/v01/omx/) with HTTP Basic auth.
 *    Credentials come from the Omniva account manager and are set as Netlify env vars:
 *    OMNIVA_USERNAME, OMNIVA_PASSWORD, OMNIVA_CUSTOMER_CODE (optional OMNIVA_API_URL for the test system).
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

const API = (process.env.OMNIVA_API_URL || "https://omx.omniva.eu/api/v01/omx/").replace(/\/?$/, "/");

export function omnivaConfigured() {
  return Boolean(process.env.OMNIVA_USERNAME && process.env.OMNIVA_PASSWORD && process.env.OMNIVA_CUSTOMER_CODE);
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

export type OmnivaSender = {
  name: string;
  phone: string;
  email?: string;
  street: string;
  city: string;
  postcode: string;
  country: Market;
};

export type OmnivaShipmentInput = {
  orderNumber: string;
  channel: "PARCEL_MACHINE" | "COURIER";
  weightKg: number;
  receiver: {
    name: string;
    phone?: string | null;
    email?: string | null;
    country: Market;
    lockerZip?: string | null;
    street?: string | null;
    city?: string | null;
    postcode?: string | null;
  };
  sender: OmnivaSender;
};

export class OmnivaError extends Error {}

function normalizePhone(p: string | null | undefined, country: Market) {
  if (!p) return undefined;
  const digits = p.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  const prefix = country === "EE" ? "+372" : country === "LT" ? "+370" : "+371";
  return `${prefix}${digits}`;
}

function postcodeDigits(p: string | null | undefined) {
  return (p ?? "").replace(/\D/g, "");
}

export async function createOmnivaShipment(input: OmnivaShipmentInput): Promise<string> {
  if (!omnivaConfigured()) throw new OmnivaError("Omniva API nav konfigurēts (OMNIVA_USERNAME / OMNIVA_PASSWORD / OMNIVA_CUSTOMER_CODE).");
  const r = input.receiver;
  const address =
    input.channel === "PARCEL_MACHINE"
      ? { offloadPostcode: r.lockerZip, country: r.country }
      : { street: r.street, deliverypoint: r.city, postcode: postcodeDigits(r.postcode), country: r.country };
  const body = {
    customerCode: process.env.OMNIVA_CUSTOMER_CODE,
    fileId: `${input.orderNumber}-${Date.now()}`,
    shipments: [
      {
        partnerShipmentId: input.orderNumber,
        mainService: "PARCEL",
        deliveryChannel: input.channel,
        measurement: { weight: Math.max(0.1, Math.round(input.weightKg * 1000) / 1000) },
        receiverAddressee: {
          personName: r.name,
          contactMobile: normalizePhone(r.phone, r.country),
          contactEmail: r.email || undefined,
          address,
        },
        senderAddressee: {
          personName: input.sender.name,
          contactMobile: normalizePhone(input.sender.phone, input.sender.country),
          contactEmail: input.sender.email,
          address: {
            street: input.sender.street,
            deliverypoint: input.sender.city,
            postcode: postcodeDigits(input.sender.postcode),
            country: input.sender.country,
          },
        },
      },
    ],
  };
  const res = await fetch(`${API}shipments/business-to-client`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body), cache: "no-store" });
  const json = (await res.json().catch(() => null)) as {
    resultCode?: string;
    savedShipments?: { barcode: string }[];
    failedShipments?: unknown[];
    message?: string;
  } | null;
  if (!res.ok || !json?.savedShipments?.[0]?.barcode) {
    const detail = json?.failedShipments?.length ? JSON.stringify(json.failedShipments).slice(0, 400) : json?.message ?? `HTTP ${res.status}`;
    throw new OmnivaError(`Omniva atteica sūtījumu: ${detail}`);
  }
  return json.savedShipments[0].barcode;
}

export async function getOmnivaLabel(barcode: string): Promise<Buffer> {
  if (!omnivaConfigured()) throw new OmnivaError("Omniva API nav konfigurēts.");
  const res = await fetch(`${API}shipments/package-labels`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ customerCode: process.env.OMNIVA_CUSTOMER_CODE, barcodes: [barcode], sendAddressCardTo: "RESPONSE" }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { successAddressCards?: { barcode: string; fileData?: string; filedata?: string }[] } | null;
  const card = json?.successAddressCards?.[0];
  const data = card?.fileData ?? card?.filedata;
  if (!res.ok || !data) throw new OmnivaError(`Neizdevās saņemt uzlīmi (HTTP ${res.status}).`);
  return Buffer.from(data, "base64");
}

export function omnivaTrackingUrl(barcode: string, locale = "lv") {
  const host = locale === "et" ? "www.omniva.ee" : locale === "lt" ? "www.omniva.lt" : "www.omniva.lv";
  return `https://${host}/en/track-and-receive-parcels/?barcode=${encodeURIComponent(barcode)}`;
}
