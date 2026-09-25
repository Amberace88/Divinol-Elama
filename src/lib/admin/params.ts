/** Helpers for reading list filters from `searchParams` (server-side pagination/sorting). */
export type SP = Record<string, string | string[] | undefined>;

export function sp(params: SP, key: string): string {
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function spInt(params: SP, key: string, fallback: number, min = 1, max = 100000) {
  const n = parseInt(sp(params, key), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function spEnum<T extends string>(params: SP, key: string, allowed: readonly T[], fallback: T): T;
export function spEnum<T extends string>(params: SP, key: string, allowed: readonly T[], fallback: null): T | null;
export function spEnum<T extends string>(params: SP, key: string, allowed: readonly T[], fallback: T | null) {
  const v = sp(params, key) as T;
  return allowed.includes(v) ? v : fallback;
}

export function spDate(params: SP, key: string): string | null {
  const v = sp(params, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/** Builds a query string from the current params with overrides (null/"" removes a key). */
export function withParams(params: SP, overrides: Record<string, string | number | null | undefined>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) usp.set(k, val);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null || v === undefined || v === "") usp.delete(k);
    else usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export const PAGE_SIZE = 25;
