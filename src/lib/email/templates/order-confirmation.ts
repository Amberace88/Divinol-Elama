import { button, divider, esc, escMultiline, h1, h2, itemsTable, kvTable, layout, money, num, p, panel, TextDoc, textFooter, totalsTable, type EmailContext, type RenderedEmail } from "./layout";
import { customerLines, escJoin, itemRows, paymentLabel, shippingSummary, totalRows, type OrderEmailData } from "./order-parts";

export type OrderConfirmationInput = {
  order: OrderEmailData;
  /** proforma / invoice number issued together with the order (bank transfer / B2B invoice) */
  invoiceNumber: string | null;
  /** true when the invoice PDF is attached to this e-mail */
  invoiceAttached: boolean;
  /** absolute URL of the order in the customer account (null for guests) */
  accountUrl: string | null;
  /** absolute URL of the registration page (shown to guests) */
  registerUrl?: string | null;
};

/** 1. Order confirmation → customer. */
export function renderOrderConfirmation(ctx: EmailContext, input: OrderConfirmationInput): RenderedEmail {
  const { t, locale, company } = ctx;
  const o = input.order;
  const total = money(num(o.total_gross), locale);
  const ship = shippingSummary(o, ctx);
  const name = o.customer?.name?.trim();
  const greeting = name ? t("common.greeting", { name }) : t("common.greetingAnon");

  // ── payment instructions ──
  const payHtml: string[] = [];
  const payText: string[] = [];
  if (o.payment_method === "bank_transfer") {
    if (company.iban) {
      const rows: [string, string][] = [
        [t("payment.recipient"), company.name],
        [t("common.regNo"), company.reg_no],
        [t("payment.bank"), company.bank_name ?? ""],
        [t("payment.iban"), company.iban],
        [t("payment.swift"), company.swift ?? ""],
        [t("payment.reference"), o.number],
        [t("payment.amount"), total],
      ];
      payHtml.push(p(esc(t("payment.bankIntro")), { margin: "0 0 10px" }), kvTable(rows.map(([k, v]) => [k, esc(v)]), { labelWidth: 150 }));
      payText.push(t("payment.bankIntro"), ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`));
      payHtml.push(p(esc(t("payment.afterPayment")), { muted: true, size: 13, margin: "12px 0 0" }));
      payText.push(t("payment.afterPayment"));
    } else {
      payHtml.push(p(esc(t("payment.invoiceFollows", { number: o.number })), { margin: "0" }));
      payText.push(t("payment.invoiceFollows", { number: o.number }));
    }
    if (input.invoiceNumber && input.invoiceAttached) {
      payHtml.push(p(esc(t("payment.proformaAttached", { invoice: input.invoiceNumber })), { muted: true, size: 13, margin: "10px 0 0" }));
      payText.push(t("payment.proformaAttached", { invoice: input.invoiceNumber }));
    }
  } else if (o.payment_method === "invoice") {
    const msg = input.invoiceNumber ? t("payment.invoiceIssued", { invoice: input.invoiceNumber }) : t("payment.invoiceLater");
    payHtml.push(p(esc(msg), { margin: "0" }));
    payText.push(msg);
    if (input.invoiceNumber && input.invoiceAttached) {
      payHtml.push(p(esc(t("payment.invoiceAttached")), { muted: true, size: 13, margin: "10px 0 0" }));
      payText.push(t("payment.invoiceAttached"));
    }
  } else if (o.payment_method === "cash_on_pickup") {
    const msg = t("payment.cashOnPickup", { address: company.warehouse || company.address });
    payHtml.push(p(esc(msg), { margin: "0" }));
    payText.push(msg);
  } else {
    payHtml.push(p(esc(t("payment.card")), { margin: "0" }));
    payText.push(t("payment.card"));
  }

  // ── HTML ──
  const summary = kvTable([
    [t("common.orderNumber"), `<span style="font-weight:800;">${esc(o.number)}</span>`],
    [t("common.date"), esc(fmtDateSafe(o.created_at, locale))],
    [t("common.customer"), escJoin([...customerLines(o), o.customer?.reg_no && `${t("common.regNo")} ${o.customer.reg_no}`, o.customer?.vat_no && `${t("common.vatNo")} ${o.customer.vat_no}`])],
    [t("shipping.title"), `${esc(ship.method)}${ship.detail ? `<br><span style="font-weight:400;">${esc(ship.detail)}</span>` : ""}`],
    [t("payment.title"), esc(paymentLabel(o, ctx))],
  ]);

  const body = [
    h1(t("orderConfirmation.title")),
    p(esc(greeting), { margin: "0 0 6px" }),
    p(esc(t("orderConfirmation.intro", { number: o.number }))),
    summary,
    h2(t("items.title")),
    itemsTable(itemRows(o, ctx)),
    totalsTable(totalRows(o, ctx)),
    o.shipping_method === "freight" ? p(esc(t("shipping.freightNote")), { muted: true, size: 13, margin: "12px 0 0" }) : "",
    h2(t("payment.title")),
    panel(payHtml.join("")),
    o.notes ? h2(t("orderConfirmation.notes")) + p(escMultiline(o.notes), { muted: true, size: 14 }) : "",
    p(esc(t("orderConfirmation.next")), { size: 14, margin: "18px 0 0" }),
    input.accountUrl ? button(input.accountUrl, t("orderConfirmation.cta")) : "",
    !input.accountUrl && input.registerUrl
      ? divider("22px 0 14px") + p(`${esc(t("orderConfirmation.guestNote"))} <a href="${esc(input.registerUrl)}" style="color:#1e2d51;font-weight:700;">${esc(t("orderConfirmation.register"))}</a>`, { muted: true, size: 13, margin: "0" })
      : "",
    p(esc(t("common.questions", { phone: company.phone, email: company.email })), { muted: true, size: 13, margin: "22px 0 0" }),
  ].join("\n");

  const subject = t("orderConfirmation.subject", { number: o.number });
  const html = layout(ctx, { title: subject, preheader: t("orderConfirmation.preheader", { number: o.number, total }), body, footerNote: t("common.footerAuto") });

  // ── text ──
  const doc = new TextDoc();
  doc.line(t("orderConfirmation.title")).gap().line(greeting).line(t("orderConfirmation.intro", { number: o.number })).gap();
  doc.kv([
    [t("common.orderNumber"), o.number],
    [t("common.date"), fmtDateSafe(o.created_at, locale)],
    [t("common.customer"), customerLines(o).join(", ")],
    [t("shipping.title"), [ship.method, ship.detail].filter(Boolean).join(" — ")],
    [t("payment.title"), paymentLabel(o, ctx)],
  ]);
  doc.heading(t("items.title"));
  for (const r of itemRows(o, ctx)) doc.line(`• ${r.name}${r.meta ? ` (${r.meta})` : ""} — ${r.qtyLine} = ${r.total}`);
  doc.gap();
  for (const r of totalRows(o, ctx)) doc.line(r.note ? r.label : `${r.label}: ${r.value}`);
  if (o.shipping_method === "freight") doc.gap().line(t("shipping.freightNote"));
  doc.heading(t("payment.title"));
  payText.forEach((l) => doc.line(l));
  if (o.notes) doc.heading(t("orderConfirmation.notes")).line(o.notes);
  doc.gap().line(t("orderConfirmation.next"));
  if (input.accountUrl) doc.gap().line(`${t("orderConfirmation.cta")}: ${input.accountUrl}`);
  else if (input.registerUrl) doc.gap().line(`${t("orderConfirmation.guestNote")} ${input.registerUrl}`);
  doc.gap().line(t("common.questions", { phone: company.phone, email: company.email }));

  return { subject, html, text: doc.toString() + "\n" + textFooter(ctx, t("common.footerAuto")) };
}

function fmtDateSafe(v: string, locale: string) {
  try {
    return new Intl.DateTimeFormat({ lv: "lv-LV", et: "et-EE", lt: "lt-LT", en: "en-IE", ru: "ru-RU" }[locale] ?? "lv-LV", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Riga",
    }).format(new Date(v));
  } catch {
    return v;
  }
}
