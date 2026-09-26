import { z } from "zod";

/**
 * Admin "Jauns pasūtījums" (manual order / invoice) — validation + live totals shared by the client form
 * and the Server Action (client-safe). The authoritative totals are computed again in SQL by
 * `admin_create_order()` with the same rounding: unit net → 4 decimals, line net → 2 decimals,
 * VAT = round((Σ lines + shipping) × rate, 2).
 */

export const ORDER_LOCALES = ["lv", "en", "et", "lt", "ru"] as const;
export const ORDER_LOCALE_LABEL: Record<(typeof ORDER_LOCALES)[number], string> = {
  lv: "Latviešu",
  en: "English",
  et: "Eesti",
  lt: "Lietuvių",
  ru: "Русский",
};

export const DOCUMENTS = ["proforma", "invoice", "none"] as const;
export type DocumentKind = (typeof DOCUMENTS)[number];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Nederīgs ID");
const text = (max: number) => z.string().trim().max(max, `Maksimums ${max} simboli`);
const market = z.enum(["LV", "EE", "LT"], { error: "Nederīgs tirgus" });

const address = z
  .object({
    street: text(200),
    city: text(100),
    postal_code: text(20),
    country: market,
  })
  .nullable();

export const manualLineSchema = z.object({
  kind: z.enum(["product", "custom"]),
  variant_id: uuid.nullable(),
  name: text(300),
  sku: text(60),
  unit: text(20),
  qty: z.number({ error: "Ievadiet daudzumu" }).int("Daudzumam jābūt veselam skaitlim").min(1, "Vismaz 1").max(100000, "Pārāk liels daudzums"),
  unit_price_net: z.number({ error: "Ievadiet cenu" }).min(0, "Cena nevar būt negatīva").max(1_000_000, "Pārāk liela cena"),
});

export const manualOrderSchema = z
  .object({
    user_id: uuid.nullable(),
    email: text(200).refine((v) => v === "" || EMAIL_RE.test(v), "Nederīgs e-pasts"),
    phone: text(50),
    market,
    locale: z.enum(ORDER_LOCALES),
    customer: z.object({
      customer_type: z.enum(["private", "business"]),
      name: text(200),
      company_name: text(200),
      reg_no: text(50),
      vat_no: text(40),
      legal_address: text(300),
    }),
    billing_address: address,
    shipping_address: address,
    shipping_point: z.object({ name: text(200) }).nullable(),
    shipping_method: z.enum(["pickup", "parcel_locker", "courier", "freight"], { error: "Nederīgs piegādes veids" }),
    shipping_net: z.number({ error: "Ievadiet piegādes cenu" }).min(0, "Nevar būt negatīva").max(100000),
    payment_method: z.enum(["bank_transfer", "invoice", "card", "cash_on_pickup"], { error: "Nederīgs apmaksas veids" }),
    payment_status: z.enum(["unpaid", "paid"]),
    status: z.enum(["new", "confirmed"]),
    document: z.enum(DOCUMENTS),
    due_days: z.number({ error: "Ievadiet dienas" }).int("Veselas dienas").min(0, "0–120").max(120, "0–120"),
    discount_percent: z.number({ error: "Ievadiet atlaidi" }).min(0, "0–90%").max(90, "0–90%"),
    reverse_charge: z.boolean().nullable(),
    notes: text(2000),
    admin_notes: text(5000),
    send_email: z.boolean(),
    items: z.array(manualLineSchema).min(1, "Pievienojiet vismaz vienu rindu").max(200, "Maksimums 200 rindas"),
  })
  .superRefine((o, ctx) => {
    const c = o.customer;
    if (c.customer_type === "business" && !c.company_name) ctx.addIssue({ code: "custom", path: ["customer", "company_name"], message: "Norādiet uzņēmuma nosaukumu" });
    if (c.customer_type === "private" && !c.name) ctx.addIssue({ code: "custom", path: ["customer", "name"], message: "Norādiet vārdu, uzvārdu" });
    if (o.reverse_charge === true && (o.market === "LV" || !normalizeVatNo(c.vat_no) || c.customer_type !== "business")) {
      ctx.addIssue({ code: "custom", path: ["reverse_charge"], message: "Reverse charge — tikai uzņēmumam ārpus Latvijas ar PVN numuru" });
    }
    if (o.send_email && !o.email) ctx.addIssue({ code: "custom", path: ["email"], message: "E-pasta nosūtīšanai norādiet e-pastu" });
    o.items.forEach((l, i) => {
      if (l.kind === "product" && !l.variant_id) ctx.addIssue({ code: "custom", path: ["items", i, "name"], message: "Izvēlieties preci" });
      if (l.kind === "custom" && !l.name) ctx.addIssue({ code: "custom", path: ["items", i, "name"], message: "Ievadiet nosaukumu" });
    });
  });

