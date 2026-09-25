/** Client/server-safe helpers for the customer portal. */

const INTL_LOCALES: Record<string, string> = { lv: "lv-LV", et: "et-EE", lt: "lt-LT", en: "en-IE", ru: "ru-RU" };

export function intlLocale(locale: string) {
  return INTL_LOCALES[locale] ?? "lv-LV";
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Formats a timestamp (Riga time) or a plain `YYYY-MM-DD` date (no TZ shift). */
export function formatDate(value: string | null | undefined, locale: string, opts: { time?: boolean; month?: "short" | "long" } = {}) {
  if (!value) return "—";
  const dateOnly = DATE_ONLY.test(value);
  const d = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: opts.month ?? "short",
    year: "numeric",
    ...(opts.time && !dateOnly ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: dateOnly ? "UTC" : "Europe/Riga",
  }).format(d);
}

/** Today's date in Riga as `YYYY-MM-DD` (for due-date comparisons). */
export function todayRiga() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Riga", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

export const ORDER_STATUSES = ["new", "confirmed", "processing", "shipped", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(s: unknown): s is OrderStatus {
  return typeof s === "string" && (ORDER_STATUSES as readonly string[]).includes(s);
}

export type InvoiceState = "paid" | "unpaid" | "overdue" | "void";

export function invoiceState(inv: { status: string; due_at: string | null; type: string }, today = todayRiga()): InvoiceState {
  if (inv.status === "void") return "void";
  if (inv.status === "paid") return "paid";
  if (inv.type !== "credit_note" && inv.due_at && inv.due_at < today) return "overdue";
  return "unpaid";
}

export function num(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Only same-origin relative paths are allowed as post-auth redirect targets
 * (blocks `//evil.com`, `/\evil.com`, absolute URLs and control characters).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/account"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(next)) return fallback;
  try {
    const base = "http://localhost";
    const u = new URL(next, base);
    if (u.origin !== base) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
