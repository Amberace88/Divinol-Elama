/**
 * First-party, cookieless analytics — client helpers + shared path helpers.
 *
 * - No cookies and no persistent identifiers: the only thing kept in the browser is a random
 *   session id in sessionStorage (dies with the tab, rolls over after 30 min of inactivity).
 * - Visitors are counted server-side with a daily-rotating salted hash (see /api/track).
 * - Opt out on a device (e.g. the shop owner): localStorage.setItem("dv_notrack", "1").
 */
import { locales, pathnames, type Locale } from "@/i18n/routing";

export const TRACK_ENDPOINT = "/api/track";

export type TrackProps = Record<string, string | number | boolean | null | undefined>;

export type TrackPayload = {
  type: string;
  path?: string;
  locale?: string;
  session_id?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  w?: number;
  props?: TrackProps;
};

// ───────────────────────── shared path helpers (server + client) ─────────────────────────

const LOCALE_SET = new Set<string>(locales);

function localized(key: keyof typeof pathnames): string[] {
  const v = pathnames[key];
  return typeof v === "string" ? [v] : Object.values(v);
}

/** First path segment of the localized product route in every locale: produkts, toode, product… */
const PRODUCT_PREFIXES = new Set(localized("/product/[slug]").map((p) => p.split("/")[1]));
const CHECKOUT_PATHS = new Set(localized("/checkout"));
const SUCCESS_PATHS = new Set(localized("/checkout/success"));

/** Splits an optional locale prefix off a pathname: "/en/product/x" → { locale: "en", rest: "/product/x" }. */
export function splitLocale(pathname: string): { locale: Locale | null; rest: string } {
  const seg = pathname.split("/")[1] ?? "";
  if (LOCALE_SET.has(seg)) {
    const rest = pathname.slice(seg.length + 1) || "/";
    return { locale: seg as Locale, rest };
  }
  return { locale: null, rest: pathname || "/" };
}

/** Product slug for a localized product page path, or null. */
export function productSlugFromPath(pathname: string): string | null {
  const parts = splitLocale(pathname).rest.split("/").filter(Boolean);
  if (parts.length !== 2 || !PRODUCT_PREFIXES.has(parts[0])) return null;
  try {
    return decodeURIComponent(parts[1]).slice(0, 160) || null;
  } catch {
    return null;
  }
}

export function isCheckoutPath(pathname: string) {
  return CHECKOUT_PATHS.has(splitLocale(pathname).rest.replace(/\/$/, ""));
}

export function isCheckoutSuccessPath(pathname: string) {
  return SUCCESS_PATHS.has(splitLocale(pathname).rest.replace(/\/$/, ""));
}

// ───────────────────────── browser-only ─────────────────────────

const SESSION_KEY = "dv_sid";
const SESSION_TTL = 30 * 60 * 1000;

function disabled(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local")) return true;
  if (navigator.webdriver) return true;
  try {
    if (localStorage.getItem("dv_notrack") === "1") return true;
  } catch {
    /* storage unavailable */
  }
  return false;
}

function randomId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Random per-tab session id with a 30-minute inactivity rollover. */
export function sessionId(): string | undefined {
  try {
    const now = Date.now();
    const raw = sessionStorage.getItem(SESSION_KEY);
    let id: string | null = null;
    if (raw) {
      const [sid, ts] = raw.split(".");
      if (sid && now - Number(ts) < SESSION_TTL) id = sid;
    }
    id ??= randomId();
    sessionStorage.setItem(SESSION_KEY, `${id}.${now}`);
    return id;
  } catch {
    return undefined;
  }
}

/** Low-level sender: sendBeacon (text/plain, no preflight) with a fetch keepalive fallback. */
export function send(payload: TrackPayload) {
  if (disabled()) return;
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(TRACK_ENDPOINT, body)) return;
    void fetch(TRACK_ENDPOINT, {
      method: "POST",
      body,
      keepalive: true,
      headers: { "Content-Type": "text/plain" },
      credentials: "omit",
    }).catch(() => {});
  } catch {
    /* never break the page */
  }
}

function pageLocale() {
  const lang = document.documentElement.lang?.slice(0, 2);
  return lang && LOCALE_SET.has(lang) ? lang : undefined;
}

/**
 * Custom event. Allowed names are enforced by the database (e.g. add_to_cart, begin_checkout,
 * purchase, catalog_download, search, contact_submit, inquiry_submit, quote_request,
 * newsletter_signup, oil_finder, calculator_use, outbound_click, phone_click, email_click).
 */
export function track(name: string, props?: TrackProps) {
  if (typeof window === "undefined") return;
  send({
    type: name,
    path: window.location.pathname,
    locale: pageLocale(),
    session_id: sessionId(),
    w: window.screen?.width,
    props,
  });
}

/** Page view for the current location. `referrer` should only be passed on the first view of a page load. */
export function trackPageview(referrer?: string) {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  const utm = (k: string) => q.get(k)?.slice(0, 150) || undefined;
  const gclid = q.has("gclid");
  send({
    type: "pageview",
    path: window.location.pathname,
    locale: pageLocale(),
    session_id: sessionId(),
    referrer: referrer || undefined,
    utm_source: utm("utm_source") ?? (gclid ? "google" : undefined),
    utm_medium: utm("utm_medium") ?? (gclid ? "cpc" : undefined),
    utm_campaign: utm("utm_campaign"),
    w: window.screen?.width,
  });
}
