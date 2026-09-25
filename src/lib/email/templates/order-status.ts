import { button, esc, h1, kvTable, layout, link, money, num, p, panel, safeUrl, TextDoc, textFooter, type EmailContext, type RenderedEmail } from "./layout";
import { shippingSummary, type OrderEmailData } from "./order-parts";

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

  const rows: [string, string][] = [
    [t("common.orderNumber"), esc(o.number)],
    [t("orderShipped.carrier"), esc(input.carrierName ?? "")],
    [t("orderShipped.tracking"), input.trackingNumbers.length ? (trackUrl ? link(trackUrl, input.trackingNumbers.join(", ")) : esc(input.trackingNumbers.join(", "))) : ""],
    [destLabel, esc(ship.detail || ship.method)],
  ];

  const body = [
    h1(t("orderShipped.title")),
    p(esc(greeting), { margin: "0 0 6px" }),
    p(esc(t("orderShipped.intro", { number: o.number }))),
    panel(kvTable(rows, { labelWidth: 150 })),
    trackUrl ? button(trackUrl, t("orderShipped.track")) : "",
    o.shipping_method === "parcel_locker" ? p(esc(t("orderShipped.lockerNote")), { muted: true, size: 13, margin: "14px 0 0" }) : "",
    !input.trackingNumbers.length ? p(esc(t("orderShipped.noTracking")), { muted: true, size: 13, margin: "14px 0 0" }) : "",
    input.accountUrl ? p(link(input.accountUrl, t("common.viewOrder")), { size: 14, margin: "18px 0 0" }) : "",
    p(esc(t("common.questions", { phone: company.phone, email: company.email })), { muted: true, size: 13, margin: "22px 0 0" }),
  ].join("\n");

  const subject = t("orderShipped.subject", { number: o.number });
  const html = layout(ctx, { title: subject, preheader: t("orderShipped.preheader", { number: o.number }), body, footerNote: t("common.footerAuto") });

  const doc = new TextDoc();
  doc.line(t("orderShipped.title")).gap().line(greeting).line(t("orderShipped.intro", { number: o.number })).gap();
  doc.kv([
    [t("common.orderNumber"), o.number],
    [t("orderShipped.carrier"), input.carrierName ?? ""],
    [t("orderShipped.tracking"), input.trackingNumbers.join(", ")],
    [destLabel, ship.detail || ship.method],
  ]);
  if (trackUrl) doc.gap().line(`${t("orderShipped.track")}: ${trackUrl}`);
  if (o.shipping_method === "parcel_locker") doc.gap().line(t("orderShipped.lockerNote"));
  if (!input.trackingNumbers.length) doc.gap().line(t("orderShipped.noTracking"));
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
  const money$ = money(num(o.total_gross), locale);

  const body = [
    h1(t("orderCancelled.title")),
    p(esc(greeting), { margin: "0 0 6px" }),
    p(esc(t("orderCancelled.intro", { number: o.number }))),
    panel(
      kvTable(
        [
          [t("common.orderNumber"), esc(o.number)],
          [t("orderCancelled.amount"), esc(money$)],
        ],
        { labelWidth: 150 },
      ),
    ),
    p(esc(paid ? t("orderCancelled.refund") : t("orderCancelled.unpaid"))),
    p(esc(t("orderCancelled.mistake")), { muted: true, size: 14 }),
    button(input.catalogUrl, t("orderCancelled.cta")),
    p(esc(t("common.questions", { phone: company.phone, email: company.email })), { muted: true, size: 13, margin: "22px 0 0" }),
  ].join("\n");

  const subject = t("orderCancelled.subject", { number: o.number });
  const html = layout(ctx, { title: subject, preheader: t("orderCancelled.preheader", { number: o.number }), body, footerNote: t("common.footerAuto") });

  const doc = new TextDoc();
  doc.line(t("orderCancelled.title")).gap().line(greeting).line(t("orderCancelled.intro", { number: o.number })).gap();
  doc.kv([
    [t("common.orderNumber"), o.number],
    [t("orderCancelled.amount"), money$],
  ]);
  doc.gap().line(paid ? t("orderCancelled.refund") : t("orderCancelled.unpaid")).gap().line(t("orderCancelled.mistake"));
  doc.gap().line(`${t("orderCancelled.cta")}: ${input.catalogUrl}`);
  doc.gap().line(t("common.questions", { phone: company.phone, email: company.email }));
  return { subject, html, text: doc.toString() + "\n" + textFooter(ctx, t("common.footerAuto")) };
}
