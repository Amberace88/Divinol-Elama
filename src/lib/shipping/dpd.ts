import "server-only";
import type { Market } from "@/lib/types";
import {
  CarrierError,
  envSet,
  extractEvents,
  fetchWithTimeout,
  isPdf,
  normalizePhone,
  postcodeDigits,
  type CarrierAdapter,
  type CreateShipmentInput,
  type ShipmentRef,
} from "./adapter";
import { statusFromText } from "./tracking";
import type { PickupPoint } from "./types";

/**
 * DPD Baltic (Latvia) — eserviss REST API v1.
 * Docs: "DPD API documentation v.1.2.1" https://www.dpd.com/wp-content/uploads/sites/235/2023/04/DPD-API-documentation-v1-2-1.pdf
 *   Base URL LV: https://eserviss.dpd.lv/api/v1 (sandbox https://sandbox-eserviss.dpd.lv/api/v1)
 *   Auth: "Authorization: Bearer <token>" — the token is created once (POST /auth/tokens with Basic auth, or in the
 *         eserviss portal) and stored as the Netlify env var DPD_API_TOKEN.
 *   POST /shipments           array of shipments; receiverAddress.pudoId = Pickup point id for "DPD Pickup"
 *   POST /shipments/labels    { shipmentIds, downloadLabel, labelFormat: "application/pdf", paperSize }
 *   GET  /lockers             Pickup points (requires the token), Accept: application/json+fulldata
 *   GET  /status/tracking     ?pknr=a|b&detail=0&show_all=1&lang=lv
 * No price-quote endpoint (GET /services only lists services).
 * Env: DPD_API_TOKEN, optional DPD_API_URL, optional DPD_COURIER_SERVICE (default "DPD CLASSIC" for companies, "DPD B2C" for private persons).
 */

const ENV = ["DPD_API_TOKEN"];
const BASE = () => (process.env.DPD_API_URL || "https://eserviss.dpd.lv/api/v1").replace(/\/+$/, "");

export function dpdConfigured() {
  return envSet(ENV).length === ENV.length;
}

