import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { locales } from "@/i18n/routing";
import { productSlugFromPath, splitLocale } from "@/lib/analytics";
import { createPublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Cookieless first-party analytics collector.
 * Never stores IPs or raw user agents: visitor_id = sha256(dailySalt + ip + ua + host),
 * so the same person gets a new, unlinkable id every UTC day.
 * Always answers 204 and never throws to the client.
 */

const NO_CONTENT = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

const BOT_RE =
  /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|facebot|embedly|quora link|whatsapp|telegram|discord|skype|slack|preview|headless|lighthouse|pagespeed|pingdom|uptime|monitor|statuscake|gtmetrix|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|gptbot|chatgpt|claude|perplexity|curl|wget|python|axios|node-fetch|undici|go-http|java\/|okhttp|httpclient|libwww|scrapy|phantom|selenium|puppeteer|playwright|cypress|electron/i;

const IGNORED_PATH_RE = /^\/(?:admin|api|auth|_next|_vercel|media)(?:\/|$)/;
const LOCALE_SET = new Set<string>(locales);
const SALT = process.env.ANALYTICS_SALT || "divinol-analytics-v1";

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

function parseDevice(ua: string, width: number | undefined): "mobile" | "tablet" | "desktop" {
  if (/iPad|Tablet|PlayBook|Silk|Kindle|Nexus (?:7|9|10)|SM-T\d|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Windows Phone|Opera Mini|IEMobile|BlackBerry|Android.*Mobile/i.test(ua)) return "mobile";
  // iPadOS reports a desktop Safari UA; fall back to screen width.
  if (width && width > 0) {
    if (width < 600) return "mobile";
    if (width <= 1024 && /Macintosh/.test(ua)) return "tablet";
  }
  return "desktop";
}

function parseBrowser(ua: string): string {
  if (/Edg(?:e|A|iOS)?\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/YaBrowser\//.test(ua)) return "Yandex";
  if (/Vivaldi\//.test(ua)) return "Vivaldi";
  if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
  if (/Chrome\/|CriOS\/|Chromium\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return "Safari";
  if (/Safari\//.test(ua) || /AppleWebKit/.test(ua)) return "Safari";
  return "Other";
}

function parseOs(ua: string): string {
  if (/Windows/.test(ua)) return "Windows";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Other";
}

type NfGeo = { city?: string; country?: { code?: string } };

function geo(req: NextRequest): { country?: string; city?: string } {
  const raw = req.headers.get("x-nf-geo");
  if (raw) {
    try {
      const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
      const g = JSON.parse(json) as NfGeo;
      const code = g.country?.code?.toUpperCase();
      return {
        country: code && /^[A-Z]{2}$/.test(code) ? code : undefined,
        city: str(g.city, 80),
      };
    } catch {
      /* fall through */
    }
  }
  const c = (req.headers.get("x-country") ?? req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? "").toUpperCase();
  return { country: /^[A-Z]{2}$/.test(c) && c !== "XX" ? c : undefined };
}

function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-nf-client-connection-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    ""
  );
}

const bareHost = (h: string) => h.toLowerCase().replace(/:\d+$/, "").replace(/^(?:www|m|l|lm|mobile)\./, "");

function referrerHost(ref: string | undefined, host: string): string | undefined {
  if (!ref) return undefined;
  try {
    const u = new URL(ref);
    const h = bareHost(u.hostname);
    if (!h || h === host) return undefined;
    return h.slice(0, 120);
  } catch {
    return undefined;
  }
}

function normalizePath(p: unknown): string | undefined {
  if (typeof p !== "string" || !p.startsWith("/")) return undefined;
  let path = p.split(/[?#]/)[0].slice(0, 300);
  if (path.length > 1) path = path.replace(/\/+$/, "") || "/";
  return path;
}

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured) return NO_CONTENT();
    const ua = req.headers.get("user-agent") ?? "";
    if (!ua || BOT_RE.test(ua)) return NO_CONTENT();
    if (req.headers.get("sec-fetch-site") === "cross-site") return NO_CONTENT();

    const text = await req.text();
    if (!text || text.length > 4096) return NO_CONTENT();
    const body = JSON.parse(text) as Record<string, unknown>;
    if (!body || typeof body !== "object") return NO_CONTENT();

    const type = str(body.type, 40)?.toLowerCase();
    if (!type || !/^[a-z_]+$/.test(type)) return NO_CONTENT();

    const path = normalizePath(body.path);
    if (path && IGNORED_PATH_RE.test(splitLocale(path).rest)) return NO_CONTENT();
    if (path && IGNORED_PATH_RE.test(path)) return NO_CONTENT();
    if (type === "pageview" && !path) return NO_CONTENT();

    const host = bareHost(req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "");
    const ip = clientIp(req);
    const day = new Date().toISOString().slice(0, 10);
    const visitorId = createHash("sha256").update(`${day}|${SALT}|${ip}|${ua}|${host}`).digest("hex").slice(0, 32);

    const bodyLocale = str(body.locale, 5);
    const locale = bodyLocale && LOCALE_SET.has(bodyLocale) ? bodyLocale : path ? (splitLocale(path).locale ?? undefined) : undefined;

    const width = typeof body.w === "number" && Number.isFinite(body.w) ? body.w : undefined;
    const rawProps = body.props && typeof body.props === "object" && !Array.isArray(body.props) ? (body.props as Record<string, unknown>) : null;
    const props: Record<string, string | number | boolean> = {};
    if (rawProps) {
      for (const [k, v] of Object.entries(rawProps).slice(0, 12)) {
        const key = k.slice(0, 40);
        if (typeof v === "string") props[key] = v.slice(0, 200);
        else if ((typeof v === "number" && Number.isFinite(v)) || typeof v === "boolean") props[key] = v;
      }
    }
    const productSlug =
      (typeof props.slug === "string" ? props.slug.slice(0, 160) : undefined) ??
      (type === "pageview" && path ? productSlugFromPath(path) ?? undefined : undefined);

    const sessionId = str(body.session_id, 64);
    const { country, city } = geo(req);

    const payload = {
      type,
      path,
      locale,
      referrer_host: type === "pageview" ? referrerHost(str(body.referrer, 500), host) : undefined,
      utm_source: str(body.utm_source, 100)?.toLowerCase(),
      utm_medium: str(body.utm_medium, 100)?.toLowerCase(),
      utm_campaign: str(body.utm_campaign, 150),
      country,
      city,
      device: parseDevice(ua, width),
      browser: parseBrowser(ua),
      os: parseOs(ua),
      visitor_id: visitorId,
      session_id: sessionId && /^[A-Za-z0-9_-]{6,64}$/.test(sessionId) ? sessionId : undefined,
      product_slug: productSlug,
      props: Object.keys(props).length ? props : undefined,
    };

    const supabase = createPublicClient();
    await Promise.race([
      supabase.rpc("track_event", { p: payload }),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    /* analytics must never break anything */
  }
  return NO_CONTENT();
}
