"use server";

import { adminAction, revalidateAdmin } from "../server";
import { bankStatus, markBankResent } from "../bank-details";
import { notifyManualOrder } from "@/lib/email/notify";

/** Re-sends the order confirmation with the (now IBAN-completed) proforma to every customer who got it without. */
export async function resendBankDetails() {
  return adminAction(async ({ supabase, user }) => {
    const { toResend } = await bankStatus(supabase);
    let sent = 0;
    const failed: string[] = [];
    for (const it of toResend) {
      const ok = await notifyManualOrder(supabase, it.orderId, it.invoiceNumber, `payment-details/${it.invoiceId}`).catch(() => false);
      if (ok) {
        sent++;
        await markBankResent(supabase, it.invoiceId);
        await supabase.from("order_events").insert({ order_id: it.orderId, type: "note", message: `Apmaksas rekvizīti (IBAN) nosūtīti atkārtoti ar ${it.invoiceNumber}`, created_by: user.id });
      } else failed.push(it.orderNumber);
    }
    revalidateAdmin();
    return { sent, failed };
  }, (r) => (r.failed.length ? `Nosūtīti ${r.sent}; neizdevās: ${r.failed.join(", ")}` : `Apmaksas rekvizīti nosūtīti ${r.sent} klientiem`));
}

/** Hide the re-send offer without e-mailing (e.g. the customers were contacted by phone). */
export async function dismissBankResend() {
  return adminAction(async ({ supabase }) => {
    const { toResend } = await bankStatus(supabase);
    for (const it of toResend) await markBankResent(supabase, it.invoiceId, true);
    revalidateAdmin();
    return null;
  }, "Paslēpts");
}
