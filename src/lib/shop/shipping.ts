import { estimateWeightKg, round2 } from "@/lib/commerce";
import type { ShippingConfig, ShippingTier } from "@/lib/settings";
import type { Market } from "@/lib/types";

export type ShipMethodId = "pickup" | "parcel_locker" | "courier" | "freight";
export const SHIP_ORDER: ShipMethodId[] = ["pickup", "parcel_locker", "courier", "freight"];

/** Items larger than this (L/kg) travel by freight. */
export const FREIGHT_ITEM_SIZE = 25;
const PARCEL_MAX_WEIGHT = 30;

export type ShipQuote = {
  id: ShipMethodId;
  available: boolean;
  /** net price; null = priced by a manager after the order */
  price_net: number | null;
  free: boolean;
  reason?: "market" | "size" | "weight" | "disabled";
  /** size class used for the price (methods with size-based prices) */
  tier?: { id: string; label: string; max_kg: number };
};

/** Parcel weight estimate — the same formula as place_order (kg ≈ 1.08 × kg, L ≈ 0.95 × L, unknown 0.5 kg), 3 decimals. */
export function parcelWeight(items: { size: number | null; unit: string; qty: number }[]) {
  return Math.round(items.reduce((s, i) => s + estimateWeightKg(i) * i.qty, 0) * 1000) / 1000;
}

/** First size class the parcel fits in (tiers sorted by max_kg), or null when it is too heavy for all of them. */
export function pickTier(tiers: ShippingTier[] | undefined, weight: number) {
  if (!tiers?.length) return undefined;
  return [...tiers].sort((a, b) => a.max_kg - b.max_kg).find((t) => weight <= t.max_kg) ?? null;
}

export function isFreightItem(i: { size: number | null; unit: string }) {
  return i.unit !== "pcs" && Number(i.size ?? 0) > FREIGHT_ITEM_SIZE;
}

/**
 * Shipping quote driven by the admin-editable settings — mirrors the logic in the `place_order` SQL function
 * so the price shown equals the price charged.
 */
export function quoteShippingFromSettings(
  cfg: ShippingConfig,
  market: Market,
  items: { size: number | null; unit: string; qty: number }[],
  subtotalGross: number,
): ShipQuote[] {
  const maxItem = Math.max(0, ...items.map((i) => (i.size ? Number(i.size) : 0)));
  const weight = parcelWeight(items);
  const threshold = cfg.free_threshold?.[market] ?? Infinity;
  const needsFreight = items.some(isFreightItem);
  return SHIP_ORDER.map((id) => {
    const m = cfg.methods?.[id];
    if (!m || m.enabled === false) return { id, available: false, price_net: null, free: false, reason: "disabled" as const };
    let available = m.markets.includes(market);
    let reason: ShipQuote["reason"] = available ? undefined : "market";
    if (available && m.max_item != null && maxItem > m.max_item) {
      available = false;
      reason = "size";
    }
    if (available && id === "parcel_locker" && weight > PARCEL_MAX_WEIGHT) {
      available = false;
      reason = "weight";
    }
    if (id === "freight" && !needsFreight) {
      available = false;
      reason = "size";
    }
    const tier = pickTier(m.tiers, weight);
    if (available && tier === null) {
      available = false;
      reason = "weight";
    }
    if (m.price_net == null) return { id, available, price_net: null, free: false, reason };
    const free = Boolean(m.free_over) && subtotalGross >= threshold;
    const base = tier?.price_net?.[market] ?? m.price_net + (m.surcharge?.[market] ?? 0);
    const price = free ? 0 : round2(base);
    return { id, available, price_net: price, free, reason, ...(tier ? { tier: { id: tier.id, label: tier.label, max_kg: tier.max_kg } } : {}) };
  });
}
