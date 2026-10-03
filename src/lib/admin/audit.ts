import "server-only";

/**
 * "Darbību žurnāls" — admin activity log (migration 0016: trigger audit_capture on the shop tables).
 * Visible ONLY to these accounts (the database enforces the same list in is_audit_viewer()).
 */
export const AUDIT_VIEWERS = ["barops.edijs@gmail.com"];

export function isAuditViewer(email?: string | null) {
  return !!email && AUDIT_VIEWERS.includes(email.trim().toLowerCase());
}

export type AuditRow = {
  id: number;
  at: string;
  actor_id: string | null;
  actor_email: string | null;
  table_name: string;
  record_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE" | "VISIT";
  label: string | null;
  changes: Record<string, unknown>;
  auto: boolean;
};

/** Areas shown in the filter (table → area). */
export const AUDIT_AREAS: Record<string, { label: string; tables: string[] }> = {
  prices: { label: "Cenas un atlikumi", tables: ["product_variants"] },
  products: { label: "Produkti un akcijas", tables: ["products", "categories"] },
  orders: { label: "Pasūtījumi", tables: ["orders", "order_items"] },
  invoices: { label: "Rēķini", tables: ["invoices"] },
  shipping: { label: "Sūtījumi un piegāde", tables: ["shipments", "shipping_rates", "shipping_carriers", "raben_orders", "raben_addresses"] },
  customers: { label: "Klienti", tables: ["profiles", "inquiries", "newsletter", "admin_allowlist"] },
  settings: { label: "Iestatījumi", tables: ["settings"] },
  visits: { label: "Pieslēgšanās", tables: ["admin"] },
};

export const TABLE_LABEL: Record<string, string> = {
  products: "Produkts",
  product_variants: "Iepakojums / cena",
  categories: "Kategorija",
  orders: "Pasūtījums",
  order_items: "Pasūtījuma prece",
  invoices: "Rēķins",
  shipments: "Sūtījums",
  shipping_rates: "Piegādes tarifs",
  shipping_carriers: "Pārvadātājs",
  raben_orders: "Raben krava",
  raben_addresses: "Raben adrese",
  profiles: "Klients",
  inquiries: "Pieprasījums",
  newsletter: "Jaunumu abonents",
  admin_allowlist: "Admin piekļuve",
  settings: "Iestatījumi",
  admin: "Administrācija",
};

const SETTINGS_KEY: Record<string, string> = {
  company: "Uzņēmuma rekvizīti",
  vat: "PVN likmes",
  shipping: "Piegādes cenas",
  invoice: "Rēķinu iestatījumi",
};

export function entryLabel(r: AuditRow) {
  if (r.table_name === "settings") return SETTINGS_KEY[r.label ?? ""] ?? r.label ?? "—";
  return r.label ?? r.record_id ?? "—";
}

/** Field names → Latvian (last path segment for nested fields like i18n.lv.name). */
const FIELD: Record<string, string> = {
  price_net: "Cena bez PVN",
  cost_net: "Pašizmaksa",
  stock: "Atlikums",
  in_stock: "Ir noliktavā",
  availability: "Pieejamība",
  lead_time_days: "Piegādes laiks (d.)",
  low_stock_threshold: "Zema atlikuma slieksnis",
  stock_level: "Atlikuma līmenis",
  weight_kg: "Svars (kg)",
  size: "Izmērs",
  unit: "Mērvienība",
  sku: "SKU",
  is_active: "Aktīvs",
  is_featured: "Izcelts sākumlapā",
  sort: "Secība",
  image: "Attēls",
  images: "Attēli",
  badges: "Nozīmītes",
  promo_type: "Akcijas veids",
  promo_percent: "Akcijas atlaide %",
  promo_starts_at: "Akcija no",
  promo_ends_at: "Akcija līdz",
  name: "Nosaukums",
  short: "Īsais apraksts",
  description: "Apraksts",
  slug: "Saite (slug)",
  category_id: "Kategorija",
  sae: "SAE",
  iso_vg: "ISO VG",
  specs: "Specifikācijas",
  oem_approvals: "OEM apstiprinājumi",
  performance: "Veiktspēja",
  tds_url: "TDS fails",
  sds_url: "SDS fails",
  status: "Statuss",
  payment_status: "Apmaksas statuss",
  payment_method: "Apmaksas veids",
  paid_at: "Apmaksāts",
  admin_notes: "Admina piezīmes",
  notes: "Piezīmes",
  tracking_code: "Izsekošanas kods",
  tracking_number: "Izsekošanas numurs",
  tracking_carrier: "Pārvadātājs",
  qty: "Daudzums",
  unit_price_net: "Vienības cena",
  line_net: "Rindas summa",
  total_gross: "Summa ar PVN",
  shipping_net: "Piegāde bez PVN",
  discount_net: "Atlaide",
  role: "Loma",
  b2b_status: "B2B statuss",
  discount_percent: "B2B atlaide %",
  payment_terms_days: "Apmaksas termiņš (d.)",
  company_name: "Uzņēmums",
  full_name: "Vārds",
  email: "E-pasts",
  phone: "Tālrunis",
  enabled: "Ieslēgts",
  checkout_enabled: "Rādīt kasē",
  active: "Aktīvs",
  max_weight_kg: "Maks. svars",
  max_kg: "Maks. kg",
  label: "Nosaukums",
  surcharge_net: "Piemaksa",
  free_over_net: "Bezmaksas no",
  iban: "IBAN",
  bank_name: "Banka",
  swift: "SWIFT",
  path: "Lapa",
};

