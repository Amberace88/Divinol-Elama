/* Renders every transactional e-mail with sample data to ./.email-preview/*.html (dev tool). */
import fs from "node:fs";
import path from "node:path";
import { createTranslator } from "next-intl";
import type { EmailContext } from "../src/lib/email/templates/layout";
import { renderOrderConfirmation } from "../src/lib/email/templates/order-confirmation";
import { renderOrderShipped, renderOrderCancelled } from "../src/lib/email/templates/order-status";
import { renderShopNewOrder, renderShopInquiry, renderShopBusinessApplication } from "../src/lib/email/templates/shop";
import { renderInvoiceIssued, renderB2BDecision } from "../src/lib/email/templates/customer-misc";
import { sampleOrder, sampleB2BOrder } from "../src/lib/email/templates/samples";

const out = path.resolve(".email-preview");
fs.mkdirSync(out, { recursive: true });

function ctx(locale: string): EmailContext {
  const messages = JSON.parse(fs.readFileSync(`src/messages/${locale}/emails.json`, "utf8"));
  const tr = createTranslator({ locale, messages, namespace: "emails", onError: () => {}, getMessageFallback: ({ key }) => `«${key}»` }) as unknown as (k: string, v?: Record<string, string | number>) => string;
  return {
    locale,
    t: (k, v) => tr(k, v),
    company: { name: 'SIA "ELAMA"', reg_no: "40103512445", vat_no: "LV40103512445", address: "Priežkalni 2, Jumpravas pag., Ogres nov., LV-5022", warehouse: "Ventspils iela 51, Rīga", phone: "+371 26556099", email: "elama@elama.lv", hours: "P.–Pk. 9:00–17:00", bank_name: "Swedbank", iban: "LV00HABA0000000000000", swift: "HABALV22" },
    siteUrl: locale === "et" ? "https://divinol.ee" : "https://divinol.lv",
    logoUrl: "https://divinol.lv/media/brand/elama-logo.png",
    links: locale === "et"
      ? { catalog: "https://divinol.ee/kataloog", oilFinder: "https://divinol.ee/olivalik", account: "https://divinol.ee/account", contact: "https://divinol.ee/kontakt" }
      : { catalog: "https://divinol.lv/katalogs", oilFinder: "https://divinol.lv/ellas-izvele", account: "https://divinol.lv/account", contact: "https://divinol.lv/kontakti" },
  };
}

const lv = ctx("lv");
const et = ctx("et");
const files: Record<string, { subject: string; html: string }> = {
  "01-order-confirmation-lv": renderOrderConfirmation(lv, { order: sampleOrder(), invoiceNumber: "PRO-2026-0042", invoiceAttached: true, accountUrl: "https://divinol.lv/account/orders/x", registerUrl: null }),
  "02-order-confirmation-b2b-et": renderOrderConfirmation(et, { order: { ...sampleB2BOrder(), locale: "et" }, invoiceNumber: "ELA-2026-0043", invoiceAttached: true, accountUrl: null, registerUrl: "https://divinol.ee/register" }),
  "03-shipped-lv": renderOrderShipped(lv, { order: sampleOrder(), carrierName: "Omniva", trackingNumbers: ["CC123456789EE"], trackingUrl: "https://www.omniva.lv/track", accountUrl: "https://divinol.lv/account/orders/x" }),
  "04-cancelled-lv": renderOrderCancelled(lv, { order: sampleOrder(), accountUrl: null, catalogUrl: "https://divinol.lv/katalogs" }),
  "05-invoice-lv": renderInvoiceIssued(lv, { invoice: { number: "ELA-2026-0042", type: "invoice", issued_at: new Date().toISOString(), due_at: null, total_gross: 107.29, reverse_charge: false }, orderNumber: "DIV-2026-00042", customerName: "Jānis Bērziņš", attached: true, invoicesUrl: "https://divinol.lv/account/invoices" }),
  "05b-invoice-paid-online-lv": renderOrderConfirmation(lv, { order: sampleOrder({ payment_method: "montonio_card", payment_status: "paid", notes: null }), invoiceNumber: "ELA-2026-0044", invoiceAttached: true, accountUrl: null, registerUrl: "https://divinol.lv/register" }),
  "06-b2b-approved-lv": renderB2BDecision(lv, { decision: "approved", name: "Jānis", company: "SIA Auto", discountPercent: 12, termsDays: 14, catalogUrl: "https://divinol.lv/katalogs", contactUrl: "https://divinol.lv/kontakti" }),
  "07-shop-new-order": renderShopNewOrder(lv, { order: sampleOrder(), adminUrl: "https://divinol.lv/admin/orders/x", invoiceNumber: "PRO-2026-0042" }),
  "08-shop-inquiry": renderShopInquiry(lv, { type: "contact", name: "Pēteris Ozols", email: "peteris@example.lv", phone: "+371 29999999", company: "SIA Serviss", message: "Labdien! Vēlos uzzināt cenas 200 L mucām Multilight 10W-40 un piegādi uz Valmieru.", locale: "lv", extra: { product_name: "Multilight 10W-40", volume: "200 L", city: "Valmiera" }, adminUrl: "https://divinol.lv/admin/inquiries" } as never),
  "09-shop-b2b-application": renderShopBusinessApplication(lv, { source: "signup", name: "Mari Tamm", email: "mari@example.ee", phone: "+372 5555555", company: "Autoteenindus OÜ", regNo: "12345678", vatNo: "EE101234567", legalAddress: "Peterburi tee 46, Tallinn", market: "EE", adminUrl: "https://divinol.lv/admin/customers" }),
};
for (const [name, r] of Object.entries(files)) fs.writeFileSync(path.join(out, `${name}.html`), `<!-- ${r.subject} -->\n${r.html}`);
console.log(Object.entries(files).map(([n, r]) => `${n}: ${r.subject}`).join("\n"));
