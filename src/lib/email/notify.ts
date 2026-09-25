import "server-only";
import type { PlaceOrderPayload } from "@/app/[locale]/checkout/actions";
import { buildTrackingUrl } from "@/lib/shipping/tracking";
import { adminUrl, emailContext, emailLocale, urlFor } from "./context";
import { invoicePdf, loadInvoiceByNumber, loadOrderForEmail, orderFromCheckout, proformaFromOrder, type Db } from "./data";
import { isEmail, sendEmail, shopNotifyAddress, type EmailAttachment } from "./send";
import { renderB2BDecision, renderInvoiceIssued } from "./templates/customer-misc";
import { renderOrderConfirmation } from "./templates/order-confirmation";
import { providerName, type OrderEmailData } from "./templates/order-parts";
import { renderOrderCancelled, renderOrderShipped } from "./templates/order-status";
import { renderShopBusinessApplication, renderShopInquiry, renderShopNewOrder, type ShopInquiryInput } from "./templates/shop";

/**
 * High-level notifications. Each function loads what it needs, renders and sends; all are meant to run
 * inside `deferEmail()` (after the response). They never throw for "expected" problems (missing data,
 * RLS, Resend errors) — those are logged.
 */

function accountOrderUrl(o: OrderEmailData) {
  return o.user_id ? urlFor({ pathname: "/account/orders/[id]", params: { id: o.id } }, emailLocale(o.locale)) : null;
}

// ───────────────────────── 1 + 2. order placed ─────────────────────────

export type PlacedOrderRpc = {
  id: string;
  number: string;
  total_gross: number | string;
  subtotal_net?: number | string;
  shipping_net?: number | string;
  vat_rate?: number | string;
  vat_amount?: number | string;
  payment_method: string;
  invoice_number: string | null;
  reverse_charge: boolean;
};

export async function notifyOrderPlaced(db: Db, payload: PlaceOrderPayload, rpc: PlacedOrderRpc) {
  const order = (rpc.id ? await loadOrderForEmail(db, rpc.id) : null) ?? (await orderFromCheckout(db, payload, { ...rpc, id: rpc.id ?? "" }));
  const ctx = await emailContext(order.locale);

  // invoice / proforma PDF issued together with the order
  let attachment: EmailAttachment | null = null;
  if (rpc.invoice_number) {
    const inv = await loadInvoiceByNumber(db, rpc.invoice_number);
    if (inv) attachment = await invoicePdf({ ...inv, order_number: order.number, default_notes: null });
    else if (order.payment_method === "bank_transfer") attachment = await invoicePdf(proformaFromOrder(order, rpc.invoice_number, ctx.company));
  }

  const customer = renderOrderConfirmation(ctx, {
    order,
    invoiceNumber: rpc.invoice_number,
    invoiceAttached: Boolean(attachment),
    accountUrl: accountOrderUrl(order),
    registerUrl: order.user_id ? null : urlFor("/register", emailLocale(order.locale)),
  });

  const lv = order.locale === "lv" ? ctx : await emailContext("lv");
  const shop = renderShopNewOrder(lv, { order, adminUrl: adminUrl(`/orders/${order.id}`), invoiceNumber: rpc.invoice_number });

  await Promise.allSettled([
    sendEmail({
      to: order.email,
      ...customer,
      attachments: attachment ? [attachment] : undefined,
      tags: { type: "order_confirmation" },
      idempotencyKey: `order-confirmation/${order.id || order.number}`,
    }),
    sendEmail({
      to: await shopNotifyAddress(),
      ...shop,
      replyTo: isEmail(order.email) ? order.email : null,
      tags: { type: "shop_new_order" },
      idempotencyKey: `shop-new-order/${order.id || order.number}`,
    }),
  ]);
}

// ───────────────────────── 3. shipped ─────────────────────────

type ShipmentLite = { carrier: string; tracking_number: string | null; tracking_numbers: string[] | null; status: string };
type CarrierLite = { code: string; name: string; tracking_url_template: string | null };