export function fieldLabel(path: string) {
  const parts = path.split(".");
  const last = parts[parts.length - 1];
  const base = FIELD[last] ?? last.replace(/_/g, " ");
  // i18n.lv.name → "Nosaukums (LV)"; shipping methods.parcel_locker.price_net.LV → "… · LV"
  const lang = parts.find((p) => /^(lv|et|lt|en|ru)$/.test(p));
  const country = /^(LV|EE|LT)$/.test(last) ? last : null;
  if (country) {
    const prev = parts[parts.length - 2];
    return `${FIELD[prev] ?? prev.replace(/_/g, " ")} · ${country}`;
  }
  const ctx = parts.length > 1 && !lang ? parts.slice(0, -1).filter((p) => !/^\d+$/.test(p)).join(" › ").replace(/_/g, " ") : "";
  return `${base}${lang ? ` (${lang.toUpperCase()})` : ""}${ctx ? ` — ${ctx}` : ""}`;
}

const MONEY_FIELDS = /(^|\.)(price_net|cost_net|unit_price_net|line_net|total_gross|shipping_net|discount_net|surcharge_net|free_over_net|subtotal_net|vat_amount|cargo_value|customer_paid_net)(\.|$)|price_net\.(LV|EE|LT)$/;

/** Is this a price / money field (highlighted in the log)? */
export function isMoneyField(path: string) {
  return MONEY_FIELDS.test(path);
}

const fmtNum = new Intl.NumberFormat("lv-LV", { maximumFractionDigits: 4 });
const fmtEur = new Intl.NumberFormat("lv-LV", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtDt = new Intl.DateTimeFormat("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Readable value for the diff (money → €, booleans → Jā/Nē, timestamps → Riga time, long text truncated). */
export function fmtValue(path: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Jā" : "Nē";
  if (typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) && isMoneyField(path))) {
    const n = Number(v);
    return isMoneyField(path) ? fmtEur.format(n) : fmtNum.format(n);
  }
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return fmtDt.format(d);
    }
    return v.length > 220 ? `${v.slice(0, 220)}…` : v;
  }
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x !== "object")) return v.length ? v.join(", ") : "—";
  }
  const s = JSON.stringify(v);
  return s.length > 220 ? `${s.slice(0, 220)}…` : s;
}

/** Percentage change for numeric money edits (+12.5%). */
export function deltaOf(a: unknown, b: unknown) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0 || a === null || b === null) return null;
  return ((y - x) / x) * 100;
}

/** Fields worth showing for an inserted / deleted row (a full snapshot would be noise). */
const SNAPSHOT_KEYS = [
  "number",
  "sku",
  "size",
  "unit",
  "price_net",
  "stock",
  "status",
  "payment_status",
  "total_gross",
  "email",
  "company_name",
  "full_name",
  "carrier",
  "tracking_number",
  "service_name",
  "country",
  "type",
  "name",
  "qty",
  "is_active",
];

export function snapshotFields(changes: Record<string, unknown>) {
  return SNAPSHOT_KEYS.filter((k) => changes[k] !== undefined && changes[k] !== null && changes[k] !== "").map((k) => [k, changes[k]] as const);
}
