/**
 * Product promotions & badges (client-safe, no server imports).
 *  - Promotion: sale / clearance / special offer with a % discount and an optional start / end date.
 *    The same rule runs in SQL (`promo_active_percent`, used by place_order), so the price the visitor sees is
 *    the price that gets charged. B2B customers get the better of their own discount and the promotion — never both.
 *  - Badges: marketing labels the shop chooses per product (new, bestseller …).
 */

export const PROMO_TYPES = ["sale", "clearance", "special"] as const;
export type PromoType = (typeof PROMO_TYPES)[number];

export const BADGE_KEYS = ["new", "bestseller", "recommended", "limited", "seasonal", "bio", "pro"] as const;
export type BadgeKey = (typeof BADGE_KEYS)[number];

export type ProductPromo = {
  type: PromoType;
  percent: number | null;
  starts_at: string | null;
  ends_at: string | null;
};

/** Promotion currently running (or null). */
export type ActivePromo = { type: PromoType; percent: number; ends_at: string | null };

export function activePromo(promo: ProductPromo | null | undefined, now = Date.now()): ActivePromo | null {
  if (!promo || !PROMO_TYPES.includes(promo.type)) return null;
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) return null;
  if (promo.ends_at && new Date(promo.ends_at).getTime() <= now) return null;
  const percent = Number(promo.percent) || 0;
  if (promo.type !== "special" && percent <= 0) return null;
  return { type: promo.type, percent: Math.max(0, Math.min(90, percent)), ends_at: promo.ends_at };
}

/** Status of a promotion for the admin ("scheduled", "active", "ended"). */
export function promoStatus(promo: ProductPromo | null | undefined, now = Date.now()): "none" | "scheduled" | "active" | "ended" {
  if (!promo || !PROMO_TYPES.includes(promo.type)) return "none";
  if (promo.ends_at && new Date(promo.ends_at).getTime() <= now) return "ended";
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) return "scheduled";
  return activePromo(promo, now) ? "active" : "none";
}

/** Whole days left until the promotion ends (null = no end date). */
export function daysLeft(endsAt: string | null | undefined, now = Date.now()) {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

/** Admin labels (the storefront uses translations). */
export const PROMO_LABEL_LV: Record<PromoType, string> = { sale: "Akcija", clearance: "Izpārdošana", special: "Īpašais piedāvājums" };
export const BADGE_LABEL_LV: Record<BadgeKey, string> = {
  new: "Jaunums",
  bestseller: "Pirktākais",
  recommended: "Iesakām",
  limited: "Ierobežots daudzums",
  seasonal: "Sezonas prece",
  bio: "Bioloģiski noārdāms",
  pro: "Profesionāļiem",
};

// ───────────────────────── admin form helpers (dates are whole days in Riga time) ─────────────────────────
const TZ = "Europe/Riga";

/** ISO timestamp → "YYYY-MM-DD" in Riga time ("" for null). */
export function rigaDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function rigaOffset(date: string) {
  const probe = new Date(`${date}T12:00:00Z`);
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" }).formatToParts(probe).find((p) => p.type === "timeZoneName")?.value ?? "GMT+2";
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return "+02:00";
  return `${m[1]}${m[2].padStart(2, "0")}:${m[3] ?? "00"}`;
}

/** "YYYY-MM-DD" → start of that day in Riga (ISO) / null. */
export function rigaDayStart(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return new Date(`${date}T00:00:00${rigaOffset(date)}`).toISOString();
}

/** "YYYY-MM-DD" → end of that day in Riga (ISO, exclusive next midnight) / null. */
export function rigaDayEnd(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return rigaDayStart(next);
}

/** Last day a promotion runs ("YYYY-MM-DD", Riga) — `ends_at` is the exclusive midnight after it. */
export function rigaEndDate(iso: string | null | undefined) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? rigaDate(new Date(t - 1).toISOString()) : "";
}

/** Today / today + n days as "YYYY-MM-DD" in Riga. */
export function rigaToday(plusDays = 0) {
  return rigaDate(new Date(Date.now() + plusDays * 86_400_000).toISOString());
}

/** Last day of the current month in Riga. */
export function rigaMonthEnd() {
  const [y, m] = rigaToday().split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}
