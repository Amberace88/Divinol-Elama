import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { INVOICE_STATUS, INVOICE_TYPE, MARKETS, ORDER_STATUSES, PAYMENT_STATUSES } from "./labels";
import { sp, spDate, spEnum, type SP } from "./params";
import { sanitizeSearch } from "./server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Offset of Europe/Riga for a given calendar day, e.g. "+03:00". */
function rigaOffset(day: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Riga", timeZoneName: "longOffset" }).formatToParts(
      new Date(`${day}T12:00:00Z`),
    );
    const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+02:00";
    const m = tz.match(/GMT([+-]\d{2}:\d{2})/);
    return m ? m[1] : "+02:00";
  } catch {
    return "+02:00";
  }
}

export function rigaDayStart(day: string) {
  return `${day}T00:00:00${rigaOffset(day)}`;
}
export function rigaDayEnd(day: string) {
  return `${day}T23:59:59.999${rigaOffset(day)}`;
}

// ───────────── orders ─────────────
export const ORDER_SORTS = { created: "created_at", total: "total_gross", number: "number" } as const;
export type OrderSort = keyof typeof ORDER_SORTS;

export type OrderFilters = {
  status: string | null;
  pay: string | null;
  market: string | null;
  from: string | null;
  to: string | null;
  q: string;
  sort: OrderSort;
  dir: "asc" | "desc";
};

export function parseOrderFilters(params: SP): OrderFilters {
  return {
    status: spEnum(params, "status", [...ORDER_STATUSES, "open"], null),
    pay: spEnum(params, "pay", PAYMENT_STATUSES, null),
    market: spEnum(params, "market", MARKETS, null),
    from: spDate(params, "from"),
    to: spDate(params, "to"),
    q: sanitizeSearch(sp(params, "q")),
    sort: spEnum(params, "sort", Object.keys(ORDER_SORTS) as OrderSort[], "created"),
    dir: spEnum(params, "dir", ["asc", "desc"] as const, "desc"),
  };
}

export function ordersQuery(supabase: Supabase, f: OrderFilters, select: string, count = false) {
  let q = supabase.from("orders").select(select, count ? { count: "exact" } : undefined);
  if (f.status === "open") q = q.in("status", ["new", "confirmed", "processing"]);
  else if (f.status) q = q.eq("status", f.status);
  if (f.pay) q = q.eq("payment_status", f.pay);
  if (f.market) q = q.eq("market", f.market);
  if (f.from) q = q.gte("created_at", rigaDayStart(f.from));
  if (f.to) q = q.lte("created_at", rigaDayEnd(f.to));
  if (f.q) {
    const s = f.q;
    q = q.or(
      `number.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,customer->>name.ilike.%${s}%,customer->>company_name.ilike.%${s}%`,
    );
  }
  q = q.order(ORDER_SORTS[f.sort], { ascending: f.dir === "asc" });
  if (f.sort !== "created") q = q.order("created_at", { ascending: false });
  return q;
}

export type OrderRow = {
  id: string;
  number: string;
  created_at: string;
  email: string;
  phone: string | null;
  customer: { name?: string; company_name?: string; reg_no?: string; vat_no?: string; customer_type?: string; b2b?: boolean } | null;
  market: string;
  status: string;
  payment_method: string;
  payment_status: string;
  shipping_method: string;
  subtotal_net: number | string;
  shipping_net: number | string;
  vat_amount: number | string;
  total_gross: number | string;
  reverse_charge: boolean;
  tracking_code: string | null;
  paid_at: string | null;
  /** 'web' (e-shop checkout) | 'admin' (entered in the admin, migration 0010) */
  source?: string | null;
};

export const ORDER_LIST_SELECT =
  "id, number, created_at, email, phone, customer, market, status, payment_method, payment_status, shipping_method, subtotal_net, shipping_net, vat_amount, total_gross, reverse_charge, tracking_code, paid_at, source";

export function customerName(c: OrderRow["customer"], fallback = "—") {
  return c?.company_name || c?.name || fallback;
}

// ───────────── invoices ─────────────
export type InvoiceFilters = {
  type: string | null;
  status: string | null;
  overdue: boolean;
  from: string | null;
  to: string | null;
  q: string;
};

export function parseInvoiceFilters(params: SP): InvoiceFilters {
  return {
    type: spEnum(params, "type", Object.keys(INVOICE_TYPE), null),
    status: spEnum(params, "status", Object.keys(INVOICE_STATUS), null),
    overdue: sp(params, "overdue") === "1",
    from: spDate(params, "from"),
    to: spDate(params, "to"),
    q: sanitizeSearch(sp(params, "q")),
  };
}

/** Invoice list / export filters (issued_at is a Riga calendar date). `today` = todayRiga(). */
export function invoicesQuery(supabase: Supabase, f: InvoiceFilters, select: string, today: string, count = false) {
  let q = supabase.from("invoices").select(select, count ? { count: "exact" } : undefined);
  if (f.type) q = q.eq("type", f.type);
  if (f.status) q = q.eq("status", f.status);
  if (f.overdue) q = q.eq("status", "issued").neq("type", "credit_note").lt("due_at", today);
  if (f.from) q = q.gte("issued_at", f.from);
  if (f.to) q = q.lte("issued_at", f.to);
  if (f.q) q = q.or(`number.ilike.%${f.q}%,buyer->>name.ilike.%${f.q}%,buyer->>company_name.ilike.%${f.q}%,buyer->>email.ilike.%${f.q}%`);
  return q;
}
