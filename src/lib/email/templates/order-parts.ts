import { esc, money, num, type EmailContext, type ItemRow, type TotalRow } from "./layout";

/** Order snapshot used by all order e-mails (built from the `orders` row or from the checkout payload). */
export type OrderEmailData = {
  id: string;
  number: string;
  created_at: string;
  locale: string;
  email: string;
  phone: string | null;
  user_id: string | null;
  status?: string;
  payment_status?: string;
  customer: {
    name?: string | null;
    company_name?: string | null;
    reg_no?: string | null;
    vat_no?: string | null;
    customer_type?: string | null;
    b2b?: boolean | null;
    discount_percent?: number | string | null;
  };
  market: string;
  payment_method: string;
  shipping_method: string;
  shipping_point: { provider?: string | null; id?: string | null; name?: string | null; city?: string | null; address?: string | null } | null;
  shipping_address: { street?: string | null; city?: string | null; postal_code?: string | null; country?: string | null } | null;
  billing_address?: { street?: string | null; city?: string | null; postal_code?: string | null; country?: string | null } | null;
  items: { name: string; pack_label: string | null; sku: string | null; qty: number; unit_price_net: number; line_net: number }[];
  subtotal_net: number;
  shipping_net: number;
  vat_rate: number;
  vat_amount: number;
  total_gross: number;
  reverse_charge: boolean;
  notes: string | null;
  tracking_code?: string | null;
  tracking_url?: string | null;
  tracking_carrier?: string | null;
};

const PROVIDERS: Record<string, string> = {
  omniva: "Omniva",
  dpd: "DPD",
  smartpost: "SmartPosti",
  smartposti: "SmartPosti",
  itella: "SmartPosti",
  venipak: "Venipak",
  unisend: "Unisend",
  lp_express: "LP Express",
  latvijas_pasts: "Latvijas Pasts",
  dhl: "DHL",
};

export function providerName(code: string | null | undefined) {
  if (!code) return "";
  return PROVIDERS[code.toLowerCase()] ?? code.charAt(0).toUpperCase() + code.slice(1);
}

const COUNTRY: Record<string, Record<string, string>> = {
  lv: { LV: "Latvija", EE: "Igaunija", LT: "Lietuva" },
  et: { LV: "Läti", EE: "Eesti", LT: "Leedu" },
  lt: { LV: "Latvija", EE: "Estija", LT: "Lietuva" },
  en: { LV: "Latvia", EE: "Estonia", LT: "Lithuania" },
  ru: { LV: "Латвия", EE: "Эстония", LT: "Литва" },
};

export function formatAddress(a: OrderEmailData["shipping_address"], locale: string) {
  if (!a) return "";
  const country = a.country ? COUNTRY[locale]?.[a.country] ?? a.country : "";
  return [a.street, [a.postal_code, a.city].filter(Boolean).join(" "), country].filter((s) => s && String(s).trim()).join(", ");
}

/** B2B customers see net prices (like on the site); everyone else gross. */
export function isNetView(o: OrderEmailData) {
  return Boolean(o.customer?.b2b) || o.reverse_charge;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const grossOf = (net: number, rate: number) => r2(net * (1 + rate / 100));

export function itemRows(o: OrderEmailData, ctx: EmailContext): ItemRow[] {
  const net = isNetView(o);
  const rate = num(o.vat_rate);
  return o.items.map((it) => {
    const unit = net ? num(it.unit_price_net) : grossOf(num(it.unit_price_net), rate);
    const line = net ? num(it.line_net) : grossOf(num(it.line_net), rate);
    const meta = [it.pack_label, it.sku && ctx.t("items.sku", { sku: it.sku })].filter(Boolean).join(" · ");
    return {
      name: it.name,
      meta: meta || null,
      qtyLine: ctx.t("items.qtyPrice", { qty: it.qty, price: money(unit, ctx.locale) }),
      total: money(line, ctx.locale),
    };
  });
}

export function totalRows(o: OrderEmailData, ctx: EmailContext): TotalRow[] {
  const { t, locale } = ctx;
  const net = isNetView(o);
  const rate = num(o.vat_rate);
  const total = num(o.total_gross);
  const shipNet = num(o.shipping_net);
  const shipValue = (v: number) => (v > 0 ? money(v, locale) : o.shipping_method === "freight" ? t("totals.onRequest") : t("totals.free"));
  const rows: TotalRow[] = [];
  if (net) {
    rows.push({ label: t("totals.subtotalNet"), value: money(num(o.subtotal_net), locale) });
    rows.push({ label: t("totals.shippingNet"), value: shipValue(shipNet) });
    if (o.reverse_charge) rows.push({ label: t("totals.vat", { rate: 0 }), value: money(0, locale) });
    else rows.push({ label: t("totals.vat", { rate: fmtRate(rate, locale) }), value: money(num(o.vat_amount), locale) });
    rows.push({ label: t("totals.total"), value: money(total, locale), strong: true });
    if (o.reverse_charge) rows.push({ label: t("totals.reverseCharge"), value: "", note: true });
  } else {
    const shipGross = grossOf(shipNet, rate);
    rows.push({ label: t("totals.subtotal"), value: money(r2(total - shipGross), locale) });
    rows.push({ label: t("totals.shipping"), value: shipValue(shipGross) });
    rows.push({ label: t("totals.total"), value: money(total, locale), strong: true });
    rows.push({ label: t("totals.vatIncluded", { rate: fmtRate(rate, locale), amount: money(num(o.vat_amount), locale) }), value: "", note: true });
  }
  return rows;
}

function fmtRate(rate: number, locale: string) {
  return new Intl.NumberFormat(locale === "en" ? "en-IE" : `${locale}`, { maximumFractionDigits: 2 }).format(rate);
}

/** Shipping choice as [title, detail] (plain strings, not escaped). */
export function shippingSummary(o: OrderEmailData, ctx: EmailContext): { method: string; detail: string } {
  const { t, locale } = ctx;
  const method = t(`shipping.methods.${o.shipping_method in METHOD_KEYS ? o.shipping_method : "courier"}`);
  if (o.shipping_method === "pickup") {
    return { method, detail: t("shipping.pickupAddress", { address: ctx.company.warehouse || ctx.company.address }) };
  }
  if (o.shipping_method === "parcel_locker") {
    const pt = o.shipping_point;
    const name = [providerName(pt?.provider), pt?.name].filter(Boolean).join(" · ");
    const addr = [pt?.address, pt?.city].filter(Boolean).join(", ");
    return { method, detail: [name, addr].filter(Boolean).join(" — ") };
  }
  return { method, detail: formatAddress(o.shipping_address, locale) };
}

const METHOD_KEYS = { pickup: 1, parcel_locker: 1, courier: 1, freight: 1 } as const;
const PAYMENT_KEYS = { bank_transfer: 1, card: 1, invoice: 1, cash_on_pickup: 1, montonio_bank: 1, montonio_card: 1 } as const;

export function paymentLabel(o: OrderEmailData, ctx: EmailContext) {
  return o.payment_method in PAYMENT_KEYS ? ctx.t(`payment.methods.${o.payment_method}`) : o.payment_method;
}

/** Customer / company line for summaries. */
export function customerLines(o: OrderEmailData) {
  const c = o.customer ?? {};
  return [c.company_name, c.name].filter(Boolean).map(String);
}

export function escJoin(parts: (string | null | undefined)[], sep = "<br>") {
  return parts
    .filter((s) => s && String(s).trim())
    .map(esc)
    .join(sep);
}
