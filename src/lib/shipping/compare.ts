import type { Market } from "@/lib/types";
import type { RateRow, ServiceType } from "./types";

/**
 * Shipping price comparison ("Piegādes cenu salīdzinājums") — pure functions, safe on client and server.
 *
 * Input: destination country, preferred service type and the goods (either order items / presets that are
 * packed automatically, or explicit parcels). For every carrier service with an active rate card the goods are
 * packed into parcels that respect the service's size classes (max dimensions + max weight), each parcel is priced
 * with the cheapest class it fits into, and the options are ranked. Rates without a price (contract prices not entered
 * yet) are still listed so the admin sees the parcel split, but they get no total and no "cheapest" badge.
 */

/** One physical unit to ship (a bottle, canister, drum — or a ready packed box). Dimensions in cm. */
export type Unit = { weightKg: number; l: number; w: number; h: number; label?: string };

export type PriceKind = "list" | "contract" | "missing";

export type CompareParcel = { weightKg: number; sizeCode: string | null; priceNet: number | null; units: number };

export type CompareOption = {
  key: string;
  carrier: string;
  carrierName: string;
  serviceCode: string;
  serviceName: string;
  type: ServiceType;
  valid: boolean;
  reason?: string;
  parcels: CompareParcel[];
  totalNet: number | null;
  totalWeightKg: number;
  transitMin: number | null;
  transitMax: number | null;
  priceKind: PriceKind;
  sourceDate: string | null;
  sourceUrl: string | null;
  sourceNote: string | null;
  badges: ("cheapest" | "fastest")[];
  /** customer paid (net) − carrier cost (net); null when either side is unknown */
  marginNet: number | null;
  rateIds: string[];
};

export type CompareInput = {
  country: Market;
  /** "any" = all parcel services (locker + courier + pickup) and pallets when needed */
  type: ServiceType | "any";
  units: Unit[];
  /** true = several small units may share one box; false = every unit is already a packed parcel */
  combine?: boolean;
  customerPaidNet?: number | null;
  carriers?: Record<string, { name: string; enabled: boolean }>;
  /** customer picked a locker of this carrier → other carriers' locker services are not valid for this order */
  lockedLockerCarrier?: string | null;
};

// ───────────────────────── goods → units ─────────────────────────

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Weight + outer box dimensions of one pack, estimated from its size (litres at density ≈0.9, or kg) + packaging. */
export function packUnit(size: number | null | undefined, unit: string | null | undefined, label?: string): Unit {
  const s = Number(size ?? 0);
  if (!s || !unit || unit === "pcs") return { weightKg: 0.5, l: 20, w: 15, h: 10, label };
  if (unit === "kg") {
    const weightKg = round2(s * 1.05 + 0.1);
    const d =
      s <= 0.5 ? [12, 8, 8] : s <= 1 ? [12, 12, 12] : s <= 5 ? [22, 22, 20] : s <= 18 ? [33, 30, 30] : s <= 25 ? [40, 32, 32] : s <= 60 ? [60, 40, 40] : [90, 60, 60];
    return { weightKg, l: d[0], w: d[1], h: d[2], label };
  }
  // litres
  const pkg = s <= 1 ? 0.08 : s <= 5 ? 0.3 : s <= 10 ? 0.6 : s <= 25 ? 1.2 : s <= 60 ? 5 : 18;
  const weightKg = round2(s * 0.9 + pkg);
  const d =
    s <= 0.5 ? [18, 7, 7] : s <= 1 ? [25, 10, 7] : s <= 5 ? [28, 19, 13] : s <= 10 ? [32, 22, 20] : s <= 25 ? [38, 29, 24] : s <= 60 ? [65, 45, 45] : [90, 60, 60];
  return { weightKg, l: d[0], w: d[1], h: d[2], label };
}

/** "20 L", "0,4 kg", "208L" → { size, unit } */
export function parsePackLabel(label: string | null | undefined): { size: number; unit: "l" | "kg" } | null {
  const m = (label ?? "").match(/([\d]+(?:[.,]\d+)?)\s*(l|kg)\b/i);
  if (!m) return null;
  return { size: Number(m[1].replace(",", ".")), unit: m[2].toLowerCase() === "kg" ? "kg" : "l" };
}

