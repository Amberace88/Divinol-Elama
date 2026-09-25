import type { Market, Variant } from "./types";

export const MARKETS: Market[] = ["LV", "EE", "LT"];

export const VAT_RATES: Record<Market, number> = { LV: 21, EE: 24, LT: 21 };

/** Source prices from divinol.lv were entered incl. 21% LV VAT. */
export const BASE_VAT = 21;

export const FREE_SHIPPING_THRESHOLD: Record<Market, number> = { LV: 99, EE: 149, LT: 149 };

export type ShippingMethodId = "pickup" | "parcel_locker" | "courier" | "freight";

export type ShippingMethod = {
  id: ShippingMethodId;
  /** Net price in EUR; null = calculated by manager after order */
  price_net: number | null;
  markets: Market[];
  /** Max size (litres/kg) of a single item that fits this method */
  maxItemSize?: number;
  maxTotalWeightKg?: number;
  freeOverThreshold?: boolean;
};

export const SHIPPING_METHODS: ShippingMethod[] = [
  { id: "pickup", price_net: 0, markets: ["LV"] },
  { id: "parcel_locker", price_net: 2.89, markets: ["LV", "EE", "LT"], maxItemSize: 20, maxTotalWeightKg: 30, freeOverThreshold: true },
  { id: "courier", price_net: 5.79, markets: ["LV", "EE", "LT"], maxItemSize: 25, freeOverThreshold: true },
  { id: "freight", price_net: null, markets: ["LV", "EE", "LT"] },
];

export const COURIER_SURCHARGE: Record<Market, number> = { LV: 0, EE: 4.13, LT: 4.13 };

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function gross(net: number, vatRate: number) {
  return round2(net * (1 + vatRate / 100));
}

export type PriceContext = {
  market: Market;
  /** approved B2B customer → prices shown without VAT, with discount */
  b2b: boolean;
  discountPercent: number;
};

export const DEFAULT_PRICE_CONTEXT: PriceContext = { market: "LV", b2b: false, discountPercent: 0 };

export function unitNet(variant: Pick<Variant, "price_net">, ctx: PriceContext) {
  const d = ctx.b2b ? ctx.discountPercent : 0;
  return round2(variant.price_net * (1 - d / 100));
}

/** Price that is displayed to the visitor for one unit. */
export function displayPrice(variant: Pick<Variant, "price_net">, ctx: PriceContext) {
  const net = unitNet(variant, ctx);
  return ctx.b2b ? net : gross(net, VAT_RATES[ctx.market]);
}

export function pricePerUnit(variant: Pick<Variant, "price_net" | "size" | "unit">, ctx: PriceContext) {
  if (!variant.size || variant.unit === "pcs") return null;
  return round2(displayPrice(variant, ctx) / Number(variant.size));
}

export function packLabel(v: Pick<Variant, "size" | "unit">) {
  if (!v.size) return "";
  const n = Number(v.size);
  const s = Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
  return v.unit === "kg" ? `${s} kg` : v.unit === "l" ? `${s} L` : s;
}

/** Rough shipping weight: oil ≈ 0.9 kg/L + packaging. */
export function estimateWeightKg(v: Pick<Variant, "size" | "unit">) {
  if (!v.size) return 0.5;
  const s = Number(v.size);
  return v.unit === "kg" ? s * 1.08 : s * 0.95;
}

export function variantKey(v: Pick<Variant, "sku" | "size" | "unit">) {
  return v.sku ?? `${v.size ?? "x"}${v.unit}`;
}

export function formatMoney(n: number, locale: string) {
  const map: Record<string, string> = { lv: "lv-LV", et: "et-EE", lt: "lt-LT", en: "en-IE", ru: "ru-RU" };
  return new Intl.NumberFormat(map[locale] ?? "lv-LV", { style: "currency", currency: "EUR" }).format(n);
}

export type ShippingQuote = { id: ShippingMethodId; available: boolean; price_net: number | null; free: boolean };

export function quoteShipping(
  market: Market,
  items: { size: number | null; unit: string; qty: number }[],
  subtotalGross: number,
): ShippingQuote[] {
  const maxItem = Math.max(0, ...items.map((i) => (i.size ? Number(i.size) : 0)));
  const weight = items.reduce((s, i) => s + estimateWeightKg(i) * i.qty, 0);
  const free = subtotalGross >= FREE_SHIPPING_THRESHOLD[market];
  return SHIPPING_METHODS.map((m) => {
    let available = m.markets.includes(market);
    if (m.maxItemSize != null && maxItem > m.maxItemSize) available = false;
    if (m.maxTotalWeightKg != null && weight > m.maxTotalWeightKg) available = false;
    if (m.id === "freight") available = maxItem > 25;
    const isFree = Boolean(m.freeOverThreshold && free);
    let price = m.price_net;
    if (price != null && m.id === "courier") price = price + COURIER_SURCHARGE[market];
    return { id: m.id, available, price_net: isFree ? 0 : price, free: isFree };
  });
}
