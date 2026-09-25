import "server-only";
import { createTranslator, hasLocale } from "next-intl";
import { loadServerMessages } from "@/i18n/request";
import { routing, type Locale } from "@/i18n/routing";
import { absoluteUrl, siteUrl } from "@/lib/seo";
import { DEFAULT_SETTINGS, getStoreSettings } from "@/lib/settings";
import type { EmailCompany, EmailContext, Translate } from "./templates/layout";

export function emailLocale(v: string | null | undefined): Locale {
  return v && hasLocale(routing.locales, v) ? v : routing.defaultLocale;
}

const cache = new Map<Locale, Translate>();

/** Translator for the `emails` namespace (messages in src/messages/<locale>/emails.json, lv fallback). */
export async function emailTranslator(locale: Locale): Promise<Translate> {
  const hit = cache.get(locale);
  if (hit) return hit;
  const [own, fallback] = await Promise.all([
    loadServerMessages(locale, "emails"),
    locale === "lv" ? Promise.resolve(null) : loadServerMessages("lv", "emails"),
  ]);
  const make = (messages: Record<string, unknown>, l: string) =>
    createTranslator({
      locale: l,
      messages,
      namespace: "emails",
      timeZone: "Europe/Riga",
      onError: () => {},
      getMessageFallback: () => "\u0000",
    }) as unknown as (key: string, values?: Record<string, string | number>) => string;
  const primary = make(own, locale);
  const secondary = fallback ? make(fallback, "lv") : null;
  const t: Translate = (key, values) => {
    const s = primary(key, values);
    if (s !== "\u0000") return s;
    const f = secondary?.(key, values);
    if (f && f !== "\u0000") return f;
    console.warn(`[email] missing message emails.${key} (${locale})`);
    return key;
  };
  cache.set(locale, t);
  return t;
}

export async function emailCompany(): Promise<EmailCompany> {
  try {
    const s = await getStoreSettings();
    return { ...DEFAULT_SETTINGS.company, ...s.company };
  } catch {
    return DEFAULT_SETTINGS.company;
  }
}

export function logoUrl() {
  return `${siteUrl("lv").replace(/\/$/, "")}/media/brand/elama-logo.png`;
}

export async function emailContext(localeInput: string | null | undefined): Promise<EmailContext> {
  const locale = emailLocale(localeInput);
  const [t, company] = await Promise.all([emailTranslator(locale), emailCompany()]);
  return { locale, t, company, siteUrl: siteUrl(locale).replace(/\/$/, ""), logoUrl: logoUrl() };
}

type Href = Parameters<typeof absoluteUrl>[0];

/** Absolute, localized URL (never throws). */
export function urlFor(href: Href, locale: Locale) {
  try {
    return absoluteUrl(href, locale);
  } catch {
    return siteUrl(locale);
  }
}

export function adminUrl(path: string) {
  return `${siteUrl("lv").replace(/\/$/, "")}/admin${path}`;
}
