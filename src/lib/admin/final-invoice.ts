import "server-only";
import type { requireAdmin } from "./auth";

type Db = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

/**
 * Numbers of the order's final invoices (ELA-, not void). The final invoice after a paid proforma is issued
 * by the `orders_payment_paid` trigger (ensure_final_invoice(), migration 0010) — callers take a snapshot
 * before the payment update and diff afterwards to find (and e-mail) what the trigger issued.
 */
export async function finalInvoiceNumbers(supabase: Db, orderId: string): Promise<Set<string>> {
  const { data } = await supabase.from("invoices").select("number").eq("order_id", orderId).eq("type", "invoice").neq("status", "void");
  return new Set(((data ?? []) as { number: string }[]).map((r) => r.number));
}

export async function newFinalInvoices(supabase: Db, orderId: string, before: Set<string>): Promise<string[]> {
  const after = await finalInvoiceNumbers(supabase, orderId);
  return [...after].filter((n) => !before.has(n));
}
