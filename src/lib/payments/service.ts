import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { absoluteUrl, siteUrl } from "@/lib/seo";
import { createServiceClient } from "@/lib/supabase/service";
import { deferEmail } from "@/lib/email/send";
import { notifyOnlinePaymentReceived, notifyOrderSwitchedToTransfer } from "@/lib/email/notify";
import { createPaymentOrder, getPaymentOrder, isMontonioConfigured, type OnlineMethod as MontonioMethod } from "./montonio";
import { createCheckoutSession, expireSession, isStripeConfigured, retrieveSession, sessionMeta, sessionStatus } from "./stripe";

/**
 * Glue between orders (Supabase, service role) and the online payment providers — Stripe (primary) and Montonio.
 * All state changes go through the SQL functions of migrations 0011 / 0015, which are idempotent and serialised by
 * a row lock, so the webhook, the return page and the admin "re-check" button may all run for the same payment in
 * any order and any number of times.
 */

export type OnlineMethod = MontonioMethod | "stripe";
export const ONLINE_METHODS: OnlineMethod[] = ["stripe", "montonio_bank", "montonio_card"];
export const isOnlineMethod = (m: string | null | undefined): m is OnlineMethod => m === "stripe" || m === "montonio_bank" || m === "montonio_card";

/** Is the provider behind this online method configured (keys + service role)? */
export function isMethodConfigured(m: OnlineMethod) {
  return m === "stripe" ? isStripeConfigured() : isMontonioConfigured();
}

/** Any online payment provider configured (return page / pay-again links work). */
export function isOnlinePaymentsConfigured() {
  return isStripeConfigured() || isMontonioConfigured();
}

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

// ───────────────────────── signed return links ─────────────────────────
// The return page / "pay again" / "switch to bank transfer" act on an order without a user session (guests), so
// they require ?o=<order id>&s=<HMAC(secret, order id)> — only links we generated can touch an order.

function secret() {
  // a dedicated secret survives switching / rotating provider keys; otherwise any configured provider secret
  const s = process.env.PAYMENT_LINK_SECRET?.trim() || process.env.MONTONIO_SECRET_KEY?.trim() || process.env.STRIPE_SECRET_KEY?.trim();
  if (!s) throw new PaymentError("Online payments are not configured");
  return s;
}

export function orderSignature(orderId: string) {
  return createHmac("sha256", secret()).update(`divinol-payment:${orderId}`).digest("base64url").slice(0, 32);
}

export function verifyOrderSignature(orderId: string | null | undefined, sig: string | null | undefined) {
  if (!orderId || !sig || !/^[0-9a-f-]{36}$/i.test(orderId) || sig.length !== 32) return false;
  try {
    const a = Buffer.from(orderSignature(orderId));
    const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const toLocale = (v: string | null | undefined): Locale => (v && hasLocale(routing.locales, v) ? v : routing.defaultLocale);

export function paymentReturnUrl(orderId: string, locale: string) {
  const base = absoluteUrl("/checkout/return", toLocale(locale));
  return `${base}?o=${encodeURIComponent(orderId)}&s=${orderSignature(orderId)}`;
}

export function stripeWebhookUrl() {
  return `${siteUrl("lv").replace(/\/$/, "")}/api/payments/stripe/webhook`;
}

export function notificationUrl() {
  return `${siteUrl("lv").replace(/\/$/, "")}/api/payments/montonio/webhook`;
}

// ───────────────────────── orders ─────────────────────────

export type PaymentOrderRow = {
  id: string;
  number: string;
  email: string;
  locale: string;
  market: string;
  status: string;
  payment_method: string;
  payment_status: string;
  payment_provider: string | null;
  payment_ref: string | null;
  payment_meta: Record<string, unknown> | null;
  total_gross: number | string;
  vat_rate: number | string;
  shipping_net: number | string;
  shipping_method: string;
  customer: { name?: string; company_name?: string | null } | null;
  shipping_address: { street?: string; city?: string; postal_code?: string } | null;
  billing_address: { street?: string; city?: string; postal_code?: string } | null;
  paid_at: string | null;
};

const ORDER_COLS =
  "id, number, email, locale, market, status, payment_method, payment_status, payment_provider, payment_ref, payment_meta, total_gross, vat_rate, shipping_net, shipping_method, customer, shipping_address, billing_address, paid_at";

export async function loadPaymentOrder(orderId: string): Promise<PaymentOrderRow | null> {
  const db = createServiceClient();
  const { data, error } = await db.from("orders").select(ORDER_COLS).eq("id", orderId).maybeSingle();
  if (error) throw error;
  return (data as PaymentOrderRow | null) ?? null;
}

export async function findOrderByNumber(number: string): Promise<PaymentOrderRow | null> {
  const db = createServiceClient();
  const { data, error } = await db.from("orders").select(ORDER_COLS).eq("number", number).maybeSingle();
  if (error) throw error;
  return (data as PaymentOrderRow | null) ?? null;
}

export async function findOrderByPaymentRef(ref: string): Promise<PaymentOrderRow | null> {
  const db = createServiceClient();
  const { data, error } = await db.from("orders").select(ORDER_COLS).eq("payment_ref", ref).limit(1).maybeSingle();
  if (error) throw error;
  return (data as PaymentOrderRow | null) ?? null;
}

export async function finalInvoiceOf(orderId: string): Promise<string | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("invoices")
    .select("number")
    .eq("order_id", orderId)
    .eq("type", "invoice")
    .neq("status", "void")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ number: string }>();
  return data?.number ?? null;
}

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Creates the provider payment (Stripe Checkout Session / Montonio order) for an unpaid online order and records it
 * (payment_attach). Returns the URL of the provider's hosted payment page.
 * Throws PaymentError / provider errors / DB errors — the caller decides what to do with the order.
 */
