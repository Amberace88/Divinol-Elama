import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStoreSettings } from "@/lib/settings";
import type { Market } from "@/lib/types";
import type { Party } from "./adapter";
import { compareRates, normalizeRate, recommend, serviceTypeForMethod, unitsFromItems, type CompareOption, type Unit } from "./compare";
import { mergeLabels } from "./pdf";
import { getAdapter, listPickupPoints } from "./registry";
import { buildTrackingUrl, statusFromText } from "./tracking";
import type { Carrier, PickupPoint, RateRow, ShipmentEvent, ShipmentStatus } from "./types";

/** Server-side shipping helpers shared by admin pages, server actions and route handlers. */

type Db = SupabaseClient;

export const LABEL_BUCKET = "shipping-labels";

export type ShipmentRow = {
  id: string;
  order_id: string | null;
  carrier: string;
  service_code: string | null;
  service_name: string | null;
  type: string | null;
  mode: "api" | "manual";
  status: ShipmentStatus;
  tracking_number: string | null;
  tracking_numbers: string[];
  carrier_ref: string | null;
  label_path: string | null;
  label_url: string | null;
  country: Market | null;
  weight_kg: number | null;
  parcels: number;
  dims: { weight_kg: number; l?: number | null; w?: number | null; h?: number | null; size_code?: string | null }[];
  cost_net: number | null;
  cost_source: string | null;
  customer_paid_net: number | null;
  receiver: Record<string, string | null>;
  pickup_point: Record<string, string | null> | null;
  notes: string | null;
  events: ShipmentEvent[];
  tracking_status: string | null;
  last_tracked_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

export const SHIPMENT_COLS =
  "id, order_id, carrier, service_code, service_name, type, mode, status, tracking_number, tracking_numbers, carrier_ref, label_path, label_url, country, weight_kg, parcels, dims, cost_net, cost_source, customer_paid_net, receiver, pickup_point, notes, events, tracking_status, last_tracked_at, shipped_at, delivered_at, created_at, updated_at";

export async function loadCarriers(db: Db): Promise<Carrier[]> {
  const { data } = await db.from("shipping_carriers").select("code, name, enabled, checkout_enabled, tracking_url_template, logo, website, notes, sort").order("sort");
  return (data ?? []) as Carrier[];
}

export async function loadRates(db: Db, opts: { activeOnly?: boolean } = {}): Promise<RateRow[]> {
  let q = db.from("shipping_rates").select("*").order("carrier").order("country").order("sort");
  if (opts.activeOnly) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []).map((r) => normalizeRate(r as Record<string, unknown>));
}

export function carrierMap(carriers: Carrier[]) {
  return Object.fromEntries(carriers.map((c) => [c.code, { name: c.name, enabled: c.enabled }]));
}

// ───────────────────────── orders ─────────────────────────

export type OrderForShipping = {
  id: string;
  number: string;
  email: string;
  phone: string | null;
  market: Market;
  status: string;
  payment_status: string;
  payment_method: string;
  shipping_method: string;
  shipping_net: number;
  shipping_point: { provider?: string; id?: string | null; name?: string; city?: string; address?: string } | null;
  shipping_address: { name?: string; street?: string; city?: string; postal_code?: string; country?: string; phone?: string } | null;
  customer: { name?: string; company_name?: string | null } | null;
  tracking_code: string | null;
  created_at: string;
};

export const ORDER_SHIP_COLS =
  "id, number, email, phone, market, status, payment_status, payment_method, shipping_method, shipping_net, shipping_point, shipping_address, customer, tracking_code, created_at";

export type OrderItemLite = { order_id?: string; name: string; pack_label: string | null; qty: number };

export function orderUnits(items: OrderItemLite[]): Unit[] {
  return unitsFromItems(items.map((i) => ({ name: i.name, pack_label: i.pack_label, qty: i.qty })));
}

export function orderLockedCarrier(order: Pick<OrderForShipping, "shipping_method" | "shipping_point">) {
  if (order.shipping_method !== "parcel_locker") return null;
  const p = order.shipping_point?.provider;
  return p && p !== "warehouse" ? p : "omniva";
}

export function compareForOrder(order: OrderForShipping, items: OrderItemLite[], rates: RateRow[], carriers: Carrier[]): CompareOption[] {
  return compareRates(rates, {
    country: order.market,
    type: serviceTypeForMethod(order.shipping_method),
    units: orderUnits(items),
    combine: true,
    customerPaidNet: Number(order.shipping_net),
    carriers: carrierMap(carriers),
    lockedLockerCarrier: orderLockedCarrier(order),
  });
}

export { recommend };

export function receiverFromOrder(order: OrderForShipping): Party {
  const a = order.shipping_address ?? {};
  return {
    name: a.name || order.customer?.name || order.customer?.company_name || order.email,
    company: order.customer?.company_name || null,
    phone: a.phone || order.phone,
    email: order.email,
    street: a.street ?? null,
    city: a.city ?? null,
    postcode: a.postal_code ?? null,
    country: order.market,
  };
}

/** Parses "Ventspils iela 51, Rīga, LV-1002" into street / city / postcode. */
export function parseAddress(addr: string) {
  const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);
  const postcode = parts.find((p) => /\d{4}/.test(p) && (/^(LV|EE|LT)-?/i.test(p) || /^\d+$/.test(p))) ?? "";
  const rest = parts.filter((p) => p !== postcode);
  return { street: rest[0] ?? addr, city: rest[1] ?? "Rīga", postcode };
}