export async function notifyOrderShipped(db: Db, orderId: string) {
  const order = await loadOrderForEmail(db, orderId);
  if (!order || !isEmail(order.email)) return;

  const { data: shipments } = await db
    .from("shipments")
    .select("carrier, tracking_number, tracking_numbers, status")
    .eq("order_id", orderId)
    .not("status", "in", "(cancelled,returned)")
    .order("created_at", { ascending: false })
    .limit(1);
  const shipment = ((shipments ?? []) as ShipmentLite[])[0] ?? null;
  const carrierCode = order.tracking_carrier || shipment?.carrier || null;
  let carrier: CarrierLite | null = null;
  if (carrierCode) {
    const { data } = await db.from("shipping_carriers").select("code, name, tracking_url_template").eq("code", carrierCode).maybeSingle();
    carrier = (data as CarrierLite | null) ?? null;
  }
  const numbers = shipment?.tracking_numbers?.length ? shipment.tracking_numbers : order.tracking_code ? [order.tracking_code] : shipment?.tracking_number ? [shipment.tracking_number] : [];
  const trackingUrl = order.tracking_url || buildTrackingUrl(carrier?.tracking_url_template, numbers[0], carrierCode);

  const ctx = await emailContext(order.locale);
  const mail = renderOrderShipped(ctx, {
    order,
    carrierName: carrier?.name ?? (carrierCode ? providerName(carrierCode) : null),
    trackingNumbers: numbers,
    trackingUrl,
    accountUrl: accountOrderUrl(order),
  });
  await sendEmail({
    to: order.email,
    ...mail,
    tags: { type: "order_shipped" },
    idempotencyKey: `order-shipped/${order.id}/${numbers[0] ?? "none"}`,
  });
}

// ───────────────────────── 4. cancelled ─────────────────────────

export async function notifyOrderCancelled(db: Db, orderId: string) {
  const order = await loadOrderForEmail(db, orderId);
  if (!order || !isEmail(order.email)) return;
  const ctx = await emailContext(order.locale);
  const mail = renderOrderCancelled(ctx, { order, accountUrl: accountOrderUrl(order), catalogUrl: urlFor("/catalog", emailLocale(order.locale)) });
  await sendEmail({ to: order.email, ...mail, tags: { type: "order_cancelled" }, idempotencyKey: `order-cancelled/${order.id}` });
}

// ───────────────────────── 5. invoice issued ─────────────────────────

export async function notifyInvoiceIssued(db: Db, invoiceNumber: string) {
  const inv = await loadInvoiceByNumber(db, invoiceNumber);
  if (!inv) return;
  const order = inv.order_id ? await loadOrderForEmail(db, inv.order_id) : null;
  const buyer = (inv.buyer ?? {}) as { email?: string; name?: string; company_name?: string };
  const to = order?.email || buyer.email;
  if (!isEmail(to)) return;

  const { data: invoiceSettings } = await db.from("settings").select("value").eq("key", "invoice").maybeSingle();
  const pdf = await invoicePdf({
    ...inv,
    order_number: order?.number ?? null,
    default_notes: (invoiceSettings?.value as { notes?: string } | null)?.notes ?? null,
  });

  const locale = emailLocale(order?.locale);
  const ctx = await emailContext(locale);
  const userId = order?.user_id ?? inv.user_id;
  const mail = renderInvoiceIssued(ctx, {
    invoice: {
      number: inv.number,
      type: String(inv.type),
      issued_at: String(inv.issued_at),
      due_at: inv.due_at,
      total_gross: Number(inv.total_gross) || 0,
      reverse_charge: Boolean(inv.reverse_charge),
    },
    orderNumber: order?.number ?? null,
    customerName: order?.customer?.name?.trim() || buyer.name || null,
    attached: Boolean(pdf),
    invoicesUrl: userId ? urlFor("/account/invoices", locale) : null,
  });
  await sendEmail({ to, ...mail, attachments: pdf ? [pdf] : undefined, tags: { type: "invoice_issued" }, idempotencyKey: `invoice/${inv.id}` });
}

