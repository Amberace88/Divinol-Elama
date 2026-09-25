import "server-only";
import { ZodError } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { CATALOG_TAG } from "@/lib/catalog";
import { SETTINGS_TAG } from "@/lib/settings";
import { AdminAuthError, requireAdmin } from "./auth";

export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

type AdminCtx = Awaited<ReturnType<typeof requireAdmin>>;

export class ActionError extends Error {
  fieldErrors?: Record<string, string>;
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ActionError";
    this.fieldErrors = fieldErrors;
  }
}

type PgLikeError = { code?: string; message?: string; details?: string };

/** Human readable Latvian message for Supabase / Postgres errors. */
export function errorMessage(e: unknown): string {
  if (e instanceof AdminAuthError || e instanceof ActionError) return e.message;
  if (e instanceof ZodError) return e.issues[0]?.message ?? "Nederīgi dati";
  const err = (e ?? {}) as PgLikeError;
  const msg = err.message ?? "";
  if (err.code === "23505") {
    if (/sku/i.test(msg + (err.details ?? ""))) return "Šāds SKU jau eksistē citam variantam.";
    if (/slug/i.test(msg + (err.details ?? ""))) return "Šāds slug jau eksistē.";
    return "Šāda vērtība jau eksistē (unikāls lauks).";
  }
  if (err.code === "23503") return "Ierakstu nevar dzēst vai mainīt, jo uz to atsaucas citi dati.";
  if (err.code === "23514") return "Vērtība neatbilst atļautajam diapazonam.";
  if (err.code === "42501" || /forbidden|permission denied|row-level security/i.test(msg)) return "Nav tiesību veikt šo darbību.";
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(msg)) return "Neizdevās sazināties ar datubāzi. Mēģiniet vēlreiz.";
  return msg || "Radās neparedzēta kļūda.";
}

/** Wraps a Server Action body: re-checks admin role and converts thrown errors into an ActionResult. */
export async function adminAction<T>(
  fn: (ctx: AdminCtx) => Promise<T>,
  message?: string | ((data: T) => string),
): Promise<ActionResult<T>> {
  try {
    const ctx = await requireAdmin();
    const data = await fn(ctx);
    return { ok: true, data, message: typeof message === "function" ? message(data) : message };
  } catch (e) {
    unstable_rethrow(e); // let Next.js redirect()/notFound() control-flow errors through
    if (e instanceof ActionError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
    console.error("[admin action]", e);
    return { ok: false, error: errorMessage(e) };
  }
}

/** Throws the Supabase error (if any) and returns data. */
export function must<T>(res: { data: T; error: PgLikeError | null }): T {
  if (res.error) throw res.error;
  return res.data;
}

export function revalidateCatalog() {
  revalidateTag(CATALOG_TAG, { expire: 0 });
  revalidatePath("/", "layout");
}

export function revalidateSettings() {
  revalidateTag(SETTINGS_TAG, { expire: 0 });
  revalidatePath("/", "layout");
}

export function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

/** Characters that would break a PostgREST `or=(...)` filter. */
export function sanitizeSearch(q: string | null | undefined, max = 80) {
  return (q ?? "").replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
