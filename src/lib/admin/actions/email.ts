"use server";

import { z } from "zod";
import { adminUrl, emailContext, urlFor } from "@/lib/email/context";
import { isEmail, isEmailEnabled, sendEmail, shopNotifyAddress } from "@/lib/email/send";
import { renderOrderConfirmation } from "@/lib/email/templates/order-confirmation";
import { renderOrderCancelled, renderOrderShipped } from "@/lib/email/templates/order-status";
import { renderB2BDecision, renderInvoiceIssued } from "@/lib/email/templates/customer-misc";
import { renderShopBusinessApplication, renderShopInquiry, renderShopNewOrder } from "@/lib/email/templates/shop";
import { sampleB2BOrder, sampleOrder } from "@/lib/email/templates/samples";
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * "Nosūtīt visus testa e-pastus": every e-mail the shop sends, with sample data, to one address — customer e-mails
 * (LV, plus one in ET) and the shop notifications. Subjects are prefixed "[TESTS n/N]". Nothing in the DB changes.
 */
export async function sendAllTestEmails(toInput: string | null) {
  return adminAction(
    async () => {
      if (!isEmailEnabled()) throw new ActionError("E-pastu sūtīšana nav pieslēgta.");
      const to = (z.string().trim().max(200).nullable().parse(toInput) || (await shopNotifyAddress()).split(/[,;]/)[0] || "").trim();
      if (!isEmail(to)) throw new ActionError("Ievadiet derīgu e-pasta adresi.");

      const lv = await emailContext("lv");
      const et = await emailContext("et");
      const order = sampleOrder({ email: to });
      const account = urlFor("/account/orders", "lv");
      const catalog = urlFor("/catalog", "lv");
      const now = new Date().toISOString();

      const mails: { label: string; mail: { subject: string; html: string; text: string } }[] = [
        { label: "Pasūtījums ar bankas pārskaitījumu", mail: renderOrderConfirmation(lv, { order, invoiceNumber: "PRO-2026-00042", invoiceAttached: false, accountUrl: account, registerUrl: null }) },
        {
          label: "Apmaksāts ar karti (Stripe)",
          mail: renderOrderConfirmation(lv, {
            order: sampleOrder({ email: to, payment_method: "stripe", payment_status: "paid", notes: null }),
            invoiceNumber: "ELA-2026-00044",
            invoiceAttached: false,
            accountUrl: null,
            registerUrl: urlFor("/register", "lv"),
          }),
        },
        {
          label: "B2B pasūtījums (igauņu valodā)",
          mail: renderOrderConfirmation(et, { order: { ...sampleB2BOrder(), email: to, locale: "et" }, invoiceNumber: "ELA-2026-00043", invoiceAttached: false, accountUrl: null, registerUrl: urlFor("/register", "et") }),
        },
        {
          label: "Pasūtījums nosūtīts",
          mail: renderOrderShipped(lv, { order, carrierName: "Omniva", trackingNumbers: ["CC123456789EE"], trackingUrl: "https://www.omniva.lv/track", accountUrl: account }),
        },
        { label: "Pasūtījums atcelts", mail: renderOrderCancelled(lv, { order, accountUrl: null, catalogUrl: catalog }) },
        {
          label: "Rēķins izrakstīts",
          mail: renderInvoiceIssued(lv, {
            invoice: { number: "ELA-2026-00042", type: "invoice", issued_at: now, due_at: null, total_gross: 107.29, reverse_charge: false },
            orderNumber: order.number,
            customerName: "Jānis Bērziņš",
            attached: false,
            invoicesUrl: urlFor("/account/invoices", "lv"),
          }),
        },
        {
          label: "B2B pieteikums apstiprināts",
          mail: renderB2BDecision(lv, { decision: "approved", name: "Jānis", company: "SIA Auto", discountPercent: 12, termsDays: 14, catalogUrl: catalog, contactUrl: urlFor("/contact", "lv") }),
        },
        { label: "Veikalam: jauns pasūtījums", mail: renderShopNewOrder(lv, { order, adminUrl: adminUrl("/orders"), invoiceNumber: "PRO-2026-00042" }) },
        {
          label: "Veikalam: jautājums no kontaktformas",
          mail: renderShopInquiry(lv, {
            type: "contact",
            name: "Pēteris Ozols",
            email: "peteris@example.lv",
            phone: "+371 29999999",
            company: "SIA Serviss",
            message: "Labdien! Vēlos uzzināt cenas 200 L mucām Multilight 10W-40 un piegādi uz Valmieru.",
            locale: "lv",
            extra: { product_name: "Multilight 10W-40", volume: "200 L", city: "Valmiera" },
            adminUrl: adminUrl("/inquiries"),
          } as never),
        },
        {
          label: "Veikalam: B2B pieteikums",
          mail: renderShopBusinessApplication(lv, {
            source: "signup",
            name: "Mari Tamm",
            email: "mari@example.ee",
            phone: "+372 5555555",
            company: "Autoteenindus OÜ",
            regNo: "12345678",
            vatNo: "EE101234567",
            legalAddress: "Peterburi tee 46, Tallinn",
            market: "EE",
            adminUrl: adminUrl("/customers"),
          }),
        },
      ];

      const failed: string[] = [];
      for (const [i, { label, mail }] of mails.entries()) {
        const res = await sendEmail({ to, replyTo: to, ...mail, subject: `[TESTS ${i + 1}/${mails.length}] ${mail.subject}`, tags: { type: "test" } });
        if (!res.ok) failed.push(`${label}: ${res.error}`);
        await sleep(650); // Resend rate limit (2 req/s)
      }
      if (failed.length === mails.length) throw new ActionError(`Neizdevās nosūtīt: ${failed[0]}`);
      return { to, sent: mails.length - failed.length, total: mails.length, failed };
    },
    (d) => (d.failed.length ? `Nosūtīti ${d.sent} no ${d.total} uz ${d.to}. Neizdevās: ${d.failed.join("; ")}` : `Visi ${d.total} testa e-pasti nosūtīti uz ${d.to}`),
  );
}
