"use server";

import { z } from "zod";
import { ActionError, adminAction, must, revalidateAdmin, UUID_RE } from "../server";
import { finalInvoiceNumbers, newFinalInvoices } from "../final-invoice";
import { deferEmail } from "@/lib/email/send";
import { notifyInvoiceIssued } from "@/lib/email/notify";

const id = z.string().regex(UUID_RE, "Nederīgs ID");

type Inv = { id: string; number: string; type: string; status: string; order_id: string | null };

async function load(supabase: Parameters<Parameters<typeof adminAction>[0]>[0]["supabase"], invoiceId: string) {
  const inv = must(await supabase.from("invoices").select("id, number, type, status, order_id").eq("id", invoiceId).maybeSingle<Inv>());
  if (!inv) throw new ActionError("Rēķins nav atrasts");
  return inv;
}

export async function markInvoicePaid(invoiceId: string, alsoOrder = true) {
  return adminAction(async ({ supabase, user }) => {
    id.parse(invoiceId);
    const inv = await load(supabase, invoiceId);
    if (inv.status === "void") throw new ActionError("Anulētu rēķinu nevar atzīmēt kā apmaksātu");
    const now = new Date().toISOString();
    must(await supabase.from("invoices").update({ status: "paid", paid_at: now }).eq("id", invoiceId));
    let issued: string[] = [];
    if (alsoOrder && inv.order_id && inv.type !== "credit_note") {
      const before = await finalInvoiceNumbers(supabase, inv.order_id);
      // → trigger orders_payment_paid issues the final invoice (ELA-) after a paid proforma (idempotent)
      must(await supabase.from("orders").update({ payment_status: "paid", paid_at: now }).eq("id", inv.order_id).eq("payment_status", "unpaid"));
      must(
        await supabase
          .from("order_events")
          .insert({ order_id: inv.order_id, type: "payment", message: `Apmaksāts rēķins ${inv.number}`, created_by: user.id }),
      );
      issued = await newFinalInvoices(supabase, inv.order_id, before);
      for (const number of issued) deferEmail("invoice issued", () => notifyInvoiceIssued(supabase, number));
    }
    revalidateAdmin();
    return { issued };
  }, (d) => `Rēķins atzīmēts kā apmaksāts${d.issued.length ? ` · izrakstīts rēķins ${d.issued.join(", ")}` : ""}`);
}

export async function markInvoiceUnpaid(invoiceId: string) {
  return adminAction(async ({ supabase }) => {
    id.parse(invoiceId);
    await load(supabase, invoiceId);
    must(await supabase.from("invoices").update({ status: "issued", paid_at: null }).eq("id", invoiceId));
    revalidateAdmin();
    return null;
  }, "Rēķins atzīmēts kā neapmaksāts");
}

export async function voidInvoice(invoiceId: string) {
  return adminAction(async ({ supabase, user }) => {
    id.parse(invoiceId);
    const inv = await load(supabase, invoiceId);
    must(await supabase.from("invoices").update({ status: "void" }).eq("id", invoiceId));
    if (inv.order_id) {
      must(
        await supabase.from("order_events").insert({ order_id: inv.order_id, type: "invoice", message: `Anulēts ${inv.number}`, created_by: user.id }),
      );
    }
    revalidateAdmin();
    return null;
  }, "Rēķins anulēts");
}