export async function senderParty(): Promise<Party> {
  const s = await getStoreSettings();
  const wh = parseAddress(s.company.warehouse);
  return {
    name: s.company.name.replace(/"/g, "").trim(),
    phone: s.company.phone,
    email: s.company.email,
    street: wh.street,
    city: wh.city,
    postcode: wh.postcode,
    country: "LV",
  };
}

/** Looks the pickup point up in the carrier feed to get the data its API needs (postcode, terminal code …). */
export async function resolvePickupPoint(carrier: string, country: Market, stored: { id?: string | null; name?: string; city?: string; address?: string } | null) {
  if (!stored?.id) return null;
  try {
    const list = await listPickupPoints(carrier, country);
    const hit = list.find((p) => p.id === stored.id);
    if (hit) return hit;
  } catch {
    /* feed unavailable → use the stored snapshot */
  }
  return { id: stored.id, name: stored.name ?? stored.id, city: stored.city ?? "", address: stored.address ?? "", country, lat: null, lng: null } satisfies PickupPoint;
}

// ───────────────────────── labels ─────────────────────────

export async function shipmentLabelPdf(db: Db, s: ShipmentRow): Promise<Buffer> {
  if (s.label_path) {
    const { data, error } = await db.storage.from(LABEL_BUCKET).download(s.label_path);
    if (error || !data) throw new Error("Neizdevās nolasīt saglabāto uzlīmi.");
    const type = data.type || (s.label_path.endsWith(".png") ? "image/png" : s.label_path.match(/\.jpe?g$/) ? "image/jpeg" : "application/pdf");
    return mergeLabels([{ data: Buffer.from(await data.arrayBuffer()), type }]);
  }
  if (s.mode !== "api") throw new Error("Šim sūtījumam nav uzlīmes (manuālais režīms — augšupielādējiet PDF).");
  const adapter = getAdapter(s.carrier);
  if (!adapter.getLabel) throw new Error("Pārvadātāja API neatbalsta uzlīmes.");
  const files = await adapter.getLabel({ trackingNumbers: s.tracking_numbers.length ? s.tracking_numbers : [s.tracking_number!].filter(Boolean), carrierRef: s.carrier_ref });
  const pdf = await mergeLabels(files.map((data) => ({ data })));
  // cache the label so re-printing does not hit the carrier API again
  const path = `${s.carrier}/${s.id}.pdf`;
  const up = await db.storage.from(LABEL_BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (!up.error) await db.from("shipments").update({ label_path: path }).eq("id", s.id);
  return pdf;
}

export async function markLabelsPrinted(db: Db, ids: string[]) {
  if (ids.length === 0) return;
  await db.from("shipments").update({ status: "label_printed" }).in("id", ids).in("status", ["draft", "created"]);
}

// ───────────────────────── tracking ─────────────────────────

const STATUS_RANK: Record<ShipmentStatus, number> = {
  draft: 0,
  created: 1,
  label_printed: 2,
  handed_over: 3,
  in_transit: 4,
  delivered: 5,
  returned: 5,
  cancelled: 6,
};

export async function refreshShipmentTracking(db: Db, s: ShipmentRow) {
  const adapter = getAdapter(s.carrier);
  if (!adapter.track || !adapter.capabilities().tracking) throw new Error("Šim pārvadātājam automātiskā izsekošana nav pieejama.");
  const numbers = s.tracking_numbers.length ? s.tracking_numbers : [s.tracking_number].filter((x): x is string => Boolean(x));
  if (numbers.length === 0) throw new Error("Nav sūtījuma koda.");
  const res = await adapter.track({ trackingNumbers: numbers, carrierRef: s.carrier_ref });
  const existing = new Set((s.events ?? []).map((e) => `${e.at}|${e.text}`));
  const fresh: ShipmentEvent[] = res.events
    .filter((e) => !existing.has(`${e.at}|${e.text}`))
    .map((e) => ({ at: e.at, text: e.text, location: e.location ?? null, status: statusFromText(e.text), source: "api" }));
  const events = [...(s.events ?? []), ...fresh].sort((a, b) => a.at.localeCompare(b.at)).slice(-100);
  const next = res.status && STATUS_RANK[res.status] > STATUS_RANK[s.status] && s.status !== "cancelled" ? res.status : s.status;
  const patch: Record<string, unknown> = {
    events,
    last_tracked_at: new Date().toISOString(),
    tracking_status: res.events[res.events.length - 1]?.text?.slice(0, 200) ?? s.tracking_status,
    status: next,
  };
  if (next === "delivered" && !s.delivered_at) patch.delivered_at = new Date().toISOString();
  if (["handed_over", "in_transit", "delivered"].includes(next) && !s.shipped_at) patch.shipped_at = new Date().toISOString();
  const { error } = await db.from("shipments").update(patch).eq("id", s.id);
  if (error) throw error;
  if (next !== s.status && s.order_id) {
    await db.from("order_events").insert({ order_id: s.order_id, type: "shipment", message: `Sūtījuma statuss: ${next === "delivered" ? "piegādāts" : next === "returned" ? "atgriezts" : "ceļā"}` });
  }
  return { status: next, added: fresh.length };
}

/** Writes the carrier-aware tracking info on the order (customer's account page reads it). */
export async function syncOrderTracking(db: Db, orderId: string, carrier: Carrier | undefined, code: string | null) {
  await db
    .from("orders")
    .update({
      tracking_code: code,
      tracking_carrier: code ? carrier?.code ?? null : null,
      tracking_url: code ? buildTrackingUrl(carrier?.tracking_url_template, code, carrier?.code) : null,
    })
    .eq("id", orderId);
}