function headers(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${process.env.DPD_API_TOKEN}`, "Content-Type": "application/json", Accept: "application/json", ...extra };
}

function requireConfig() {
  if (!dpdConfigured()) throw new CarrierError("DPD API nav konfigurēts (DPD_API_TOKEN).");
}

async function errorText(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as { title?: string; detail?: unknown; message?: string };
    const detail = typeof j.detail === "string" ? j.detail : j.detail ? JSON.stringify(j.detail) : "";
    return [j.title ?? j.message, detail].filter(Boolean).join(": ").slice(0, 400) || `HTTP ${res.status}`;
  } catch {
    return text.slice(0, 300) || `HTTP ${res.status}`;
  }
}

type RawLocker = {
  id: string;
  name?: string;
  lockerType?: string;
  address?: { street?: string; city?: string; postalCode?: string; country?: string; latLong?: [number, number] | number[] };
};

export const dpdAdapter: CarrierAdapter = {
  code: "dpd",
  name: "DPD",
  capabilities() {
    const api = dpdConfigured();
    return {
      code: "dpd",
      api,
      envVars: ENV,
      envSet: envSet(ENV),
      pickupPoints: api,
      tracking: api,
      docs: ["https://www.dpd.com/wp-content/uploads/sites/235/2023/04/DPD-API-documentation-v1-2-1.pdf"],
      note: api ? undefined : "Pickup punktu saraksts DPD API pieejams tikai ar atslēgu.",
    };
  },

  async listPickupPoints(country: Market) {
    requireConfig();
    const res = await fetchWithTimeout(`${BASE()}/lockers?countryCode=${country}`, {
      headers: headers({ Accept: "application/json+fulldata" }),
      next: { revalidate: 60 * 60 * 12, tags: ["dpd-lockers"] },
    });
    if (!res.ok) throw new CarrierError(`DPD Pickup punkti: ${await errorText(res)}`);
    const data = (await res.json()) as RawLocker[];
    return (Array.isArray(data) ? data : [])
      .filter((l) => l.id && (!l.address?.country || l.address.country === country))
      .map((l): PickupPoint => {
        const a = l.address ?? {};
        const ll = Array.isArray(a.latLong) ? a.latLong : [];
        return {
          id: l.id,
          name: (l.name ?? l.id).trim(),
          city: (a.city ?? "").trim(),
          address: [a.street, a.city].filter(Boolean).join(", "),
          postcode: a.postalCode ?? undefined,
          country,
          lat: ll[0] != null ? Number(ll[0]) : null,
          lng: ll[1] != null ? Number(ll[1]) : null,
          meta: { lockerType: l.lockerType ?? null },
        };
      })
      .sort((a, b) => a.city.localeCompare(b.city, "lv") || a.name.localeCompare(b.name, "lv"));
  },

  async createShipment(input: CreateShipmentInput) {
    requireConfig();
    const r = input.receiver;
    const s = input.sender;
    const locker = input.serviceType === "locker";
    if (locker && !input.pickupPoint?.id) throw new CarrierError("Nav norādīts DPD Pickup punkts.");
    const serviceAlias = locker ? "DPD Pickup" : process.env.DPD_COURIER_SERVICE || (r.company ? "DPD CLASSIC" : "DPD B2C");
    const pp = input.pickupPoint;
    const body = [
      {
        senderAddress: {
          name: s.name,
          email: s.email || undefined,
          phone: normalizePhone(s.phone, s.country),
          street: s.street,
          city: s.city,
          postalCode: postcodeDigits(s.postcode),
          country: s.country,
        },
        receiverAddress: {
          name: r.company ? `${r.company} (${r.name})`.slice(0, 70) : r.name,
          email: r.email || undefined,
          phone: normalizePhone(r.phone, r.country),
          street: locker ? pp?.address?.split(",")[0] ?? r.street ?? "" : r.street,
          city: locker ? pp?.city || r.city || "" : r.city,
          postalCode: postcodeDigits(locker ? pp?.postcode ?? r.postcode : r.postcode),
          country: r.country,
          ...(locker ? { pudoId: pp!.id } : {}),
        },
        service: { serviceAlias },
        parcels: input.parcels.map((p, i) => ({ weight: Math.max(0.1, Math.round(p.weightKg * 100) / 100), mpsReferences: [`${input.reference}-${i + 1}`] })),
        shipmentReferences: [input.reference],
      },
    ];
    const res = await fetchWithTimeout(`${BASE()}/shipments`, { method: "POST", headers: headers(), body: JSON.stringify(body), cache: "no-store" });
    if (!res.ok) throw new CarrierError(`DPD atteica sūtījumu: ${await errorText(res)}`);
    const json = (await res.json().catch(() => null)) as unknown;
    const first = (Array.isArray(json) ? json[0] : json) as { id?: string; parcelNumbers?: string[] } | null;
    if (!first?.id || !first.parcelNumbers?.length) throw new CarrierError("DPD atbildē nav paku numuru.");
    return { trackingNumbers: first.parcelNumbers, carrierRef: first.id };
  },

  async getLabel(ref: ShipmentRef) {
    requireConfig();
    const res = await fetchWithTimeout(`${BASE()}/shipments/labels`, {
      method: "POST",
      headers: headers({ Accept: "application/pdf, application/json" }),
      body: JSON.stringify({
        ...(ref.carrierRef ? { shipmentIds: [ref.carrierRef] } : { parcelNumbers: ref.trackingNumbers }),
        downloadLabel: true,
        emailLabel: false,
        labelFormat: "application/pdf",
        paperSize: process.env.DPD_LABEL_PAPER === "A4" ? "A4" : "A6",
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new CarrierError(`DPD uzlīme: ${await errorText(res)}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (isPdf(buf)) return [buf];
    // JSON variant: { pages: [{ binaryData: "<base64>" }] }
    try {
      const j = JSON.parse(buf.toString("utf8")) as { pages?: { binaryData?: string }[]; binaryData?: string };
      const parts = [j.binaryData, ...(j.pages ?? []).map((p) => p.binaryData)].filter((x): x is string => Boolean(x));
      const pdfs = parts.map((p) => Buffer.from(p, "base64")).filter(isPdf);
      if (pdfs.length) return pdfs;
    } catch {
      /* fallthrough */
    }
    throw new CarrierError("DPD neatgrieza PDF uzlīmi.");
  },

  async track(ref: ShipmentRef) {
    requireConfig();
    const pknr = ref.trackingNumbers.slice(0, 30).join("|");
    const res = await fetchWithTimeout(`${BASE()}/status/tracking?pknr=${encodeURIComponent(pknr)}&detail=0&show_all=1&lang=lv`, { headers: headers(), cache: "no-store" });
    if (!res.ok) throw new CarrierError(`DPD izsekošana: ${await errorText(res)}`);
    const events = extractEvents(await res.json().catch(() => null));
    const last = events[events.length - 1];
    return { status: last ? statusFromText(last.text) : null, events };
  },
};
