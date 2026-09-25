"use server";

import { z } from "zod";
import { ORDER_STATUS, ORDER_STATUSES, PAYMENT_STATUS, PAYMENT_STATUSES } from "../labels";
import { ActionError, adminAction, must, revalidateAdmin, UUID_RE } from "../server";
import { deferEmail } from "@/lib/email/send";
import { notifyInvoiceIssued, notifyOrderCancelled, notifyOrderShipped } from "@/lib/email/notify";

const id = z.string().regex(UUID_RE, "Nederīgs ID");

export async function updateOrderStatus(orderId: string, status: string) {
  return adminAction(async ({ supabase, user }) => {
    id.parse(orderId);
    if (!ORDER_STATUSES.includes(status)) throw new ActionError("Nederīgs statuss");
    const before = must(await supabase.from("orders").select("status").eq("id", orderId).maybeSingle<{ status: string }>());
    if (!before) throw new ActionError("Pasūtījums nav atrasts");
    if (before.status === status) return null;
    must(await supabase.from("orders").update({ status }).eq("id", orderId));
    must(
      await supabase.from("order_events").insert({
        order_id: orderId,
        type: "status",
        message: `${ORDER_STATUS[before.status]?.label ?? before.status} → ${ORDER_STATUS[status].label}`,
        created_by: user.id,
      }),
    );
    // customer e-mails only on the transition into shipped / cancelled
    if (status === "shipped" && ["new", "confirmed", "processing"].includes(before.status)) deferEmail("order shipped", () => notifyOrderShipped(supabase, orderId));
    if (status === "cancelled") deferEmail("order cancelled", () => notifyOrderCancelled(supabase, orderId));
    revalidateAdmin();
    return null;
  }, `Statuss nomainīts: ${ORDER_STATUS[status]?.label ?? status}`);
}

export async function setOrderPayment(orderId: string, paymentStatus: string) {
  return adminAction(async ({ supabase, user }) => {
    id.parse(orderId);
    if (!PAYMENT_STATUSES.includes(paymentStatus)) throw new ActionError("Nederīgs apmaksas statuss");
    const patch: Record<string, unknown> = { payment_status: paymentStatus };
    if (paymentStatus === "paid") patch.paid_at = new Date().toISOString();
    if (paymentStatus === "unpaid") patch.paid_at = null;
    must(await supabase.from("orders").update(patch).eq("id", orderId));
    must(
      await supabase.from("order_events").insert({
        order_id: orderId,
        type: "payment",
        message: `Apmaksas statuss: ${PAYMENT_STATUS[paymentStatus].label}`,
        created_by: user.id,
      }),
    );
    revalidateAdmin();
    return null;
  }, paymentStatus === "paid" ? "Atzīmēts kā apmaksāts" : "Apmaksas statuss atjaunināts");
}

export async function updateTracking(orderId: string, code: string) {
  return adminAction(async ({ supabase, user }) => {
    id.parse(orderId);
    const value = code.trim().slice(0, 120) || null;
    must(await supabase.from("orders").update({ tracking_code: value }).eq("id", orderId));
    must(
      await supabase.from("order_events").insert({
        order_id: orderId,
        type: "tracking",
        message: value ? `Sūtījuma kods: ${value}` : "Sūtījuma kods noņemts",
        created_by: user.id,
      }),
    );
    revalidateAdmin();
    return null;
  }, "Sūtījuma kods saglabāts");
}

export async function updateOrderNotes(orderId: string, notes: string) {
  return adminAction(async ({ supabase }) => {
    id.parse(orderId);
    must(await supabase.from("orders").update({ admin_notes: notes.trim().slice(0, 5000) || null }).eq("id", orderId));
    revalidateAdmin();
    return null;
  }, "Piezīmes saglabātas");
}

export async function addOrderComment(orderId: string, message: string) {
  return adminAction(async ({ supabase, user }) => {
    id.parse(orderId);
    const text = message.trim().slice(0, 1000);
    if (!text) throw new ActionError("Ievadiet komentāru");
    must(await supabase.from("order_events").insert({ order_id: orderId, type: "note", message: text, created_by: user.id }));
    revalidateAdmin();
    return null;
  }, "Komentārs pievienots");
}

const INVOICE_LABEL: Record<string, string> = { invoice: "Rēķins", proforma: "Avansa rēķins", credit_note: "Kredītrēķins" };

export async function createInvoice(orderId: string, type: "invoice" | "proforma" | "credit_note", dueDays: number) {
  return adminAction(async ({ supabase }) => {
    id.parse(orderId);
    if (!INVOICE_LABEL[type]) throw new ActionError("Nederīgs rēķina veids");
    const days = Math.max(0, Math.min(120, Math.round(Number(dueDays) || 0)));
    const number = must(await supabase.rpc("admin_create_invoice", { p_order: orderId, p_type: type, p_due_days: days })) as string;
    deferEmail("invoice issued", () => notifyInvoiceIssued(supabase, number));
    revalidateAdmin();
    return { number };
  }, (d) => `${INVOICE_LABEL[type] ?? "Rēķins"} ${d.number} izrakstīts`);
}
