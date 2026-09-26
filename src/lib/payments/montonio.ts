import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { unstable_cache } from "next/cache";
import { isServiceRoleConfigured } from "@/lib/supabase/service";

/**
 * Montonio Stargate API (payments v2) — bank links (payment initiation), cards, Apple Pay / Google Pay.
 *
 * Docs (verified 2026-09):
 *  • Overview, environments, order lifecycle ....... https://docs.montonio.com/api/stargate/overview
 *  • API reference (GET /orders/:uuid, auth) ....... https://docs.montonio.com/api/stargate/reference
 *  • Create and validate an Order .................. https://docs.montonio.com/api/stargate/guides/orders
 *  • Display payment methods ....................... https://docs.montonio.com/api/stargate/guides/payment-methods
 *  • Webhooks ...................................... https://docs.montonio.com/api/stargate/guides/webhooks
 *  • Refunds ....................................... https://docs.montonio.com/api/stargate/guides/refunds
 *  • API keys (Partner System → Stores → API Keys) .. https://docs.montonio.com/introduction
 *
 * Auth: every request is a JWT signed HS256 with the store's Secret Key and carrying `accessKey`.
 *   POST endpoints → body `{ "data": "<jwt>" }` (the JWT payload IS the request); GET endpoints →
 *   `Authorization: Bearer <jwt>` with payload `{ accessKey, iat, exp }`. Recommended expiry 10 min.
 * No SDK / JWT dependency: HS256 is implemented with node:crypto.
 */

export type MontonioEnv = "sandbox" | "production";
export type OnlineMethod = "montonio_bank" | "montonio_card";

const BASE: Record<MontonioEnv, string> = {
  production: "https://stargate.montonio.com/api",
  sandbox: "https://sandbox-stargate.montonio.com/api",
};

const env = (k: string) => process.env[k]?.trim() || "";

export function montonioEnv(): MontonioEnv {
  return env("MONTONIO_ENV").toLowerCase() === "production" ? "production" : "sandbox";
}
const accessKey = () => env("MONTONIO_ACCESS_KEY");
const secretKey = () => env("MONTONIO_SECRET_KEY");

/** Keys present + the service-role key the webhook needs to update orders without a user session. */
export function isMontonioConfigured() {
  return Boolean(accessKey() && secretKey() && isServiceRoleConfigured());
}

export class MontonioError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "MontonioError";
    this.status = status;
  }
}

// ───────────────────────── JWT (HS256) ─────────────────────────

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

export function signJwt(payload: Record<string, unknown>, secret = secretKey(), ttlSeconds = 600) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }));
  const sig = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

/**
 * Verifies an HS256 JWT signed with our Secret Key (order-token on the return URL, orderToken / refundToken in
 * webhooks) and that it belongs to our store (`accessKey`). Returns the payload or null.
 * Expiry is NOT enforced by default: webhooks are retried for up to 48 h and applying a genuine (signed) status
 * is idempotent — see payment_apply_status() in migration 0011.
 */
export function verifyToken<T = MontonioOrderToken>(token: string | null | undefined, opts: { enforceExpiry?: boolean } = {}): T | null {
  const secret = secretKey();
  if (!token || !secret || typeof token !== "string" || token.length > 8192) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  try {
    const header = JSON.parse(Buffer.from(h, "base64url").toString("utf8")) as { alg?: string };
    if (header.alg !== "HS256") return null;
    const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest();
    const given = Buffer.from(s, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as Record<string, unknown>;
    if (payload.accessKey !== accessKey()) return null;
    if (opts.enforceExpiry && typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000) - 60) return null;
    return payload as T;
  } catch {
    return null;
  }
}

/**
 * Decoded order token (return URL `?order-token=` and webhook `{ orderToken }`), per
 * https://docs.montonio.com/api/stargate/guides/orders — "Validate the Order".
 */
export type MontonioOrderToken = {
  uuid: string;
  accessKey: string;
  merchantReference: string;
  merchantReferenceDisplay?: string;
  /** PENDING | PAID | AUTHORIZED | VOIDED | PARTIALLY_REFUNDED | REFUNDED | ABANDONED (overview → order lifecycle) */
  paymentStatus: string;
  paymentMethod?: string;
  grandTotal?: number | string;
  currency?: string;
  senderIban?: string;
  senderName?: string;
  paymentProviderName?: string;
  iat?: number;
  exp?: number;
};

/** Decoded refund token (webhook `{ refundToken }`), https://docs.montonio.com/api/stargate/guides/refunds */
export type MontonioRefundToken = {
  refundUuid: string;
  refundStatus: string;
  refundAmount?: number;
  orderUuid: string;
  accessKey: string;
};

