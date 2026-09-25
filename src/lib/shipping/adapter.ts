import "server-only";
import type { Market } from "@/lib/types";
import type { CarrierCapabilities, CarrierCode, PickupPoint, ServiceType, ShipmentStatus } from "./types";

/**
 * Common carrier adapter interface. Every carrier implements what its official API really offers; carriers
 * without a documented public API run in "manual mode" (the admin enters the tracking number and may upload
 * the label PDF) — see registry.ts.
 */

export type Party = {
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  street?: string | null;
  city?: string | null;
  postcode?: string | null;
  country: Market;
};

export type ShipmentParcel = { weightKg: number; l?: number | null; w?: number | null; h?: number | null };

export type CreateShipmentInput = {
  /** our reference (order number) */
  reference: string;
  serviceType: ServiceType;
  serviceCode: string;
  parcels: ShipmentParcel[];
  receiver: Party;
  pickupPoint?: (Partial<PickupPoint> & { id: string }) | null;
  sender: Party;
};

export type CreateShipmentResult = {
  trackingNumbers: string[];
  /** carrier-side id needed later for labels / cancellation */
  carrierRef?: string | null;
};

export type ShipmentRef = { trackingNumbers: string[]; carrierRef?: string | null };

export type TrackingEvent = { at: string; text: string; location?: string | null };
export type TrackingResult = { status: ShipmentStatus | null; events: TrackingEvent[] };

export type AdapterContext = {
  /** persistent counter (Venipak pack / manifest numbers) */
  nextSerial: (key: string) => Promise<number>;
};

export interface CarrierAdapter {
  code: CarrierCode;
  name: string;
  capabilities(): CarrierCapabilities;
  listPickupPoints?(country: Market): Promise<PickupPoint[]>;
  createShipment?(input: CreateShipmentInput, ctx: AdapterContext): Promise<CreateShipmentResult>;
  /** one or more PDF files (merged by the caller) */
  getLabel?(ref: ShipmentRef): Promise<Buffer[]>;
  track?(ref: ShipmentRef): Promise<TrackingResult>;
  /**
   * Live price quote. None of the Baltic carrier APIs we integrate documents a quoting endpoint
   * (Omniva OMX, DPD eserviss, Venipak) — comparison therefore uses the rate cards ("cenrāža cena").
   */
  quote?(input: CreateShipmentInput): Promise<number | null>;
}

export class CarrierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CarrierError";
  }
}

// ───────────────────────── helpers ─────────────────────────

export function normalizePhone(p: string | null | undefined, country: Market) {
  if (!p) return undefined;
  const digits = p.replace(/[^\d+]/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  const prefix = country === "EE" ? "+372" : country === "LT" ? "+370" : "+371";
  return `${prefix}${digits}`;
}

export function postcodeDigits(p: string | null | undefined) {
  return (p ?? "").replace(/\D/g, "");
}

export async function fetchWithTimeout(url: string, init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {}, ms = 20000) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (e) {
    const msg = e instanceof Error && e.name === "TimeoutError" ? "pārvadātāja serveris neatbild (taimauts)" : "neizdevās sazināties ar pārvadātāju";
    throw new CarrierError(msg);
  }
}

export function isPdf(buf: Buffer) {
  return buf.length > 4 && buf.subarray(0, 4).toString("latin1") === "%PDF";
}

/**
 * Tolerant extraction of tracking events from a carrier JSON response whose exact schema is not fully documented:
 * walks the tree and collects objects that carry a date-like and a text-like field.
 */
export function extractEvents(json: unknown): TrackingEvent[] {
  const out: TrackingEvent[] = [];
  const dateKeys = ["eventDate", "eventTime", "dateTime", "date", "timestamp", "time", "created", "statusDate"];
  const textKeys = ["eventName", "eventDescription", "description", "status", "statusText", "stateText", "eventCode", "name", "text"];
  const locKeys = ["location", "city", "depot", "place", "office", "locationName"];
  const walk = (v: unknown, depth: number) => {
    if (depth > 6 || v == null) return;
    if (Array.isArray(v)) {
      v.forEach((x) => walk(x, depth + 1));
      return;
    }
    if (typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    const dk = dateKeys.find((k) => typeof o[k] === "string" && !Number.isNaN(Date.parse(String(o[k]).replace(" ", "T"))));
    const tk = textKeys.find((k) => typeof o[k] === "string" && String(o[k]).trim());
    if (dk && tk) {
      const lk = locKeys.find((k) => typeof o[k] === "string" && String(o[k]).trim());
      out.push({ at: new Date(String(o[dk]).replace(" ", "T")).toISOString(), text: String(o[tk]).trim(), location: lk ? String(o[lk]) : null });
    }
    for (const val of Object.values(o)) if (typeof val === "object") walk(val, depth + 1);
  };
  walk(json, 0);
  const seen = new Set<string>();
  return out
    .filter((e) => {
      const k = `${e.at}|${e.text}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function xmlEscape(s: string | number | null | undefined) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function envSet(names: string[]) {
  return names.filter((n) => Boolean(process.env[n]));
}
