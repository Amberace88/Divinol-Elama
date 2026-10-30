import "server-only";
import batch from "@/data/zg-2026-10.json";
import { isDeveloperEmail } from "./developer";
import type { requireAdmin } from "./auth";

type Supa = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

/**
 * Work-in-progress batches are visible only to the developer until "Nodot klientam" (settings key `handover`).
 * The shop never shows them anyway (drafts); this only keeps the client's admin clean until the hand-over.
 */
export const BATCH_ID = "zg-2026-10";
export const BATCH_ARTS = (batch as { art: string }[]).map((r) => r.art);
/** 52020 existed before the batch (only completed) — never hidden */
const NOT_HIDDEN = new Set(["52020"]);

export async function batchHandedOver(supabase: Supa): Promise<string | null> {
  const { data } = await supabase.from("settings").select("value").eq("key", "handover").maybeSingle<{ value: Record<string, string> | null }>();
  return data?.value?.[BATCH_ID] ?? null;
}

/** Product ids the current admin must not see yet ([] for the developer or after the hand-over). */
export async function hiddenProductIds(supabase: Supa, email: string | null | undefined): Promise<string[]> {
  if (isDeveloperEmail(email)) return [];
  if (await batchHandedOver(supabase)) return [];
  const arts = BATCH_ARTS.filter((a) => !NOT_HIDDEN.has(a));
  const { data } = await supabase.from("products").select("id").in("base_sku", arts);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

/** PostgREST `not in` list, e.g. `(a,b,c)` — or null when nothing is hidden. */
export function notInList(ids: string[]) {
  return ids.length ? `(${ids.join(",")})` : null;
}