// ───────────────────────── HTTP ─────────────────────────

async function call<T>(method: "GET" | "POST", path: string, body?: Record<string, unknown>): Promise<T> {
  if (!accessKey() || !secretKey()) throw new MontonioError("Montonio is not configured");
  const url = `${BASE[montonioEnv()]}${path}`;
  const init: RequestInit =
    method === "GET"
      ? { method, headers: { Authorization: `Bearer ${signJwt({ accessKey: accessKey() })}`, Accept: "application/json" } }
      : {
          method,
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ data: signJwt({ accessKey: accessKey(), ...body }) }),
        };
  let res: Response;
  try {
    res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    throw new MontonioError(`Montonio request failed: ${(e as Error).message}`);
  }
  const text = await res.text();
  if (!res.ok) {
    // 400 bad JWT fields · 401 STORE_NOT_FOUND (wrong access key / environment) · 403 wrong secret key
    let msg = text.slice(0, 300);
    try {
      const j = JSON.parse(text) as { message?: string | string[]; error?: string };
      msg = [j.error, Array.isArray(j.message) ? j.message.join("; ") : j.message].filter(Boolean).join(": ") || msg;
    } catch {
      /* not JSON */
    }
    throw new MontonioError(`Montonio ${res.status}: ${msg}`, res.status);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new MontonioError("Montonio returned invalid JSON", res.status);
  }
}

// ───────────────────────── payment methods ─────────────────────────

export type MontonioBank = { code: string; name: string; logoUrl: string | null };
export type MontonioMethods = {
  storeName: string | null;
  /** banks per country (LV / EE / LT / FI / PL …) that support EUR, in Montonio's display order */
  banks: Record<string, MontonioBank[]>;
  card: { enabled: boolean; logoUrl: string | null };
  applePay: boolean;
  googlePay: boolean;
  /** all enabled method keys, e.g. ["paymentInitiation", "cardPayments", "applePay", …] */
  methods: string[];
};

type RawBank = { name?: string; logoUrl?: string; code?: string; uiPosition?: number; supportedCurrencies?: string[] };
type RawMethods = {
  name?: string;
  paymentMethods?: Record<string, { logoUrl?: string; setup?: Record<string, { supportedCurrencies?: string[]; paymentMethods?: RawBank[] }> } | undefined>;
};

function normalizeMethods(raw: RawMethods): MontonioMethods {
  const pm = raw.paymentMethods ?? {};
  const banks: Record<string, MontonioBank[]> = {};
  for (const [country, setup] of Object.entries(pm.paymentInitiation?.setup ?? {})) {
    banks[country.toUpperCase()] = (setup?.paymentMethods ?? [])
      .filter((b) => b.code && b.name && (!b.supportedCurrencies || b.supportedCurrencies.includes("EUR")))
      .sort((a, b) => (a.uiPosition ?? 999) - (b.uiPosition ?? 999))
      .map((b) => ({ code: String(b.code), name: String(b.name), logoUrl: typeof b.logoUrl === "string" && b.logoUrl.startsWith("https://") ? b.logoUrl : null }));
  }
  const cardLogo = pm.cardPayments?.logoUrl;
  return {
    storeName: raw.name ?? null,
    banks,
    card: { enabled: Boolean(pm.cardPayments), logoUrl: typeof cardLogo === "string" && cardLogo.startsWith("https://") ? cardLogo : null },
    applePay: Boolean(pm.applePay),
    googlePay: Boolean(pm.googlePay),
    methods: Object.keys(pm).filter((k) => pm[k]),
  };
}

const cachedMethods = unstable_cache(
  // the arguments only take part in the cache key (a new environment / access key → fresh list)
  async (...cacheKey: [MontonioEnv, string]) => {
    void cacheKey;
    return normalizeMethods(await call<RawMethods>("GET", "/stores/payment-methods"));
  },
  ["montonio-payment-methods-v1"],
  { revalidate: 3600, tags: ["montonio-methods"] },
);

/** GET /stores/payment-methods — cached for 1 h (per environment + access key). */
export async function listPaymentMethods(): Promise<MontonioMethods> {
  return cachedMethods(montonioEnv(), accessKey().slice(0, 12));
}

/** Banks of one country (delivery market). */
export async function listBanks(country: string): Promise<MontonioBank[]> {
  const m = await listPaymentMethods();
  return m.banks[country.toUpperCase()] ?? [];
}

// ───────────────────────── orders ─────────────────────────

