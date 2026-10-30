import "server-only";
import type { Db } from "@/lib/email/data";

/**
 * Bank details on documents. Invoices keep a snapshot of the seller (company settings at issue time), so a proforma
 * issued while the IBAN field was empty has no IBAN forever. When the IBAN is saved, `backfillInvoiceBank()` adds
 * the bank details to every still-open (issued) invoice that lacks them and marks it `bank_backfilled_at`; the admin
 * banner then offers to re-send those documents to the customers (`bank_resent_at` once done).
 */

type Seller = Record<string, unknown> & { iban?: string; bank_name?: string; swift?: string; bank_backfilled_at?: string; bank_resent_at?: string };
type InvoiceRow = { id: string; number: string; order_id: string | null; seller: Seller | null };

const blank = (v: unknown) => typeof v !== "string" || !v.trim();

export async function companyIban(db: Db) {
  const { data } = await db.from("settings").select("value").eq("key", "company").maybeSingle();
  const c = (data?.value ?? {}) as { iban?: string; bank_name?: string; swift?: string };
  return { iban: (c.iban ?? "").trim(), bank_name: (c.bank_name ?? "").trim(), swift: (c.swift ?? "").trim() };
}

async function openInvoices(db: Db) {
  const { data } = await db
    .from("invoices")
    .select("id, number, order_id, seller")
    .eq("status", "issued")
    .in("type", ["proforma", "invoice"])
    .order("issued_at", { ascending: true })
    .limit(500);
  return (data ?? []) as InvoiceRow[];
}

/** Adds the (now entered) bank details to open invoices that were issued without them. Returns how many. */
export async function backfillInvoiceBank(db: Db, bank: { iban: string; bank_name: string; swift: string }) {
  if (!bank.iban) return 0;
  const rows = (await openInvoices(db)).filter((r) => blank(r.seller?.iban));
  const at = new Date().toISOString();
  let n = 0;
  for (const r of rows) {
    const seller: Seller = { ...(r.seller ?? {}), iban: bank.iban, bank_backfilled_at: at };
    if (bank.bank_name && blank(seller.bank_name)) seller.bank_name = bank.bank_name;
    if (bank.swift && blank(seller.swift)) seller.swift = bank.swift;
    const { error } = await db.from("invoices").update({ seller }).eq("id", r.id);
    if (!error) n++;
  }
  return n;
}

export type BankResendItem = { invoiceId: string; invoiceNumber: string; orderId: string; orderNumber: string; email: string };

export type BankStatus = {
  /** company IBAN is empty → every new proforma goes out without it */
  ibanMissing: boolean;
  /** open documents issued without an IBAN (while it is missing) */
  affected: number;
  /** documents completed with the IBAN that were not yet re-sent to the customer */
  toResend: BankResendItem[];
};

export async function bankStatus(db: Db): Promise<BankStatus> {
  const [{ iban }, rows] = await Promise.all([companyIban(db), openInvoices(db)]);
  if (!iban) return { ibanMissing: true, affected: rows.filter((r) => blank(r.seller?.iban)).length, toResend: [] };

  const pending = rows.filter((r) => r.order_id && r.seller?.bank_backfilled_at && !r.seller?.bank_resent_at);
  if (!pending.length) return { ibanMissing: false, affected: 0, toResend: [] };
  const { data: orders } = await db
    .from("orders")
    .select("id, number, email, status, payment_status")
    .in("id", pending.map((r) => r.order_id as string));
  const byId = new Map(((orders ?? []) as { id: string; number: string; email: string; status: string; payment_status: string }[]).map((o) => [o.id, o]));
  const toResend = pending.flatMap((r) => {
    const o = byId.get(r.order_id as string);
    if (!o || o.status === "cancelled" || o.payment_status === "paid") return [];
    return [{ invoiceId: r.id, invoiceNumber: r.number, orderId: o.id, orderNumber: o.number, email: o.email }];
  });
  return { ibanMissing: false, affected: 0, toResend };
}

export async function markBankResent(db: Db, invoiceId: string, skipped = false) {
  const { data } = await db.from("invoices").select("seller").eq("id", invoiceId).maybeSingle();
  const seller = { ...((data?.seller ?? {}) as Seller), bank_resent_at: new Date().toISOString(), ...(skipped ? { bank_resend_skipped: true } : {}) };
  await db.from("invoices").update({ seller }).eq("id", invoiceId);
}
