import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isServiceRoleConfigured } from "@/lib/supabase/service";

/**
 * Stripe (REST API, no SDK) — hosted Stripe Checkout: cards, Apple Pay, Google Pay, Link and every other method the
 * shop switches on in the Stripe Dashboard (Settings → Payment methods). Nothing card-related ever touches our server.
 *
 * Docs:
 *  • Checkout Sessions ............ https://docs.stripe.com/api/checkout/sessions/create
 *  • Webhooks + signatures ........ https://docs.stripe.com/webhooks#verify-manually
 *  • Dynamic payment methods ...... https://docs.stripe.com/payments/payment-methods/dynamic-payment-methods
 *
 * Env (Netlify → Project configuration → Environment variables):
 *  STRIPE_SECRET_KEY        sk_live_… / sk_test_… (or a restricted key rk_… with Checkout Sessions + PaymentIntents + Charges write/read)
 *  STRIPE_WEBHOOK_SECRET    whsec_… of the endpoint https://divinol.lv/api/payments/stripe/webhook
 *  SUPABASE_SERVICE_ROLE_KEY  (already needed for every online payment — the webhook updates orders without a session)
 */

const API = "https://api.stripe.com/v1";
const env = (k: string) => process.env[k]?.trim() || "";
const secretKey = () => env("STRIPE_SECRET_KEY");
export const webhookSecret = () => env("STRIPE_WEBHOOK_SECRET");

export function isStripeConfigured() {
  return Boolean(secretKey() && isServiceRoleConfigured());
}

export function stripeMode(): "live" | "test" | null {
  const k = secretKey();
  if (!k) return null;
  return /^(sk|rk)_live_/.test(k) ? "live" : "test";
}

export class StripeError extends Error {
  status: number;
  code: string | null;
  constructor(message: string, status = 0, code: string | null = null) {
    super(message);
    this.name = "StripeError";
    this.status = status;
    this.code = code;
  }
}

// ───────────────────────── HTTP ─────────────────────────

type Params = Record<string, string | number | boolean | null | undefined>;

/** Stripe wants application/x-www-form-urlencoded with bracket notation (metadata[order_id]=…). */
function form(params: Params) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") body.append(k, String(v));
  return body;
}