export function unitsFromItems(items: { size?: number | null; unit?: string | null; pack_label?: string | null; qty: number; name?: string }[]): Unit[] {
  const out: Unit[] = [];
  for (const it of items) {
    let size = it.size ?? null;
    let unit = it.unit ?? null;
    if (size == null) {
      const p = parsePackLabel(it.pack_label);
      if (p) {
        size = p.size;
        unit = p.unit;
      }
    }
    const u = packUnit(size, unit, [it.name, it.pack_label].filter(Boolean).join(" ") || undefined);
    const qty = Math.max(0, Math.min(500, Math.round(it.qty)));
    for (let i = 0; i < qty; i++) out.push(u);
  }
  return out;
}

export const PRESETS: { id: string; label: string; items: { size: number; unit: "l" | "kg"; qty: number }[] }[] = [
  { id: "1x1", label: "1×1 L", items: [{ size: 1, unit: "l", qty: 1 }] },
  { id: "4x1", label: "4×1 L", items: [{ size: 1, unit: "l", qty: 4 }] },
  { id: "1x5", label: "1×5 L", items: [{ size: 5, unit: "l", qty: 1 }] },
  { id: "4x5", label: "4×5 L", items: [{ size: 5, unit: "l", qty: 4 }] },
  { id: "1x20", label: "1×20 L", items: [{ size: 20, unit: "l", qty: 1 }] },
  { id: "2x20", label: "2×20 L", items: [{ size: 20, unit: "l", qty: 2 }] },
  { id: "1x18kg", label: "1×18 kg smērviela", items: [{ size: 18, unit: "kg", qty: 1 }] },
  { id: "1x60", label: "1×60 L muca", items: [{ size: 60, unit: "l", qty: 1 }] },
  { id: "1x208", label: "1×208 L muca", items: [{ size: 208, unit: "l", qty: 1 }] },
];

/** Parcel carriers accept up to ~30–35 kg; anything heavier (60/208 L drums) travels on a pallet. */
export const PARCEL_MAX_KG = 31.5;

export function needsPallet(units: Unit[]) {
  return units.some((u) => u.weightKg > PARCEL_MAX_KG || Math.max(u.l, u.w, u.h) > 150);
}

// ───────────────────────── fitting ─────────────────────────

const vol = (u: { l: number; w: number; h: number }) => u.l * u.w * u.h;

function classDims(r: RateRow): [number, number, number] | null {
  if (r.max_length_cm == null || r.max_width_cm == null || r.max_height_cm == null) return null;
  return [Number(r.max_length_cm), Number(r.max_width_cm), Number(r.max_height_cm)].sort((a, b) => b - a) as [number, number, number];
}

/** Box fits a class when its sorted dimensions fit the class's sorted dimensions (any orientation). */
function unitFitsDims(u: Unit, r: RateRow) {
  const c = classDims(r);
  if (!c) return true;
  const d = [u.l, u.w, u.h].sort((a, b) => b - a);
  return d[0] <= c[0] && d[1] <= c[1] && d[2] <= c[2];
}

function classVolume(r: RateRow) {
  const c = classDims(r);
  return c ? c[0] * c[1] * c[2] : Infinity;
}

/** How full a box can realistically be packed with smaller units. */
const FILL = 0.8;

type Box = { units: Unit[]; weight: number; volume: number };

function classFitsBox(r: RateRow, b: Box) {
  if (b.weight > Number(r.max_weight_kg) || b.weight < Number(r.min_weight_kg)) return false;
  if (!b.units.every((u) => unitFitsDims(u, r))) return false;
  if (b.units.length > 1 && b.volume > classVolume(r) * FILL) return false;
  return true;
}

function cheapestClass(classes: RateRow[], b: Box): RateRow | null {
  const fitting = classes.filter((c) => classFitsBox(c, b));
  if (fitting.length === 0) return null;
  return fitting.sort((a, c) => {
    const pa = a.price_net == null ? Infinity : Number(a.price_net);
    const pc = c.price_net == null ? Infinity : Number(c.price_net);
    return pa - pc || classVolume(a) - classVolume(c) || Number(a.max_weight_kg) - Number(c.max_weight_kg);
  })[0];
}

