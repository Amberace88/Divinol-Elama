import { buttons, esc, escMultiline, h2, infoCards, itemsTable, kvTable, layout, money, num, p, panel, progress, statCards, TextDoc, textFooter, totalsTable, type EmailContext, type RenderedEmail } from "./layout";
import { customerLines, escJoin, formatAddress, itemRows, paymentLabel, shippingSummary, totalRows, type OrderEmailData } from "./order-parts";

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
  const paid = o.payment_status === "paid";
  const itemCount = o.items.reduce((s, i) => s + num(i.qty), 0);

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
      payHtml.push(
        p(esc(t("payment.bankIntro")), { margin: "0 0 6px", size: 14 }),
        kvTable(
          rows.map(([k, v]) => [k, k === t("payment.iban") || k === t("payment.reference") || k === t("payment.amount") ? `<span style="font-weight:800;letter-spacing:0.02em;">${esc(v)}</span>` : esc(v)]),
          { labelWidth: 150 },
        ),
      );
      payText.push(t("payment.bankIntro"), ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`));
      payHtml.push(p(esc(t("payment.afterPayment")), { muted: true, size: 13, margin: "12px 0 0" }));
      payText.push(t("payment.afterPayment"));
    } else {
      payHtml.push(p(esc(t("payment.invoiceFollows", { number: o.number })), { margin: "0" }));
      payText.push(t("payment.invoiceFollows", { number: o.number }));
    }
    if (input.invoiceNumber && input.invoiceAttached) {
      payHtml.push(p(`&#128206;&nbsp; ${esc(t("payment.proformaAttached", { invoice: input.invoiceNumber }))}`, { muted: true, size: 13, margin: "10px 0 0" }));
      payText.push(t("payment.proformaAttached", { invoice: input.invoiceNumber }));
    }
  } else if (o.payment_method === "invoice") {
    const msg = input.invoiceNumber ? t("payment.invoiceIssued", { invoice: input.invoiceNumber }) : t("payment.invoiceLater");
    payHtml.push(p(esc(msg), { margin: "0" }));
    payText.push(msg);
    if (input.invoiceNumber && input.invoiceAttached) {
      payHtml.push(p(`&#128206;&nbsp; ${esc(t("payment.invoiceAttached"))}`, { muted: true, size: 13, margin: "10px 0 0" }));
      payText.push(t("payment.invoiceAttached"));
    }
  } else if (o.payment_method === "montonio_bank" || o.payment_method === "montonio_card") {
    // online payment (Montonio) — this e-mail is sent once the payment has arrived
    const msg = paid ? t("payment.paidOnline", { amount: total }) : t("payment.onlinePending");
    payHtml.push(p(`${paid ? "&#10003;&nbsp; " : ""}${esc(msg)}`, { margin: "0" }));
    payText.push(msg);
    if (input.invoiceNumber && input.invoiceAttached) {
      payHtml.push(p(`&#128206;&nbsp; ${esc(t("payment.paidInvoiceAttached", { invoice: input.invoiceNumber }))}`, { muted: true, size: 13, margin: "10px 0 0" }));
      payText.push(t("payment.paidInvoiceAttached", { invoice: input.invoiceNumber }));
    }
  } else if (o.payment_method === "cash_on_pickup") {
    const msg = t("payment.cashOnPickup", { address: company.warehouse || company.address });
    payHtml.push(p(esc(msg), { margin: "0" }));
    payText.push(msg);
  } else {
    payHtml.push(p(esc(t("payment.card")), { margin: "0" }));
    payText.push(t("payment.card"));
  }

  // ── info cards ──
  const c = o.customer ?? {};
  const billing = formatAddress(o.billing_address ?? null, locale);
  const customerCard = escJoin([
    ...customerLines(o),
    c.reg_no && `${t("common.regNo")} ${c.reg_no}`,
    c.vat_no && `${t("common.vatNo")} ${c.vat_no}`,
    o.email,
    o.phone,
  ]);
  const shipCard = `<strong>${esc(ship.method)}</strong>${ship.detail ? `<br>${esc(ship.detail)}` : ""}`;
  const payCard = `<strong>${esc(paymentLabel(o, ctx))}</strong>${input.invoiceNumber ? `<br>${esc(input.invoiceNumber)}` : ""}`;

  // ── HTML ──
  const body = [
    p(esc(greeting), { margin: "0 0 18px", size: 16 }),
    progress([
      { label: t("progress.placed"), state: "done" },
      { label: t("progress.processing"), state: "current" },
      { label: t("progress.shipped"), state: "todo" },
      { label: t("progress.delivered"), state: "todo" },
    ]),
    statCards([
      { label: t("common.orderNumber"), value: o.number },
      { label: t("common.date"), value: fmtDateSafe(o.created_at, locale) },
      { label: t("common.total"), value: total, strong: true },
    ]),
    infoCards([
      { title: t("common.customer"), body: customerCard + (billing ? `<br><span style="color:#5b6475;">${esc(t("common.billingAddress"))}: ${esc(billing)}</span>` : "") },
      { title: t("shipping.title"), body: shipCard },
      { title: t("payment.title"), body: payCard },
    ]),
    h2(`${t("items.title")} · ${t("common.itemsCount", { count: itemCount })}`),
    itemsTable(itemRows(o, ctx)),
    totalsTable(totalRows(o, ctx)),
    o.shipping_method === "freight" ? p(esc(t("shipping.freightNote")), { muted: true, size: 13, margin: "12px 0 0" }) : "",
    h2(t("payment.title")),
    panel(payHtml.join(""), paid ? "success" : "default"),
    o.notes ? h2(t("orderConfirmation.notes")) + panel(p(escMultiline(o.notes), { size: 14, margin: "0" }), "info") : "",
    h2(t("orderConfirmation.nextTitle")),
    p(esc(t("orderConfirmation.next")), { size: 14, margin: "0" }),
    input.accountUrl ? buttons([{ href: input.accountUrl, label: t("orderConfirmation.cta") }]) : "",
    !input.accountUrl && input.registerUrl
      ? panel(p(`${esc(t("orderConfirmation.guestNote"))}<br><a href="${esc(input.registerUrl)}" style="color:#1e2d51;font-weight:800;">${esc(t("orderConfirmation.register"))}&nbsp;&rarr;</a>`, { size: 13, margin: "0" }), "info")
      : "",
  ].join("\n");

  const subject = t("orderConfirmation.subject", { number: o.number });
  const html = layout(ctx, {
    title: subject,
    preheader: t("orderConfirmation.preheader", { number: o.number, total }),
    hero: { eyebrow: t("orderConfirmation.eyebrow"), title: t("orderConfirmation.title"), intro: t("orderConfirmation.intro", { number: o.number }) },
    body,
    footerNote: t("common.footerAuto"),
  });

  // ── text ──
  const doc = new TextDoc();
  doc.line(t("orderConfirmation.title")).gap().line(greeting).line(t("orderConfirmation.intro", { number: o.number })).gap();
  doc.kv([
    [t("common.orderNumber"), o.number],
    [t("common.date"), fmtDateSafe(o.created_at, locale)],
    [t("common.total"), total],
    [t("common.customer"), [...customerLines(o), c.reg_no && `${t("common.regNo")} ${c.reg_no}`, c.vat_no && `${t("common.vatNo")} ${c.vat_no}`].filter(Boolean).join(", ")],
    [t("common.contact"), [o.email, o.phone].filter(Boolean).join(", ")],
    [t("common.billingAddress"), billing],
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
  doc.heading(t("orderConfirmation.nextTitle")).line(t("orderConfirmation.next"));
  if (input.accountUrl) doc.gap().line(`${t("orderConfirmation.cta")}: ${input.accountUrl}`);
  else if (input.registerUrl) doc.gap().line(`${t("orderConfirmation.guestNote")} ${input.registerUrl}`);
  doc.gap().line(t("common.questions", { phone: company.phone, email: company.email }));

  return { subject, html, text: doc.toString() + "\n" + textFooter(ctx, t("common.footerAuto")) };
}

function fmtDateSafe(v: string, locale: string) {
  try {
    return new Intl.DateTimeFormat({ lv: "lv-LV", et: "et-EE", lt: "lt-LT", en: "en-IE", ru: "ru-RU" }[locale] ?? "lv-LV", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Riga",
    }).format(new Date(v));
  } catch {
    return v;
  }
}