async function stripe<T>(method: "GET" | "POST", path: string, params: Params = {}, opts: { idempotencyKey?: string } = {}): Promise<T> {
  const key = secretKey();
  if (!key) throw new StripeError("Stripe is not configured");
  const qs = method === "GET" ? form(params).toString() : "";
  const res = await fetch(`${API}${path}${qs ? `?${qs}` : ""}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": "2024-06-20",
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
    },
    body: method === "POST" ? form(params) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: string } };
  if (!res.ok) throw new StripeError(json.error?.message || `Stripe HTTP ${res.status}`, res.status, json.error?.code ?? null);
  return json;
}

// ───────────────────────── Checkout Sessions ─────────────────────────

const STRIPE_LOCALES = new Set(["lv", "et", "lt", "en", "ru"]);
const cents = (eur: number) => Math.round(eur * 100);

export type CheckoutLine = { name: string; amount: number };

export type CheckoutInput = {
  orderId: string;
  orderNumber: string;
  email: string;
  locale: string;
  total: number;
  lines: CheckoutLine[];
  successUrl: string;
  cancelUrl: string;
  description: string;
};

export type StripeSession = {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired" | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  amount_total: number | null;
  currency: string | null;
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
  customer_details?: { name?: string | null; email?: string | null } | null;
  payment_intent: string | StripePaymentIntent | null;
};

export type StripeCharge = {
  id: string;
  amount: number;
  amount_refunded: number;
  refunded: boolean;
  currency: string;
  payment_intent: string | null;
  billing_details?: { name?: string | null } | null;
  payment_method_details?: {
    type?: string;
    card?: { brand?: string | null; last4?: string | null; wallet?: { type?: string | null } | null } | null;
  } | null;
};

export type StripePaymentIntent = {
  id: string;
  status: string;
  amount: number;
  amount_received: number;
  currency: string;
  metadata: Record<string, string> | null;
  latest_charge: string | StripeCharge | null;
};

/**
 * Creates a hosted Checkout Session (payment methods come from the Dashboard — "dynamic payment methods").
 * Lines are sent itemised only when they add up to the order total to the cent; otherwise one line with the total,
 * so the customer is never charged a different amount than the order.
 */
export async function createCheckoutSession(input: CheckoutInput): Promise<StripeSession> {
  const total = cents(input.total);
  const lines = input.lines.filter((l) => cents(l.amount) > 0);
  const itemised = lines.length > 0 && lines.length <= 100 && lines.reduce((s, l) => s + cents(l.amount), 0) === total;
  const items: CheckoutLine[] = itemised ? lines : [{ name: input.description, amount: input.total }];

  const p: Params = {
    mode: "payment",
    customer_email: input.email,
    client_reference_id: input.orderNumber,
    locale: STRIPE_LOCALES.has(input.locale.slice(0, 2)) ? input.locale.slice(0, 2) : "auto",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    // reservation window: unpaid sessions expire after 1 h → webhook "expired" cancels the order and restores stock
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    "metadata[order_id]": input.orderId,
    "metadata[order_number]": input.orderNumber,
    "payment_intent_data[description]": input.description,
    "payment_intent_data[metadata][order_id]": input.orderId,
    "payment_intent_data[metadata][order_number]": input.orderNumber,
    "payment_intent_data[statement_descriptor_suffix]": input.orderNumber.replace(/[^A-Za-z0-9 -]/g, "").slice(0, 22) || undefined,
  };
  items.forEach((l, i) => {
    p[`line_items[${i}][quantity]`] = 1;
    p[`line_items[${i}][price_data][currency]`] = "eur";
    p[`line_items[${i}][price_data][unit_amount]`] = cents(l.amount);
    p[`line_items[${i}][price_data][product_data][name]`] = l.name.slice(0, 250);
  });

  const s = await stripe<StripeSession>("POST", "/checkout/sessions", p);
  if (!s.url) throw new StripeError("Stripe did not return a payment URL");
  return s;
}

/** Session with its PaymentIntent and charge (card brand / wallet for the label, refunds). */
export function retrieveSession(id: string) {
  return stripe<StripeSession>("GET", `/checkout/sessions/${encodeURIComponent(id)}`, {
    "expand[]": "payment_intent.latest_charge",
  });
}

export function retrievePaymentIntent(id: string) {
  return stripe<StripePaymentIntent>("GET", `/payment_intents/${encodeURIComponent(id)}`, { "expand[]": "latest_charge" });
}

export function expireSession(id: string) {
  return stripe<StripeSession>("POST", `/checkout/sessions/${encodeURIComponent(id)}/expire`);
}

// ───────────────────────── mapping to our payment states ─────────────────────────

const BRAND: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", maestro: "Maestro" };
const WALLET: Record<string, string> = { apple_pay: "Apple Pay", google_pay: "Google Pay", link: "Link" };

/** Human label of how the customer paid ("Apple Pay · Visa •••• 4242", "Mastercard •••• 1234", "Link"). */
export function chargeLabel(charge: StripeCharge | null | undefined): string | null {
  const d = charge?.payment_method_details;
  if (!d) return null;
  if (d.type === "card" && d.card) {
    const brand = BRAND[d.card.brand ?? ""] ?? (d.card.brand ? d.card.brand[0].toUpperCase() + d.card.brand.slice(1) : "Karte");
    const card = `${brand}${d.card.last4 ? ` •••• ${d.card.last4}` : ""}`;
    const wallet = WALLET[d.card.wallet?.type ?? ""];
    return wallet ? `${wallet} · ${card}` : card;
  }
  return WALLET[d.type ?? ""] ?? (d.type ? d.type.replace(/_/g, " ") : null);
}

export type MappedStatus = { status: "PAID" | "ABANDONED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "PENDING"; amount: number | null; currency: string | null };

/** Checkout Session → status for payment_apply_status (PENDING = nothing to apply yet). */
export function sessionStatus(s: StripeSession): MappedStatus {
  const amount = s.amount_total == null ? null : s.amount_total / 100;
  const currency = s.currency ?? null;
  const pi = typeof s.payment_intent === "object" ? s.payment_intent : null;
  const charge = pi && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  if (s.status === "complete" && s.payment_status === "paid") {
    if (charge && charge.amount_refunded > 0) {
      return { status: charge.amount_refunded >= charge.amount ? "REFUNDED" : "PARTIALLY_REFUNDED", amount, currency };
    }
    return { status: "PAID", amount, currency };
  }
  if (s.status === "expired") return { status: "ABANDONED", amount, currency };
  return { status: "PENDING", amount, currency };
}

export function sessionMeta(s: StripeSession): Record<string, unknown> {
  const pi = typeof s.payment_intent === "object" ? s.payment_intent : null;
  const charge = pi && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  return {
    payment_intent: pi?.id ?? (typeof s.payment_intent === "string" ? s.payment_intent : null),
    method_label: chargeLabel(charge),
    sender_name: s.customer_details?.name ?? charge?.billing_details?.name ?? null,
  };
}

// ───────────────────────── webhooks ─────────────────────────

export type StripeEvent = { id: string; type: string; livemode: boolean; data: { object: Record<string, unknown> } };

/**
 * Verifies the `Stripe-Signature` header (t=…,v1=…): HMAC-SHA256 of "<t>.<raw body>" with the endpoint secret,
 * constant-time compared, timestamp within 5 min (replay protection). Returns the parsed event or null.
 */
export function verifyWebhook(rawBody: string, header: string | null, secret = webhookSecret(), toleranceSec = 300): StripeEvent | null {
  if (!header || !secret) return null;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!Number.isFinite(t) || !sigs.length) return null;
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSec) return null;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex"));
  const ok = sigs.some((s) => {
    const b = Buffer.from(s);
    return b.length === expected.length && timingSafeEqual(b, expected);
  });
  if (!ok) return null;
  try {
    return JSON.parse(rawBody) as StripeEvent;
  } catch {
    return null;
  }
}

// ───────────────────────── admin ─────────────────────────

export type StripeAdminStatus = {
  secretKey: boolean;
  webhookSecret: boolean;
  serviceRole: boolean;
  configured: boolean;
  mode: "live" | "test" | null;
  account: { id: string; name: string | null; country: string | null; chargesEnabled: boolean; payoutsEnabled: boolean } | null;
  error: string | null;
};

/** Settings card: what is configured + the Stripe account behind the key (GET /v1/account). Never returns key values. */
export async function stripeAdminStatus(): Promise<StripeAdminStatus> {
  const base = {
    secretKey: Boolean(secretKey()),
    webhookSecret: Boolean(webhookSecret()),
    serviceRole: isServiceRoleConfigured(),
    configured: isStripeConfigured(),
    mode: stripeMode(),
    account: null,
    error: null,
  };
  if (!base.secretKey) return base;
  try {
    const a = await stripe<{
      id: string;
      country?: string;
      charges_enabled?: boolean;
      payouts_enabled?: boolean;
      business_profile?: { name?: string | null } | null;
      settings?: { dashboard?: { display_name?: string | null } } | null;
    }>("GET", "/account");
    return {
      ...base,
      account: {
        id: a.id,
        name: a.business_profile?.name || a.settings?.dashboard?.display_name || null,
        country: a.country ?? null,
        chargesEnabled: Boolean(a.charges_enabled),
        payoutsEnabled: Boolean(a.payouts_enabled),
      },
    };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }
}