function pack(units: Unit[], classes: RateRow[], combine: boolean): { boxes: { box: Box; cls: RateRow }[] } | { error: string } {
  for (const u of units) {
    if (!classes.some((c) => classFitsBox(c, { units: [u], weight: u.weightKg, volume: vol(u) }))) {
      const maxKg = Math.max(...classes.map((c) => Number(c.max_weight_kg)));
      return {
        error:
          u.weightKg > maxKg
            ? `${u.label ? `${u.label}: ` : ""}${round1(u.weightKg)} kg pārsniedz ${maxKg} kg limitu`
            : `${u.label ? `${u.label}: ` : ""}${u.l}×${u.w}×${u.h} cm neder neviena izmēra klasē`,
      };
    }
  }
  const boxes: Box[] = [];
  const sorted = [...units].sort((a, b) => vol(b) - vol(a) || b.weightKg - a.weightKg);
  for (const u of sorted) {
    let placed = false;
    if (combine) {
      for (const b of boxes) {
        const next: Box = { units: [...b.units, u], weight: b.weight + u.weightKg, volume: b.volume + vol(u) };
        if (cheapestClass(classes, next)) {
          b.units = next.units;
          b.weight = next.weight;
          b.volume = next.volume;
          placed = true;
          break;
        }
      }
    }
    if (!placed) boxes.push({ units: [u], weight: u.weightKg, volume: vol(u) });
  }
  if (boxes.length > 99) return { error: "Vairāk nekā 99 paciņas — izmantojiet paleti" };
  return { boxes: boxes.map((box) => ({ box, cls: cheapestClass(classes, box)! })) };
}

// ───────────────────────── comparison ─────────────────────────

const PARCEL_TYPES: ServiceType[] = ["locker", "courier", "pickup"];

