import { buttons, esc, h2, itemsTable, kvTable, layout, link, money, num, p, panel, progress, safeUrl, statCards, TextDoc, textFooter, type EmailContext, type RenderedEmail } from "./layout";
import { itemRows, shippingSummary, type OrderEmailData } from "./order-parts";

export type OrderShippedInput = {
  order: OrderEmailData;
  carrierName: string | null;
  trackingNumbers: string[];
  trackingUrl: string | null;
  accountUrl: string | null;
};

/** 3. "Your order has been shipped" → customer. */
export function renderOrderShipped(ctx: EmailContext, input: OrderShippedInput): RenderedEmail {
  const { t, company } = ctx;
  const o = input.order;
  const name = o.customer?.name?.trim();
  const greeting = name ? t("common.greeting", { name }) : t("common.greetingAnon");
  const ship = shippingSummary(o, ctx);
  const trackUrl = safeUrl(input.trackingUrl);
  const destLabel = o.shipping_method === "parcel_locker" ? t("orderShipped.toLocker") : t("orderShipped.toAddress");
  const numbers = input.trackingNumbers.join(", ");

  const rows: [string, string][] = [
    [t("orderShipped.carrier"), esc(input.carrierName ?? "")],
    [t("orderShipped.tracking"), numbers ? `<span style="font-weight:800;font-size:16px;letter-spacing:0.03em;">${trackUrl ? link(trackUrl, numbers) : esc(numbers)}</span>` : ""],
    [destLabel, `<strong>${esc(ship.method)}</strong>${ship.detail ? `<br><span style="font-weight:400;">${esc(ship.detail)}</span>` : ""}`],
  ];

  const body = [
    p(esc(greeting), { margin: "0 0 18px", size: 16 }),
    progress([
      { label: t("progress.placed"), state: "done" },
      { label: t("progress.processing"), state: "done" },
      { label: t("progress.shipped"), state: "current" },
      { label: t("progress.delivered"), state: "todo" },
    ]),
    statCards([
      { label: t("common.orderNumber"), value: o.number },
      { label: t("orderShipped.carrier"), value: input.carrierName ?? "" },
      { label: t("orderShipped.tracking"), value: input.trackingNumbers[0] ?? "", strong: true },
    ]),
    panel(kvTable(rows, { labelWidth: 150 })),
    buttons([
      { href: trackUrl, label: t("orderShipped.track") },
      { href: input.accountUrl, label: t("common.viewOrder") },
    ]),
    o.shipping_method === "parcel_locker" ? p(`&#128274;&nbsp; ${esc(t("orderShipped.lockerNote"))}`, { muted: true, size: 13, margin: "6px 0 0" }) : "",
    !input.trackingNumbers.length ? p(esc(t("orderShipped.noTracking")), { muted: true, size: 13, margin: "6px 0 0" }) : "",
    o.items.length ? h2(`${t("orderShipped.itemsTitle")} · ${t("common.itemsCount", { count: o.items.reduce((s, i) => s + num(i.qty), 0) })}`) + itemsTable(itemRows(o, ctx)) : "",
  ].join("\n");

  const subject = t("orderShipped.subject", { number: o.number });
  const html = layout(ctx, {
    title: subject,
    preheader: t("orderShipped.preheader", { number: o.number }),
    hero: { eyebrow: t("orderShipped.eyebrow"), title: t("orderShipped.title"), intro: t("orderShipped.intro", { number: o.number }) },
    body,
    footerNote: t("common.footerAuto"),
  });

  const doc = new TextDoc();
  doc.line(t("orderShipped.title")).gap().line(greeting).line(t("orderShipped.intro", { number: o.number })).gap();
  doc.kv([
    [t("common.orderNumber"), o.number],
    [t("orderShipped.carrier"), input.carrierName ?? ""],
    [t("orderShipped.tracking"), numbers],
    [destLabel, [ship.method, ship.detail].filter(Boolean).join(" — ")],
  ]);
  if (trackUrl) doc.gap().line(`${t("orderShipped.track")}: ${trackUrl}`);
  if (o.shipping_method === "parcel_locker") doc.gap().line(t("orderShipped.lockerNote"));
  if (!input.trackingNumbers.length) doc.gap().line(t("orderShipped.noTracking"));
  if (o.items.length) {
    doc.heading(t("orderShipped.itemsTitle"));
    for (const r of itemRows(o, ctx)) doc.line(`• ${r.name}${r.meta ? ` (${r.meta})` : ""} — ${r.qtyLine}`);
  }
  if (input.accountUrl) doc.gap().line(`${t("common.viewOrder")}: ${input.accountUrl}`);
  doc.gap().line(t("common.questions", { phone: company.phone, email: company.email }));
  return { subject, html, text: doc.toString() + "\n" + textFooter(ctx, t("common.footerAuto")) };
}

export type OrderCancelledInput = { order: OrderEmailData; accountUrl: string | null; catalogUrl: string };

/** 4. Order cancelled → customer. */
export function renderOrderCancelled(ctx: EmailContext, input: OrderCancelledInput): RenderedEmail {
  const { t, locale, company } = ctx;
  const o = input.order;
  const name = o.customer?.name?.trim();
  const greeting = name ? t("common.greeting", { name }) : t("common.greetingAnon");
  const paid = o.payment_status === "paid" || o.payment_status === "partially_refunded";
  const amount = money(num(o.total_gross), locale);

  const body = [
    p(esc(greeting), { margin: "0 0 18px", size: 16 }),
    statCards([
      { label: t("common.orderNumber"), value: o.number },
      { label: t("orderCancelled.amount"), value: amount, strong: true },
    ]),
    panel(p(esc(paid ? t("orderCancelled.refund") : t("orderCancelled.unpaid")), { size: 14, margin: "0" }), paid ? "info" : "default"),
    p(esc(t("orderCancelled.mistake")), { muted: true, size: 14 }),
    buttons([
      { href: input.catalogUrl, label: t("orderCancelled.cta") },
      { href: input.accountUrl, label: t("common.viewOrder") },
    ]),
    o.items.length ? h2(t("items.title")) + itemsTable(itemRows(o, ctx)) : "",
  ].join("\n");

  const subject = t("orderCancelled.subject", { number: o.number });
  const html = layout(ctx, {
    title: subject,
    preheader: t("orderCancelled.preheader", { number: o.number }),
    hero: { eyebrow: t("orderCancelled.eyebrow"), title: t("orderCancelled.title"), intro: t("orderCancelled.intro", { number: o.number }), tone: "danger" },
    body,
    footerNote: t("common.footerAuto"),
  });

  const doc = new TextDoc();
  doc.line(t("orderCancelled.title")).gap().line(greeting).line(t("orderCancelled.intro", { number: o.number })).gap();
  doc.kv([
    [t("common.orderNumber"), o.number],
    [t("orderCancelled.amount"), amount],
  ]);
  doc.gap().line(paid ? t("orderCancelled.refund") : t("orderCancelled.unpaid")).gap().line(t("orderCancelled.mistake"));
  if (o.items.length) {
    doc.heading(t("items.title"));
    for (const r of itemRows(o, ctx)) doc.line(`• ${r.name}${r.meta ? ` (${r.meta})` : ""} — ${r.qtyLine} = ${r.total}`);
  }
  doc.gap().line(`${t("orderCancelled.cta")}: ${input.catalogUrl}`);
  doc.gap().line(t("common.questions", { phone: company.phone, email: company.email }));
  return { subject, html, text: doc.toString() + "\n" + textFooter(ctx, t("common.footerAuto")) };
}