// ───────────────────────── 6. B2B decision → customer ─────────────────────────

type ProfileLite = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  reg_no: string | null;
  vat_no: string | null;
  legal_address: string | null;
  market: string | null;
  preferred_locale: string | null;
  discount_percent: number | string | null;
  payment_terms_days: number | null;
  b2b_status: string;
  customer_type: string;
};
const PROFILE_COLS =
  "id, email, full_name, phone, company_name, reg_no, vat_no, legal_address, market, preferred_locale, discount_percent, payment_terms_days, b2b_status, customer_type";

export async function notifyB2BDecision(db: Db, customerId: string, decision: "approved" | "rejected") {
  const { data } = await db.from("profiles").select(PROFILE_COLS).eq("id", customerId).maybeSingle();
  const profile = data as ProfileLite | null;
  if (!profile || !isEmail(profile.email) || profile.b2b_status !== decision) return;
  const locale = emailLocale(profile.preferred_locale);
  const ctx = await emailContext(locale);
  const mail = renderB2BDecision(ctx, {
    decision,
    name: profile.full_name,
    company: profile.company_name,
    discountPercent: Number(profile.discount_percent) || 0,
    termsDays: Number(profile.payment_terms_days) || 0,
    catalogUrl: urlFor("/catalog", locale),
    contactUrl: urlFor("/contact", locale),
  });
  await sendEmail({ to: profile.email, ...mail, tags: { type: `b2b_${decision}` }, idempotencyKey: `b2b-${decision}/${profile.id}/${new Date().toISOString().slice(0, 10)}` });
}

// ───────────────────────── 6. inquiries / B2B applications → shop ─────────────────────────

export async function notifyInquiry(input: Omit<ShopInquiryInput, "adminUrl"> & { id?: string | null }) {
  const ctx = await emailContext("lv");
  const mail = renderShopInquiry(ctx, { ...input, adminUrl: adminUrl("/inquiries") });
  await sendEmail({
    to: await shopNotifyAddress(),
    ...mail,
    replyTo: isEmail(input.email) ? input.email : null,
    tags: { type: `shop_inquiry_${input.type}` },
    idempotencyKey: input.id ? `inquiry/${input.id}` : undefined,
  });
}

/** Account "Apply for B2B" form or business sign-up → shop. */
export async function notifyBusinessApplication(db: Db, userId: string, source: "account" | "signup") {
  const { data } = await db.from("profiles").select(PROFILE_COLS).eq("id", userId).maybeSingle();
  const profile = data as ProfileLite | null;
  if (!profile || profile.b2b_status !== "pending") return;
  const ctx = await emailContext("lv");
  const mail = renderShopBusinessApplication(ctx, {
    source,
    name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    company: profile.company_name,
    regNo: profile.reg_no,
    vatNo: profile.vat_no,
    legalAddress: profile.legal_address,
    market: profile.market,
    adminUrl: adminUrl(`/customers/${profile.id}`),
  });
  await sendEmail({
    to: await shopNotifyAddress(),
    ...mail,
    replyTo: isEmail(profile.email) ? profile.email : null,
    tags: { type: "shop_b2b_application" },
    idempotencyKey: `b2b-application/${profile.id}/${source}/${new Date().toISOString().slice(0, 10)}`,
  });
}

/**
 * After a business sign-up (e-mail confirmation link or instant session): notify the shop once.
 * Only for fresh accounts (< 24 h) with a pending B2B status; the Resend idempotency key dedupes repeats.
 */
export async function notifyBusinessSignupIfNew(db: Db) {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user?.created_at || Date.now() - new Date(user.created_at).getTime() > 86_400_000) return;
  const { data } = await db.from("profiles").select("b2b_status, customer_type").eq("id", user.id).maybeSingle();
  const p = data as { b2b_status: string; customer_type: string } | null;
  if (!p || p.b2b_status !== "pending" || p.customer_type !== "business") return;
  await notifyBusinessApplication(db, user.id, "signup");
}