export function compareRates(rates: RateRow[], input: CompareInput): CompareOption[] {
  const units = input.units.filter((u) => u.weightKg > 0);
  const pallet = needsPallet(units);
  const wanted: ServiceType[] =
    input.type === "any" ? (pallet ? ["pallet"] : PARCEL_TYPES) : input.type === "pallet" ? ["pallet"] : [input.type];

  const groups = new Map<string, RateRow[]>();
  for (const r of rates) {
    if (!r.active || r.country !== input.country || !wanted.includes(r.type)) continue;
    const carrier = input.carriers?.[r.carrier];
    if (carrier && !carrier.enabled) continue;
    const key = `${r.carrier}:${r.service_code}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const totalWeightKg = round2(units.reduce((s, u) => s + u.weightKg, 0));
  const options: CompareOption[] = [];
  for (const [key, classes] of groups) {
    const first = [...classes].sort((a, b) => a.sort - b.sort)[0];
    const base = {
      key,
      carrier: first.carrier,
      carrierName: input.carriers?.[first.carrier]?.name ?? first.carrier,
      serviceCode: first.service_code,
      serviceName: first.service_name,
      type: first.type,
      totalWeightKg,
      transitMin: minOf(classes.map((c) => c.transit_days_min)),
      transitMax: maxOf(classes.map((c) => c.transit_days_max)),
      sourceDate: first.source_date,
      sourceUrl: first.source_url,
      sourceNote: first.source_note,
      badges: [] as ("cheapest" | "fastest")[],
    };
    if (units.length === 0) {
      options.push({ ...base, valid: false, reason: "Nav preču", parcels: [], totalNet: null, priceKind: "missing", marginNet: null, rateIds: [] });
      continue;
    }
    if (first.type === "locker" && input.lockedLockerCarrier && input.lockedLockerCarrier !== first.carrier) {
      options.push({
        ...base,
        valid: false,
        reason: "Klients izvēlējās cita pārvadātāja pakomātu",
        parcels: [],
        totalNet: null,
        priceKind: "missing",
        marginNet: null,
        rateIds: [],
      });
      continue;
    }
    if (pallet && first.type !== "pallet") {
      options.push({ ...base, valid: false, reason: "Smagas mucas — tikai ar paleti", parcels: [], totalNet: null, priceKind: "missing", marginNet: null, rateIds: [] });
      continue;
    }
    const res = pack(units, classes, input.combine ?? true);
    if ("error" in res) {
      options.push({ ...base, valid: false, reason: res.error, parcels: [], totalNet: null, priceKind: "missing", marginNet: null, rateIds: [] });
      continue;
    }
    const parcels: CompareParcel[] = res.boxes.map(({ box, cls }) => ({
      weightKg: round2(box.weight),
      sizeCode: cls.size_code,
      priceNet: cls.price_net == null ? null : Number(cls.price_net),
      units: box.units.length,
    }));
    const missing = parcels.some((p) => p.priceNet == null);
    const totalNet = missing ? null : round2(parcels.reduce((s, p) => s + (p.priceNet ?? 0), 0));
    const used = res.boxes.map((b) => b.cls);
    const priceKind: PriceKind = missing ? "missing" : used.some((c) => c.is_contract) ? "contract" : "list";
    options.push({
      ...base,
      valid: true,
      parcels,
      totalNet,
      priceKind,
      marginNet: totalNet != null && input.customerPaidNet != null ? round2(input.customerPaidNet - totalNet) : null,
      rateIds: [...new Set(used.map((c) => c.id))],
      sourceDate: used[0]?.source_date ?? base.sourceDate,
      sourceUrl: used[0]?.source_url ?? base.sourceUrl,
    });
  }

  const priced = options.filter((o) => o.valid && o.totalNet != null);
  if (priced.length > 0) {
    const min = Math.min(...priced.map((o) => o.totalNet!));
    priced.filter((o) => o.totalNet === min).forEach((o) => o.badges.push("cheapest"));
  }
  const timed = options.filter((o) => o.valid && o.transitMax != null);
  if (timed.length > 1) {
    const min = Math.min(...timed.map((o) => o.transitMax!));
    const fastest = timed.filter((o) => o.transitMax === min);
    if (fastest.length < timed.length) fastest.forEach((o) => o.badges.push("fastest"));
  }

  return options.sort(
    (a, b) =>
      Number(b.valid) - Number(a.valid) ||
      (a.totalNet ?? Infinity) - (b.totalNet ?? Infinity) ||
      a.parcels.length - b.parcels.length ||
      a.carrierName.localeCompare(b.carrierName),
  );
}

/** Cheapest valid priced option; otherwise the first valid one (contract price still missing). */
export function recommend(options: CompareOption[]): CompareOption | null {
  return options.find((o) => o.valid && o.totalNet != null) ?? options.find((o) => o.valid) ?? null;
}

/** Order shipping method → service type used for the comparison. */
export function serviceTypeForMethod(method: string | null | undefined): ServiceType | "any" {
  if (method === "parcel_locker") return "locker";
  if (method === "courier") return "courier";
  if (method === "freight") return "pallet";
  return "any";
}

function minOf(v: (number | null)[]) {
  const n = v.filter((x): x is number => x != null).map(Number);
  return n.length ? Math.min(...n) : null;
}
function maxOf(v: (number | null)[]) {
  const n = v.filter((x): x is number => x != null).map(Number);
  return n.length ? Math.max(...n) : null;
}

export function transitLabel(min: number | null, max: number | null) {
  if (min == null && max == null) return "—";
  if (min != null && max != null && min !== max) return `${min}–${max} d.d.`;
  return `${max ?? min} d.d.`;
}

/** Normalises numeric columns that PostgREST returns as strings. */
export function normalizeRate(r: Record<string, unknown>): RateRow {
  const n = (v: unknown) => (v == null || v === "" ? null : Number(v));
  return {
    ...(r as unknown as RateRow),
    min_weight_kg: Number(r.min_weight_kg ?? 0),
    max_weight_kg: Number(r.max_weight_kg),
    max_length_cm: n(r.max_length_cm),
    max_width_cm: n(r.max_width_cm),
    max_height_cm: n(r.max_height_cm),
    price_net: n(r.price_net),
    transit_days_min: n(r.transit_days_min),
    transit_days_max: n(r.transit_days_max),
    sort: Number(r.sort ?? 0),
  };
}