export async function startPayment(orderId: string, method: OnlineMethod, opts: { preferredProvider?: string | null; locale?: string } = {}) {
  if (!isMethodConfigured(method)) throw new PaymentError(`${method} is not configured`);
  const db = createServiceClient();
  const order = await loadPaymentOrder(orderId);
  if (!order) throw new PaymentError("Order not found");
  if (order.status === "cancelled" || !["pending", "failed"].includes(order.payment_status) || !isOnlineMethod(order.payment_method)) {
    throw new PaymentError("payment_not_allowed");
  }
  const { data: items } = await db.from("order_items").select("name, pack_label, qty, line_net").eq("order_id", orderId).order("name");
  const vat = num(order.vat_rate);
  const gross = (net: number) => Math.round(net * (1 + vat / 100) * 100) / 100;
  const lineItems = ((items ?? []) as { name: string; pack_label: string | null; qty: number; line_net: number | string }[]).map((i) => ({
    name: [i.name, i.pack_label].filter(Boolean).join(" "),
    quantity: 1,
    finalPrice: gross(num(i.line_net)),
  }));
  // quantity 1 with the line total keeps the sum exact; lines are only sent if they add up (see createPaymentOrder)
  if (num(order.shipping_net) > 0) lineItems.push({ name: "Piegāde", quantity: 1, finalPrice: gross(num(order.shipping_net)) });

  const locale = opts.locale || order.locale;

  if (method === "stripe") {
    // "pay again": close the previous, still open session so the customer cannot pay twice
    if (order.payment_provider === "stripe" && order.payment_ref) {
      await expireSession(order.payment_ref).catch(() => null);
    }
    const returnUrl = paymentReturnUrl(order.id, locale);
    const session = await createCheckoutSession({
      orderId: order.id,
      orderNumber: order.number,
      email: order.email,
      locale,
      total: num(order.total_gross),
      lines: lineItems.map((l) => ({ name: l.name, amount: l.finalPrice })),
      successUrl: `${returnUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${returnUrl}&cancelled=1`,
      description: `Divinol ${order.number}`,
    });
    const { error } = await db.rpc("payment_attach", {
      p_order: order.id,
      p_ref: session.id,
      p_method: "stripe",
      p_meta: { method: "stripe", env: process.env.STRIPE_SECRET_KEY?.trim().match(/^(sk|rk)_live_/) ? "live" : "test" },
    });
    if (error) throw error;
    return session.url as string;
  }

  const addr = order.billing_address ?? order.shipping_address ?? null;
  const created = await createPaymentOrder({
    merchantReference: order.number,
    grandTotal: num(order.total_gross),
    locale,
    country: order.market,
    method: method as MontonioMethod,
    preferredProvider: method === "montonio_bank" ? opts.preferredProvider ?? null : null,
    returnUrl: paymentReturnUrl(order.id, locale),
    notificationUrl: notificationUrl(),
    description: `Divinol ${order.number}`,
    customer: {
      name: order.customer?.name?.trim() || order.customer?.company_name?.trim() || order.email,
      email: order.email,
      companyName: order.customer?.company_name ?? null,
      street: addr?.street ?? null,
      city: addr?.city ?? null,
      postalCode: addr?.postal_code ?? null,
    },
    lineItems,
  });

  const { error } = await db.rpc("payment_attach", {
    p_order: order.id,
    p_ref: created.uuid,
    p_method: method,
    p_meta: { method, preferred_provider: opts.preferredProvider ?? null, env: process.env.MONTONIO_ENV?.trim() || "sandbox" },
  });
  if (error) throw error;
  return created.paymentUrl;
}

