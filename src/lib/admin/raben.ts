import type { Tone } from "./labels";

/** Shared types + presets for Raben transport orders (used by server pages, actions and the client wizard). */

export type RabenParty = {
  name: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  vat_no?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type RabenAddress = RabenParty & { id: string; label: string | null; notes?: string | null; sort: number };

export type RabenUnitType = "EUR" | "FIN" | "HALF" | "QUARTER" | "DRUM" | "IBC" | "BOX" | "OTHER";

export type RabenUnit = {
  type: RabenUnitType;
  qty: number;
  weight_kg: number; // weight of ONE unit incl. packaging
  length_cm: number;
  width_cm: number;
  height_cm: number;
  stackable: boolean;
  description: string;
};

export type RabenStatus = "draft" | "ready" | "submitted" | "in_transit" | "delivered" | "cancelled";
export type RabenDirection = "inbound" | "outbound" | "return" | "other";
export type GoodsCharacter = "chemical" | "neutral" | "food" | "adr";

export type RabenOrder = {
  id: string;
  number: string;
  status: RabenStatus;
  direction: RabenDirection;
  order_id: string | null;
  shipper: RabenParty;
  loading: RabenParty;
  consignee: RabenParty;
  unloading: RabenParty;
  goods_character: GoodsCharacter;
  limited_quantity: boolean;
  units: RabenUnit[];
  loading_date: string | null;
  loading_from: string | null;
  loading_to: string | null;
  delivery_date: string | null;
  reference: string | null;
  cargo_value: number | null;
  notes: string | null;
  raben_number: string | null;
  cost_net: number | null;
  submitted_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Transport unit presets (standard pallet footprints; heights are typical loaded heights). */
export const UNIT_PRESETS: Record<RabenUnitType, { label: string; short: string; l: number; w: number; h: number; kg: number; hint: string }> = {
  EUR: { label: "EUR palete", short: "EUR", l: 120, w: 80, h: 120, kg: 600, hint: "120 × 80 cm" },
  FIN: { label: "FIN palete", short: "FIN", l: 120, w: 100, h: 120, kg: 700, hint: "120 × 100 cm" },
  HALF: { label: "Puspalete", short: "½ EUR", l: 80, w: 60, h: 100, kg: 300, hint: "80 × 60 cm" },
  QUARTER: { label: "Ceturtdaļpalete", short: "¼ EUR", l: 60, w: 40, h: 80, kg: 150, hint: "60 × 40 cm" },
  DRUM: { label: "Muca 208 L", short: "Muca", l: 60, w: 60, h: 90, kg: 195, hint: "Ø 60 cm, ~195 kg" },
  IBC: { label: "IBC konteiners 1000 L", short: "IBC", l: 120, w: 100, h: 116, kg: 950, hint: "120 × 100 cm" },
  BOX: { label: "Kaste / paka", short: "Kaste", l: 60, w: 40, h: 40, kg: 25, hint: "brīvi izmēri" },
  OTHER: { label: "Cits", short: "Cits", l: 100, w: 100, h: 100, kg: 100, hint: "ievadiet izmērus" },
};

export const UNIT_ORDER: RabenUnitType[] = ["EUR", "FIN", "HALF", "QUARTER", "DRUM", "IBC", "BOX", "OTHER"];

export const GOODS_CHARACTER: Record<GoodsCharacter, string> = {
  chemical: "Ķīmiskā vide",
  neutral: "Neitrāla vide",
  food: "Pārtikas vide",
  adr: "ADR",
};

export const RABEN_STATUS: Record<RabenStatus, { label: string; tone: Tone; hint: string }> = {
  draft: { label: "Melnraksts", tone: "gray", hint: "Vēl tiek aizpildīts" },
  ready: { label: "Gatavs iesniegšanai", tone: "yellow", hint: "Jāievada myRaben" },
  submitted: { label: "Iesniegts Raben", tone: "blue", hint: "Pasūtīts myRaben" },
  in_transit: { label: "Ceļā", tone: "purple", hint: "Krava ir paņemta" },
  delivered: { label: "Piegādāts", tone: "green", hint: "Krava piegādāta" },
  cancelled: { label: "Atcelts", tone: "red", hint: "" },
};

export const RABEN_DIRECTION: Record<RabenDirection, { label: string; hint: string }> = {
  inbound: { label: "Ienākošā krava", hint: "No piegādātāja uz noliktavu" },
  outbound: { label: "Izejošā krava", hint: "No noliktavas klientam" },
  return: { label: "Atgriešana", hint: "Atpakaļ piegādātājam" },
  other: { label: "Cits", hint: "" },
};

export const COUNTRY_NAMES: Record<string, string> = {
  LV: "Latvija",
  EE: "Igaunija",
  LT: "Lietuva",
  DE: "Vācija",
  PL: "Polija",
  FI: "Somija",
  SE: "Zviedrija",
  NL: "Nīderlande",
  CZ: "Čehija",
  AT: "Austrija",
};

export const MYRABEN_URL = "https://odm.myraben.com/index.html";

export const emptyParty = (): RabenParty => ({
  name: "",
  street: "",
  postal_code: "",
  city: "",
  country: "LV",
  vat_no: "",
  contact_name: "",
  phone: "",
  email: "",
});

export function unitFromPreset(type: RabenUnitType, description = ""): RabenUnit {
  const p = UNIT_PRESETS[type];
  return { type, qty: 1, weight_kg: p.kg, length_cm: p.l, width_cm: p.w, height_cm: p.h, stackable: false, description };
}

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Totals shown in the wizard + summary. Pallet places: ½ and a 208 L drum = 0.5, ¼ = 0.25, EUR/FIN/IBC = 1 (FIN/IBC ≈ 1.25 of a EUR footprint). */
export function rabenTotals(units: RabenUnit[]) {
  let pieces = 0;
  let weight = 0;
  let places = 0;
  let volume = 0;
  let ldm = 0;
  for (const u of units) {
    const q = Math.max(0, Math.round(n(u.qty)));
    pieces += q;
    weight += q * n(u.weight_kg);
    volume += (q * n(u.length_cm) * n(u.width_cm) * n(u.height_cm)) / 1_000_000;
    const floor = (n(u.length_cm) * n(u.width_cm)) / (120 * 80); // EUR footprint = 1
    const pp = u.type === "HALF" || u.type === "DRUM" ? 0.5 : u.type === "QUARTER" ? 0.25 : u.type === "BOX" ? 0 : Math.max(1, Math.round(floor * 4) / 4);
    places += (u.stackable ? Math.ceil(q / 2) : q) * pp;
    // loading metres: truck width 2.4 m → each 1 m of length holds 2.4 m² of floor
    ldm += ((u.stackable ? Math.ceil(q / 2) : q) * n(u.length_cm) * n(u.width_cm)) / 10_000 / 2.4;
  }
  return {
    pieces,
    weight: Math.round(weight * 10) / 10,
    places: Math.round(places * 100) / 100,
    volume: Math.round(volume * 100) / 100,
    ldm: Math.round(ldm * 100) / 100,
  };
}

export function partyLines(p: Partial<RabenParty> | null | undefined): string[] {
  if (!p || !p.name) return [];
  const loc = [p.postal_code, p.city].filter(Boolean).join(" ");
  return [p.name, p.street, loc, COUNTRY_NAMES[p.country ?? ""] ?? p.country, p.vat_no ? `PVN: ${p.vat_no}` : ""].filter(Boolean) as string[];
}

export function partyContact(p: Partial<RabenParty> | null | undefined): string {
  if (!p) return "";
  return [p.contact_name, p.phone, p.email].filter(Boolean).join(" · ");
}

export function sameParty(a: Partial<RabenParty>, b: Partial<RabenParty>) {
  return (a.name ?? "") === (b.name ?? "") && (a.street ?? "") === (b.street ?? "") && (a.postal_code ?? "") === (b.postal_code ?? "");
}

/** Plain-text version of the whole order — for "Kopēt visu" and for e-mailing to a Raben dispatcher. */
export function rabenPlainText(o: { number?: string | null } & Pick<RabenOrder, "shipper" | "loading" | "consignee" | "unloading" | "goods_character" | "limited_quantity" | "units" | "loading_date" | "loading_from" | "loading_to" | "delivery_date" | "reference" | "notes" | "cargo_value">) {
  const t = rabenTotals(o.units);
  const block = (title: string, p: RabenParty) => [`${title}:`, ...partyLines(p).map((l) => `  ${l}`), partyContact(p) ? `  Kontakts: ${partyContact(p)}` : ""].filter(Boolean).join("\n");
  const units = o.units
    .map((u, i) => `  ${i + 1}. ${u.qty} × ${UNIT_PRESETS[u.type].label} — ${u.weight_kg} kg/gab., ${u.length_cm}×${u.width_cm}×${u.height_cm} cm${u.stackable ? ", kraujams" : ", nekraujams"}${u.description ? ` — ${u.description}` : ""}`)
    .join("\n");
  return [
    `Raben transporta pasūtījums${o.number ? " " + o.number : ""}`,
    "",
    block("Nosūtītājs", o.shipper),
    block("Iekraušanas vieta", o.loading),
    block("Preču saņēmējs", o.consignee),
    block("Izkraušanas vieta", o.unloading),
    "",
    `Preču raksturojums: ${GOODS_CHARACTER[o.goods_character]}${o.limited_quantity ? " · bīstamās preces ierobežotos daudzumos (LQ)" : ""}`,
    "Krava:",
    units,
    `  Kopā: ${t.pieces} vien., ${t.weight} kg, ${t.places} palešu vietas, ${t.ldm} LDM`,
    "",
    `Iekraušanas datums: ${lvDate(o.loading_date) || "—"}${o.loading_from || o.loading_to ? ` (${o.loading_from?.slice(0, 5) ?? ""}–${o.loading_to?.slice(0, 5) ?? ""})` : ""}`,
    o.delivery_date ? `Vēlamais piegādes datums: ${lvDate(o.delivery_date)}` : "",
    o.reference ? `Klienta pasūtījuma Nr.: ${o.reference}` : "",
    o.cargo_value ? `Kravas vērtība: ${o.cargo_value} EUR` : "",
    o.notes ? `Piezīmes: ${o.notes}` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** The editable part of a Raben order (what the wizard edits and saveRabenOrder receives). */
export type RabenForm = Pick<
  RabenOrder,
  | "direction"
  | "order_id"
  | "shipper"
  | "loading"
  | "consignee"
  | "unloading"
  | "goods_character"
  | "limited_quantity"
  | "units"
  | "loading_date"
  | "loading_from"
  | "loading_to"
  | "delivery_date"
  | "reference"
  | "cargo_value"
  | "notes"
>;

/** "2026-10-01" → "01.10.2026" (the format myRaben's date fields use). */
export function lvDate(iso: string | null | undefined) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Next working day (Mon–Fri) after the given ISO date. */
export function nextWorkingDay(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

export function toParty(a: Partial<RabenParty> | null | undefined): RabenParty {
  const e = emptyParty();
  if (!a) return e;
  return {
    name: a.name ?? "",
    street: a.street ?? "",
    postal_code: a.postal_code ?? "",
    city: a.city ?? "",
    country: a.country || "LV",
    vat_no: a.vat_no ?? "",
    contact_name: a.contact_name ?? "",
    phone: a.phone ?? "",
    email: a.email ?? "",
  };
}