export type ManualOrderPayload = z.input<typeof manualOrderSchema>;
export type ManualOrderParsed = z.output<typeof manualOrderSchema>;

export type ManualOrderResult = {
  id: string;
  number: string;
  invoice_number: string | null;
  final_invoice_number: string | null;
  total_gross: number;
};

// ───────────────────────── calculations ─────────────────────────
export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

export function normalizeVatNo(v: string | null | undefined) {
  return (v ?? "").replace(/\s+/g, "").toUpperCase();
}

/** Same rule as admin_create_order(): EU business outside LV with a (non-LV) VAT number. */
export function autoReverseCharge(customerType: string, market: string, vatNo: string | null | undefined) {
  const v = normalizeVatNo(vatNo);
  return customerType === "business" && market !== "LV" && /^[A-Z]{2}[0-9A-Z]{2,13}$/.test(v) && !v.startsWith("LV");
}

/** Default net unit price of a catalog variant for a customer with `b2bDiscount` %. */
export function catalogUnitNet(priceNet: number, b2bDiscount: number) {
  return r4(priceNet * (1 - b2bDiscount / 100));
}

export type CalcLine = { qty: number; unit_price_net: number };

export function calcManualOrder(lines: CalcLine[], opts: { discountPercent: number; shippingNet: number; vatRate: number }) {
  const d = Math.min(90, Math.max(0, opts.discountPercent || 0));
  let before = 0;
  let subtotal = 0;
  const out = lines.map((l) => {
    const qty = Number.isFinite(l.qty) ? l.qty : 0;
    const base = r4(Number.isFinite(l.unit_price_net) ? l.unit_price_net : 0);
    const unit = r4(base * (1 - d / 100));
    const line = r2(unit * qty);
    before += r2(base * qty);
    subtotal += line;
    return { unit, line, vat: r2((line * opts.vatRate) / 100) };
  });
  subtotal = r2(subtotal);
  const shipping = r2(Math.max(0, opts.shippingNet || 0));
  const net = r2(subtotal + shipping);
  const vat = r2((net * opts.vatRate) / 100);
  return { lines: out, discount: r2(before - subtotal), subtotal, shipping, net, vat, total: r2(net + vat) };
}

/** Latvian messages for exceptions raised by admin_create_order(). */
export const MANUAL_ORDER_ERRORS: Record<string, string> = {
  forbidden: "Nav tiesību veikt šo darbību.",
  invalid_market: "Nederīgs tirgus.",
  invalid_shipping: "Nederīgs piegādes veids.",
  invalid_payment: "Nederīgs apmaksas veids.",
  invalid_document: "Nederīgs dokumenta veids.",
  invalid_payment_status: "Nederīgs apmaksas statuss.",
  invalid_status: "Nederīgs pasūtījuma statuss.",
  invalid_due_days: "Apmaksas termiņam jābūt 0–120 dienas.",
  invalid_discount: "Atlaidei jābūt 0–90%.",
  invalid_shipping_price: "Nederīga piegādes cena.",
  invalid_email: "Nederīgs e-pasts.",
  empty_cart: "Pievienojiet vismaz vienu rindu.",
  too_many_items: "Pārāk daudz rindu (maks. 200).",
  customer_not_found: "Izvēlētais klients nav atrasts.",
  company_required: "Norādiet uzņēmuma nosaukumu.",
  name_required: "Norādiet klienta vārdu vai uzņēmumu.",
  reverse_charge_invalid: "Reverse charge var piemērot tikai uzņēmumam ārpus Latvijas ar PVN numuru.",
  invalid_qty: "Nederīgs daudzums.",
  variant_not_found: "Prece vairs nav atrodama katalogā.",
  line_name_required: "Brīvai rindai ievadiet nosaukumu.",
  invalid_price: "Nederīga cena.",
};
