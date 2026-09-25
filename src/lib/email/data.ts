import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { packLabel } from "@/lib/commerce";
import type { InvoiceData } from "@/lib/admin/invoice-pdf";
import type { EmailCompany } from "./templates/layout";
import type { OrderEmailData } from "./templates/order-parts";

/** Any Supabase client (session / admin) — RLS decides what it can read. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;

const n = (v: unknown) => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};

const ORDER_COLS =
  "id, number, created_at, locale, email, phone, user_id, status, payment_status, customer, market, payment_method, shipping_method, shipping_point, shipping_address, billing_address, subtotal_net, shipping_net, vat_rate, vat_amount, total_gross, reverse_charge, notes, tracking_code, tracking_url, tracking_carrier, order_items(name, pack_label, sku, qty, unit_price_net, line_net)";

type OrderRow = Omit<OrderEmailData, "items"> & {
  order_items: { name: string; pack_label: string | null; sku: string | null; qty: number; unit_price_net: number | string; line_net: number | string }[] | null;
};

export function normalizeOrder(row: OrderRow): OrderEmailData {
  const { order_items, ...o } = row;
  return {
    ...o,
    customer: (o.customer ?? {}) as OrderEmailData["customer"],
    subtotal_net: n(o.subtotal_net),
    shipping_net: n(o.shipping_net),
    vat_rate: n(o.vat_rate),
    vat_amount: n(o.vat_amount),
    total_gross: n(o.total_gross),
    reverse_charge: Boolean(o.reverse_charge),
    items: (order_items ?? [])
      .map((i) => ({ ...i, qty: n(i.qty), unit_price_net: n(i.unit_price_net), line_net: n(i.line_net) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Loads an order with items. Returns null when RLS hides it (e.g. guest checkout) or on error. */
export async function loadOrderForEmail(db: Db, orderId: string): Promise<OrderEmailData | null> {
  const { data, error } = await db.from("orders").select(ORDER_COLS).eq("id", orderId).maybeSingle();
  if (error || !data) return null;
  return normalizeOrder(data as unknown as OrderRow);
}

// ───────────────────────── guest checkout fallback ─────────────────────────

type CheckoutPayload = {
  email: string;
  phone: string;
  market: string;
  locale: string;
  customer: OrderEmailData["customer"];
  shipping_method: string;
  shipping_point: OrderEmailData["shipping_point"];
  shipping_address: OrderEmailData["shipping_address"];
  billing_address: OrderEmailData["billing_address"];
  payment_method: string;
  notes: string | null;
  items: { slug: string; sku: string | null; size: number | null; unit: string; qty: number }[];
};

type RpcResult = {
  id: string;
  number: string;
  total_gross: number | string;
  subtotal_net?: number | string;
  shipping_net?: number | string;
  vat_rate?: number | string;
  vat_amount?: number | string;
  reverse_charge?: boolean;
};

type VariantRow = { sku: string | null; size: number | string | null; unit: string; price_net: number | string; is_active?: boolean };
type ProductRow = { slug: string; i18n: Record<string, { name?: string }> | null; product_variants: VariantRow[] | null };

/**
 * Guests cannot read their order back (RLS), so the confirmation is rebuilt from the validated checkout
 * payload + the `place_order` result (authoritative totals) + public catalog data (names / prices),
 * using the same matching and rounding as `place_order` (guests never get a B2B discount).
 */
