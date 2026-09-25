import type { Tone } from "./labels";

/** Inventory & pricing model shared by admin server + client code (client-safe, no server imports). */

export const AVAILABILITIES = ["in_stock", "on_order", "out_of_stock", "discontinued"] as const;
export type Availability = (typeof AVAILABILITIES)[number];

/** Effective level = availability, plus the derived "low_stock" (mirrors the generated column `stock_level`). */
export const STOCK_LEVELS = ["in_stock", "low_stock", "on_order", "out_of_stock", "discontinued"] as const;
export type StockLevel = (typeof STOCK_LEVELS)[number];

export const STOCK_LEVEL: Record<StockLevel, { label: string; tone: Tone; hint: string }> = {
  in_stock: {
    label: "Noliktavā",
    tone: "green",
    hint: "Prece ir noliktavā. Veikalā redzams “Noliktavā”.",
  },
  low_stock: {
    label: "Zems atlikums",
    tone: "yellow",
    hint: "Noliktavā, bet atlikums ir vienāds ar vai zem sliekšņa. Automātisks — veikalā joprojām “Noliktavā”.",
  },
  on_order: {
    label: "Pēc pasūtījuma",
    tone: "blue",
    hint: "Piegāde no ražotāja (norādiet termiņu dienās). Pasūtīt var arī ar 0 atlikumu — statuss nemainās automātiski.",
  },
  out_of_stock: {
    label: "Nav noliktavā",
    tone: "red",
    hint: "Atlikums beidzies (uzstādās automātiski, kad atlikums sasniedz 0). Klients var pasūtīt — veikalā redz “Pēc pasūtījuma”.",
  },
  discontinued: {
    label: "Izņemts no pārdošanas",
    tone: "gray",
    hint: "Variants veikalā netiek rādīts un nav pasūtāms.",
  },
};
export const AVAILABILITY_LABEL: Record<Availability, string> = {
  in_stock: STOCK_LEVEL.in_stock.label,
  on_order: STOCK_LEVEL.on_order.label,
  out_of_stock: STOCK_LEVEL.out_of_stock.label,
  discontinued: STOCK_LEVEL.discontinued.label,
};

export const MOVEMENT_REASON: Record<string, { label: string; tone: Tone }> = {
  order: { label: "Pasūtījums", tone: "navy" },
  cancel: { label: "Atcelšana", tone: "purple" },
  manual: { label: "Manuāli", tone: "gray" },
  bulk: { label: "Grupas darbība", tone: "orange" },
  import: { label: "CSV imports", tone: "blue" },
  create: { label: "Izveidots", tone: "green" },
};

export function isAvailability(v: unknown): v is Availability {
  return typeof v === "string" && (AVAILABILITIES as readonly string[]).includes(v);
}

export function levelOf(v: { availability: Availability; stock: number | null; low_stock_threshold: number }): StockLevel {
  if (v.availability !== "in_stock") return v.availability;
  if (v.stock != null && v.stock <= v.low_stock_threshold) return "low_stock";
  return "in_stock";
}

// ───────────────────────── prices ─────────────────────────
export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;
export const grossOf = (net: number, vat: number) => r2(net * (1 + vat / 100));
export const netOf = (gross: number, vat: number) => r4(gross / (1 + vat / 100));

export type Rounding = "none" | "x9" | "00";
export const ROUNDING_LABEL: Record<Rounding, string> = { none: "Bez noapaļošanas", x9: "Uz ,x9 (12,49)", "00": "Uz veseliem eiro (12,00)" };

/** Psychological rounding of a gross price. */
export function roundGross(g: number, mode: Rounding) {
  if (!Number.isFinite(g)) return g;
  if (mode === "x9") return Math.max(0.09, r2(Math.round(g * 10) / 10 - 0.01));
  if (mode === "00") return Math.max(1, Math.round(g));
  return r2(g);
}

/** Parses "1 234,56", "1234.56", "12,5 €" → number; "" → null; garbage → NaN. */
export function parseDecimal(s: string | null | undefined): number | null {
  let t = String(s ?? "").replace(/[\s €]/g, "");
  if (!t) return null;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = lastComma > lastDot ? "," : ".";
    t = t.split(dec === "," ? "." : ",").join("");
  }
  t = t.replace(",", ".");
  if (!/^-?\d*\.?\d+$|^-?\d+\.?$/.test(t)) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export function fmtDecimal(n: number | null | undefined, max = 2, min = 2) {
  if (n == null || !Number.isFinite(n)) return "";
  return new Intl.NumberFormat("lv-LV", { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: false }).format(n);
}

// ───────────────────────── shared shapes ─────────────────────────
export type InventoryVariant = {
  id: string;
  sku: string | null;
  size: number | null;
  unit: string;
  price_net: number;
  stock: number | null;
  availability: Availability;
  lead_time_days: number | null;
  low_stock_threshold: number;
  is_active: boolean;
};

/** One change for RPC `admin_inventory_apply` — only present keys are changed. */
export type InventoryChange = {
  variant_id: string;
  price_net?: number;
  stock?: number | null;
  stock_delta?: number;
  availability?: Availability;
  lead_time_days?: number | null;
  low_stock_threshold?: number;
  note?: string;
};

export type InventoryRow = {
  id: string;
  price_net: number;
  stock: number | null;
  availability: Availability;
  in_stock: boolean;
  lead_time_days: number | null;
  low_stock_threshold: number;
  stock_level: StockLevel;
};

export type HistoryMovement = {
  id: number;
  delta: number;
  stock_before: number | null;
  stock_after: number | null;
  availability_before: string | null;
  availability_after: string | null;
  reason: string;
  note: string | null;
  created_at: string;
  order: { id: string; number: string } | null;
  by: string | null;
};
export type HistoryPrice = { id: number; old_net: number | null; new_net: number; reason: string; created_at: string; by: string | null };

/** List filter tabs on /admin/products (`?stock=`). */
export const STOCK_FILTERS = ["in_stock", "low_stock", "on_order", "out_of_stock", "discontinued", "inactive"] as const;
export type StockFilter = (typeof STOCK_FILTERS)[number];
export const STOCK_FILTER_LABEL: Record<StockFilter, string> = {
  in_stock: "Noliktavā",
  low_stock: "Zems atlikums",
  on_order: "Pēc pasūtījuma",
  out_of_stock: "Nav noliktavā",
  discontinued: "Izņemti",
  inactive: "Neaktīvi",
};