export type ApplyResult = {
  found: boolean;
  changed: boolean;
  payment_status?: string;
  status?: string;
  final_invoice?: string | null;
  amount_mismatch?: boolean;
  cancelled?: boolean;
  reopened?: boolean;
  ignored?: string;
};

/**
 * Applies a Montonio status to the order (idempotent). When THIS call marked the order paid, the customer gets the
 * order confirmation with the final invoice (issued by the DB trigger) attached, and the shop gets its new-order
 * notification — both after the response, never blocking the webhook.
 */
export async function applyPaymentStatus(
  orderId: string,
  input: { ref: string | null; status: string; amount?: number | null; currency?: string | null; meta?: Record<string, unknown> },
): Promise<ApplyResult> {
  const db = createServiceClient();
  const amount = input.amount == null || !Number.isFinite(Number(input.amount)) ? null : Number(input.amount);
  // a non-EUR amount can never match the order → the SQL function records a warning instead of marking it paid
  const checked = amount != null && input.currency && input.currency.toUpperCase() !== "EUR" ? -1 : amount;
  const meta = Object.fromEntries(Object.entries(input.meta ?? {}).filter(([, v]) => v != null && v !== ""));
  const { data, error } = await db.rpc("payment_apply_status", {
    p_order: orderId,
    p_ref: input.ref,
    p_status: input.status,
    p_amount: checked,
    p_meta: meta,
  });
  if (error) throw error;
  const r = data as ApplyResult;
  if (r.changed && r.payment_status === "paid") {
    const invoice = r.final_invoice ?? null;
    deferEmail("online payment received", () => notifyOnlinePaymentReceived(db, orderId, invoice));
  }
  return r;
}

/** Fetches the authoritative status from the provider (Stripe session / Montonio order) and applies it. */
export async function syncPayment(orderId: string): Promise<ApplyResult & { providerStatus?: string }> {
  const order = await loadPaymentOrder(orderId);
  if (!order) return { found: false, changed: false };
  if (order.payment_provider === "stripe" && order.payment_ref) {
    const session = await retrieveSession(order.payment_ref);
    const m = sessionStatus(session);
    const label = `${session.status ?? "?"} / ${session.payment_status}`;
    if (m.status === "PENDING") return { found: true, changed: false, payment_status: order.payment_status, status: order.status, providerStatus: label };
    // a refunded session was PAID first — make sure "paid" (and the final invoice) is recorded before the refund
    if (m.status === "REFUNDED" || m.status === "PARTIALLY_REFUNDED") {
      await applyPaymentStatus(order.id, { ref: session.id, status: "PAID", amount: m.amount, currency: m.currency, meta: sessionMeta(session) });
    }
    const r = await applyPaymentStatus(order.id, { ref: session.id, status: m.status, amount: m.amount, currency: m.currency, meta: sessionMeta(session) });
    return { ...r, providerStatus: label };
  }
  if (order.payment_provider !== "montonio" || !order.payment_ref) return { found: true, changed: false, payment_status: order.payment_status, status: order.status };
  const m = await getPaymentOrder(order.payment_ref);
  const paidIntent = m.paymentIntents?.find((i) => i.status === "PAID");
  const r = await applyPaymentStatus(order.id, {
    ref: m.uuid ?? order.payment_ref,
    status: m.paymentStatus,
    amount: m.grandTotal == null ? null : Number(m.grandTotal),
    currency: m.currency ?? null,
    meta: { payment_method_type: paidIntent?.paymentMethodType ?? m.paymentMethodType },
  });
  return { ...r, providerStatus: m.paymentStatus };
}

/** "Pay by bank transfer instead" → proforma issued; the order confirmation (with proforma PDF) is e-mailed. */
export async function switchToBankTransfer(orderId: string) {
  const db = createServiceClient();
  const { data, error } = await db.rpc("payment_switch_to_transfer", { p_order: orderId });
  if (error) throw error;
  const r = data as { id: string; number: string; total_gross: number | string; invoice_number: string | null };
  deferEmail("order placed (switched to bank transfer)", () => notifyOrderSwitchedToTransfer(db, r.id, r.invoice_number));
  return r;
}