export type PaymentOrderInput = {
  merchantReference: string;
  grandTotal: number;
  locale: string;
  country: string;
  method: OnlineMethod;
  preferredProvider?: string | null;
  returnUrl: string;
  notificationUrl: string;
  description: string;
  customer: { name: string; email: string; companyName?: string | null; street?: string | null; city?: string | null; postalCode?: string | null };
  lineItems?: { name: string; quantity: number; finalPrice: number }[];
};

export type CreatedPaymentOrder = { uuid: string; paymentUrl: string; paymentStatus?: string };

const MONTONIO_LOCALES = new Set(["de", "en", "et", "fi", "lt", "lv", "pl", "ru"]);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** POST /orders → { uuid, paymentUrl }. The customer is redirected to paymentUrl. */
export async function createPaymentOrder(input: PaymentOrderInput): Promise<CreatedPaymentOrder> {
  const total = round2(input.grandTotal);
  const locale = MONTONIO_LOCALES.has(input.locale) ? input.locale : "en";
  const [firstName, ...rest] = input.customer.name.trim().split(/\s+/);
  const address = Object.fromEntries(
    Object.entries({
      firstName: firstName || input.customer.name,
      lastName: rest.join(" ") || undefined,
      email: input.customer.email,
      companyName: input.customer.companyName || undefined,
      addressLine1: input.customer.street || undefined,
      locality: input.customer.city || undefined,
      postalCode: input.customer.postalCode || undefined,
      country: input.country,
    }).filter(([, v]) => v != null && v !== ""),
  );

  // lineItems are optional — only sent when they add up to the grand total exactly (never risk a rejected order)
  const items = input.lineItems?.map((i) => ({ name: i.name.slice(0, 200), quantity: i.quantity, finalPrice: round2(i.finalPrice) }));
  const itemsTotal = items ? round2(items.reduce((s, i) => s + i.finalPrice * i.quantity, 0)) : NaN;

  const payment =
    input.method === "montonio_card"
      ? { method: "cardPayments", amount: total, currency: "EUR" }
      : {
          method: "paymentInitiation",
          amount: total,
          currency: "EUR",
          methodOptions: {
            preferredCountry: input.country,
            preferredLocale: locale,
            paymentDescription: input.description.slice(0, 140),
            ...(input.preferredProvider ? { preferredProvider: input.preferredProvider } : {}),
          },
        };

  const res = await call<{ uuid?: string; paymentUrl?: string; paymentStatus?: string }>("POST", "/orders", {
    merchantReference: input.merchantReference,
    returnUrl: input.returnUrl,
    notificationUrl: input.notificationUrl,
    currency: "EUR",
    grandTotal: total,
    locale,
    billingAddress: address,
    shippingAddress: address,
    ...(items && items.length && itemsTotal === total ? { lineItems: items } : {}),
    payment,
  });
  if (!res.uuid || !res.paymentUrl || !/^https:\/\//.test(res.paymentUrl)) throw new MontonioError("Montonio did not return a payment URL");
  return { uuid: res.uuid, paymentUrl: res.paymentUrl, paymentStatus: res.paymentStatus };
}

export type MontonioOrderDetails = {
  uuid: string;
  paymentStatus: string;
  merchantReference?: string;
  grandTotal?: number | string;
  currency?: string;
  paymentMethodType?: string;
  paymentUrl?: string;
  paymentIntents?: { uuid: string; paymentMethodType?: string; amount?: number | string; status?: string; createdAt?: string }[];
  refunds?: { uuid: string; amount?: number | string; status?: string; createdAt?: string; type?: string }[];
};

/** GET /orders/:uuid — authoritative status (used by the return page and the admin "re-check" button). */
export async function getPaymentOrder(uuid: string): Promise<MontonioOrderDetails> {
  if (!/^[\w-]{8,64}$/.test(uuid)) throw new MontonioError("Invalid Montonio order id");
  return call<MontonioOrderDetails>("GET", `/orders/${encodeURIComponent(uuid)}`);
}

// ───────────────────────── admin status (never exposes secrets) ─────────────────────────

export async function montonioAdminStatus() {
  const status = {
    env: montonioEnv(),
    accessKey: Boolean(accessKey()),
    secretKey: Boolean(secretKey()),
    serviceRole: isServiceRoleConfigured(),
    configured: isMontonioConfigured(),
    methods: null as MontonioMethods | null,
    error: null as string | null,
  };
  if (status.accessKey && status.secretKey) {
    try {
      status.methods = await listPaymentMethods();
    } catch (e) {
      status.error = e instanceof Error ? e.message : String(e);
    }
  }
  return status;
}
