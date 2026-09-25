/** Website traffic (first-party analytics) — types, loader and Latvian labels for the admin panel. */
import { localeNames, type Locale } from "@/i18n/routing";
import type { createClient } from "@/lib/supabase/server";
import { num } from "./format";

export const TRAFFIC_PERIODS = [
  { days: 7, label: "7 d." },
  { days: 30, label: "30 d." },
  { days: 90, label: "90 d." },
  { days: 365, label: "12 mēn." },
] as const;

export type TrafficTotals = {
  visitors: number;
  pageviews: number;
  sessions: number;
  bounces: number;
  avg_duration: number;
  orders: number;
  revenue: number;
};

type Named = { name: string | null; visitors: number };

export type Traffic = {
  from: string;
  to: string;
  totals: TrafficTotals;
  previous: TrafficTotals;
  series: { day: string; visitors: number; pageviews: number; sessions: number }[];
  pages: { path: string; pageviews: number; visitors: number; entries: number }[];
  products: { slug: string; views: number; visitors: number; add_to_cart: number }[];
  sources: { source: string | null; sessions: number; visitors: number }[];
  campaigns: { source: string | null; medium: string | null; campaign: string | null; sessions: number; visitors: number }[];
  countries: { country: string | null; visitors: number; pageviews: number }[];
  cities: { city: string; country: string | null; visitors: number }[];
  devices: Named[];
  browsers: Named[];
  os: Named[];
  locales: (Named & { pageviews: number })[];
  events: { name: string; count: number; visitors: number }[];
  funnel: { sessions: number; product_views: number; add_to_cart: number; begin_checkout: number; purchase: number; orders: number };
  realtime: { visitors: number; pages: { path: string; visitors: number }[] };
};

/**
 * Same window as admin_stats(): today (UTC) minus (days − 1) until the end of today.
 * admin_traffic() compares with the previous window of equal length.
 */
export function trafficBounds(days: number) {
  const dayMs = 86_400_000;
  const from = new Date(Date.now() - (days - 1) * dayMs);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + days * dayMs);
  return { from, to };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function loadTraffic(supabase: Supabase, days: number) {
  const { from, to } = trafficBounds(days);
  const { data, error } = await supabase.rpc("admin_traffic", { p_from: from.toISOString(), p_to: to.toISOString() });
  return { traffic: (data ?? null) as Traffic | null, error };
}

// ───────────────────────── derived metrics ─────────────────────────

export function ratios(t: TrafficTotals | null | undefined) {
  const sessions = num(t?.sessions);
  return {
    visitors: num(t?.visitors),
    pageviews: num(t?.pageviews),
    sessions,
    pagesPerSession: sessions ? num(t?.pageviews) / sessions : 0,
    avgDuration: num(t?.avg_duration),
    bounceRate: sessions ? (num(t?.bounces) / sessions) * 100 : 0,
    conversion: sessions ? (num(t?.orders) / sessions) * 100 : 0,
    orders: num(t?.orders),
  };
}

/** "1 min 23 s" / "45 s" */
export function fmtDuration(seconds: unknown) {
  const s = Math.max(0, Math.round(num(seconds)));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60} s`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

// ───────────────────────── labels ─────────────────────────

let regionNames: Intl.DisplayNames | null = null;
export function countryName(code: string | null | undefined) {
  if (!code) return "Nezināma valsts";
  try {
    regionNames ??= new Intl.DisplayNames(["lv"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export const DEVICE_LABEL: Record<string, string> = { mobile: "Mobilais tālrunis", tablet: "Planšete", desktop: "Dators" };

export function localeLabel(l: string | null | undefined) {
  if (!l) return "Nezināma";
  return localeNames[l as Locale] ?? l;
}

export const EVENT_LABEL: Record<string, string> = {
  add_to_cart: "Pievienots grozam",
  begin_checkout: "Sākta noformēšana",
  purchase: "Pasūtījums noformēts",
  catalog_download: "Kataloga lejupielāde (PDF)",
  search: "Meklēšana",
  contact_submit: "Kontaktforma nosūtīta",
  inquiry_submit: "Pieprasījums nosūtīts",
  quote_request: "Cenu piedāvājuma pieprasījums",
  newsletter_signup: "Pieteikšanās jaunumiem",
  oil_finder: "Eļļas izvēles rīks",
  calculator_use: "Kalkulators",
  outbound_click: "Klikšķis uz ārēju saiti",
  phone_click: "Klikšķis uz tālruņa",
  email_click: "Klikšķis uz e-pasta",
};

const SOURCE_NAMES: [RegExp, string][] = [
  [/(^|\.)google\.[a-z.]+$/, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)yandex\.[a-z.]+$/, "Yandex"],
  [/(^|\.)facebook\.com$|^fb\.me$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "LinkedIn"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "YouTube"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/^t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/, "X (Twitter)"],
  [/chatgpt\.com$|openai\.com$/, "ChatGPT"],
  [/perplexity\.ai$/, "Perplexity"],
  [/(^|\.)ss\.(lv|com)$/, "SS.lv"],
  [/(^|\.)delfi\.(lv|ee|lt)$/, "Delfi"],
  [/com\.google\.android\.gm$|mail\.google\.com$/, "Gmail"],
];

export function sourceName(host: string | null | undefined) {
  if (!host) return null;
  for (const [re, name] of SOURCE_NAMES) if (re.test(host)) return name;
  return null;
}

export const OTHER = (v: string | null | undefined) => (!v || v === "Other" ? "Cits / nezināms" : v);
