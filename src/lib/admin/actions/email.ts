"use server";

import { emailContext, urlFor } from "@/lib/email/context";
import { isEmail, isEmailEnabled, sendEmail } from "@/lib/email/send";
import { renderOrderConfirmation } from "@/lib/email/templates/order-confirmation";
import { sampleOrder } from "@/lib/email/templates/samples";
import { ActionError, adminAction } from "../server";

/** Iestatījumi → E-pasti: sends a sample order confirmation to the signed-in admin. */
export async function sendTestEmail() {
  return adminAction(async ({ profile, user }) => {
    if (!isEmailEnabled()) throw new ActionError("RESEND_API_KEY nav iestatīts — e-pasti netiek sūtīti.");
    const to = profile.email || user.email;
    if (!isEmail(to)) throw new ActionError("Jūsu profilā nav derīgas e-pasta adreses.");
    const ctx = await emailContext("lv");
    const order = sampleOrder({ email: to, customer: { name: profile.full_name || "Tests", customer_type: "private", b2b: false } });
    const mail = renderOrderConfirmation(ctx, { order, invoiceNumber: "PR-2026-00042", invoiceAttached: false, accountUrl: urlFor("/account/orders", "lv"), registerUrl: null });
    const res = await sendEmail({ to, ...mail, subject: `[TESTS] ${mail.subject}`, tags: { type: "test" } });
    if (!res.ok) throw new ActionError(`Neizdevās nosūtīt: ${res.error}`);
    return { to };
  }, (d) => `Testa e-pasts nosūtīts uz ${d.to}`);
}