export async function orderFromCheckout(db: Db, payload: CheckoutPayload, rpc: RpcResult): Promise<OrderEmailData> {
  const slugs = [...new Set(payload.items.map((i) => i.slug))];
  const { data } = await db.from("products").select("slug, i18n, product_variants(sku, size, unit, price_net, is_active)").in("slug", slugs);
  const products = (data ?? []) as unknown as ProductRow[];
  const items = payload.items.map((it) => {
    const p = products.find((x) => x.slug === it.slug);
    const variants = (p?.product_variants ?? []).filter((v) => v.is_active !== false);
    const v = it.sku
      ? variants.find((x) => x.sku === it.sku)
      : variants.find((x) => x.sku == null && n(x.size) === n(it.size) && x.unit === it.unit);
    const name = p?.i18n?.[payload.locale]?.name || p?.i18n?.lv?.name || it.slug;
    const unit = Math.round(n(v?.price_net) * 10000) / 10000;
    const qty = Math.max(1, Math.min(999, Math.round(it.qty)));
    return {
      name,
      pack_label: (v ? packLabel({ size: v.size == null ? null : n(v.size), unit: v.unit }) : packLabel({ size: it.size, unit: it.unit })) || null,
      sku: v?.sku ?? it.sku ?? null,
      qty,
      unit_price_net: unit,
      line_net: Math.round(unit * qty * 100) / 100,
    };
  });
  const subtotal = rpc.subtotal_net != null ? n(rpc.subtotal_net) : items.reduce((s, i) => s + i.line_net, 0);
  return {
    id: rpc.id,
    number: rpc.number,
    created_at: new Date().toISOString(),
    locale: payload.locale,
    email: payload.email.trim().toLowerCase(),
    phone: payload.phone || null,
    user_id: null,
    status: "new",
    payment_status: "unpaid",
    customer: { ...payload.customer, b2b: false, discount_percent: 0 },
    market: payload.market,
    payment_method: payload.payment_method,
    shipping_method: payload.shipping_method,
    shipping_point: payload.shipping_point,
    shipping_address: payload.shipping_address,
    billing_address: payload.billing_address,
    items: items.sort((a, b) => a.name.localeCompare(b.name)),
    subtotal_net: subtotal,
    shipping_net: n(rpc.shipping_net),
    vat_rate: n(rpc.vat_rate),
    vat_amount: n(rpc.vat_amount),
    total_gross: n(rpc.total_gross),
    reverse_charge: Boolean(rpc.reverse_charge),
    notes: payload.notes,
  };
}

// ───────────────────────── invoices ─────────────────────────

const INVOICE_COLS =
  "id, number, type, status, issued_at, due_at, paid_at, buyer, seller, lines, subtotal_net, vat_rate, vat_amount, total_gross, reverse_charge, notes, order_id, user_id";

export type InvoiceRow = Omit<InvoiceData, "order_number" | "default_notes"> & { id: string; order_id: string | null; user_id: string | null };

export async function loadInvoiceByNumber(db: Db, number: string): Promise<InvoiceRow | null> {
  const { data, error } = await db.from("invoices").select(INVOICE_COLS).eq("number", number).maybeSingle();
  if (error || !data) return null;
  const inv = data as unknown as InvoiceRow;
  return { ...inv, lines: Array.isArray(inv.lines) ? inv.lines : [], buyer: inv.buyer ?? {}, seller: inv.seller ?? {} };
}

const SHIP_LINE: Record<string, string> = { courier: "Piegāde ar kurjeru", parcel_locker: "Piegāde uz pakomātu", freight: "Kravas piegāde" };

function rigaDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Riga", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Mirrors `issue_invoice()` for the guest proforma (which the guest cannot read back). */
export function proformaFromOrder(o: OrderEmailData, number: string, company: EmailCompany, dueDays = 7): InvoiceData {
  const lines: InvoiceData["lines"] = o.items.map((i) => ({ sku: i.sku, name: i.name, pack: i.pack_label, qty: i.qty, unit_net: i.unit_price_net, line_net: i.line_net }));
  if (o.shipping_net > 0) lines.push({ sku: null, name: SHIP_LINE[o.shipping_method] ?? "Piegāde", pack: null, qty: 1, unit_net: o.shipping_net, line_net: o.shipping_net });
  return {
    number,
    type: "proforma",
    status: "issued",
    issued_at: rigaDate(),
    due_at: rigaDate(dueDays),
    buyer: { ...o.customer, email: o.email, phone: o.phone, address: o.billing_address ?? o.shipping_address },
    seller: company as unknown as Record<string, unknown>,
    lines,
    subtotal_net: Math.round((o.subtotal_net + o.shipping_net) * 100) / 100,
    vat_rate: o.vat_rate,
    vat_amount: o.vat_amount,
    total_gross: o.total_gross,
    reverse_charge: o.reverse_charge,
    notes: null,
    order_number: o.number,
    default_notes: null,
  };
}

/** Renders the invoice PDF (lazy import keeps @react-pdf out of the hot path). Returns null on failure. */
export async function invoicePdf(inv: InvoiceData): Promise<{ filename: string; content: Buffer } | null> {
  try {
    const { renderInvoicePdf } = await import("@/lib/admin/invoice-pdf");
    const content = await renderInvoicePdf(inv);
    return { filename: `${inv.number.replace(/[^\w.-]+/g, "_")}.pdf`, content };
  } catch (e) {
    console.error("[email] invoice PDF failed", e);
    return null;
  }
}
