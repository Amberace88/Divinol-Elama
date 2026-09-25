"use client";

import { locales } from "@/i18n/routing";
import { safeNextPath } from "../format";

/** Locale prefix of the current URL ("" for the domain's default locale, e.g. "/en" otherwise). */
export function currentLocalePrefix(locale: string) {
  if (typeof window === "undefined") return "";
  const p = window.location.pathname;
  return p === `/${locale}` || p.startsWith(`/${locale}/`) ? `/${locale}` : "";
}

/**
 * Turns a (sanitized) `next` value into a concrete path for the current locale.
 * Paths that already carry a locale or belong to non-localized areas are kept as they are.
 */
export function resolveNext(raw: string | null | undefined, locale: string, fallback = "/account") {
  const safe = safeNextPath(raw, fallback);
  const first = safe.split(/[/?#]/)[1] ?? "";
  if ((locales as readonly string[]).includes(first) || first === "admin" || first === "api" || first === "auth") return safe;
  return `${currentLocalePrefix(locale)}${safe}`;
}

/** URL Supabase e-mails link back to; the callback route exchanges the code and redirects to `next`. */
export function callbackUrl(next: string) {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

type AuthErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

/** Maps Supabase auth errors to message keys in the `auth.errors` namespace. */
export function authErrorKey(error: AuthErrorLike): string {
  const code = error?.code ?? "";
  const msg = (error?.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login")) return "invalidCredentials";
  if (code === "email_not_confirmed" || msg.includes("not confirmed")) return "emailNotConfirmed";
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered")) return "userExists";
  if (code === "weak_password" || msg.includes("password should")) return "weakPassword";
  if (code === "same_password" || msg.includes("different from the old")) return "samePassword";
  if (code === "otp_disabled" || code === "user_not_found" || msg.includes("signups not allowed")) return "userNotFound";
  if (code.startsWith("over_") || error?.status === 429 || msg.includes("rate limit")) return "rateLimit";
  if (code === "email_address_invalid" || msg.includes("invalid email")) return "invalidEmail";
  return "generic";
}

export type Strength = 0 | 1 | 2 | 3 | 4;

export function passwordStrength(pw: string): Strength {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  if (pw.length < 8) return 1;
  return Math.max(1, Math.min(4, s)) as Strength;
}

export const MIN_PASSWORD = 8;
