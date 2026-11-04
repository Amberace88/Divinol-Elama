import "server-only";
import batch from "@/data/zg-2026-10.json";
import { isDeveloperEmail } from "./developer";
import type { requireAdmin } from "./auth";

type Supa = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

/**
 * Work-in-progress batches are visible only to the developer until "Nodot klientam" (settings key `handover`,
 * { [batchId]: iso date }). The shop never shows them anyway (drafts); this only keeps the client's admin clean
 * until the hand-over. The last batch in the list is the newest one ("Jaunākais papildinājums").
 */
export type Batch = { id: string; label: string; date: string; arts: string[] };

export const BATCHES: Batch[] = [
  { id: "zg-2026-10", label: "Eļļas (Zeller+Gmelin)", date: "30.10.2026", arts: (batch as { art: string }[]).map((r) => r.art) },
  {
    id: "zg-2026-11",
    label: "Smērvielas",
    date: "02.11.2026",
    arts: ["28130", "08951", "21120", "23030", "32470", "21140", "85000", "85431", "85550", "28510", "85430", "85750", "85560", "96840", "96480", "85800", "23920", "24710", "24730", "27310"],
  },
  { id: "zg-2026-11b", label: "Smērvielas — papildinājums", date: "04.11.2026", arts: ["95850", "21990"] },
];
export const LATEST_BATCH = BATCHES[BATCHES.length - 1];
/** kept for the first batch's import tool */
export const BATCH_ID = BATCHES[0].id;
export const BATCH_ARTS = BATCHES[0].arts;
/** existed before a batch (only completed) — never hidden */
const NOT_HIDDEN = new Set(["52020"]);

export async function handoverState(supabase: Supa): Promise<Record<string, string>> {
  const { data } = await supabase.from("settings").select("value").eq("key", "handover").maybeSingle<{ value: Record<string, string> | null }>();
  return data?.value ?? {};
}

export async function batchHandedOver(supabase: Supa, batchId = BATCH_ID): Promise<string | null> {
  return (await handoverState(supabase))[batchId] ?? null;
}

/** Product ids the current admin must not see yet ([] for the developer or after every hand-over). */
export async function hiddenProductIds(supabase: Supa, email: string | null | undefined): Promise<string[]> {
  if (isDeveloperEmail(email)) return [];
  const state = await handoverState(supabase);
  const arts = BATCHES.filter((b) => !state[b.id]).flatMap((b) => b.arts).filter((a) => !NOT_HIDDEN.has(a));
  if (!arts.length) return [];
  const { data } = await supabase.from("products").select("id").in("base_sku", arts);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

/** PostgREST `not in` list, e.g. `(a,b,c)` — or null when nothing is hidden. */
export function notInList(ids: string[]) {
  return ids.length ? `(${ids.join(",")})` : null;
}
