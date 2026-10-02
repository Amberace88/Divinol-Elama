import { NextResponse, type NextRequest } from "next/server";
import {
  isStripeConfigured,
  retrievePaymentIntent,
  retrieveSession,
  sessionMeta,
  verifyWebhook,
  webhookSecret,
  type StripeCharge,
} from "@/lib/payments/stripe";
import { applyPaymentStatus, findOrderByPaymentRef, loadPaymentOrder, syncPayment } from "@/lib/payments/service";

/**
 * Stripe webhook — endpoint https://divinol.lv/api/payments/stripe/webhook (Stripe Dashboard → Developers → Webhooks).
 * Events to subscribe:
 *   checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
 *   checkout.session.expired, charge.refunded
 *
 * The event is only a trigger: the signed payload is verified, then the authoritative state is re-read from the
 * Stripe API (syncPayment) and applied through the idempotent payment_apply_status() — retries, duplicates and
 * out-of-order deliveries are harmless. 200 for events we don't use / unknown orders (Stripe stops retrying),
 * 400 for bad signatures, 500 only for our own transient failures (Stripe retries for up to 3 days).
 */
export const dynamic = "force-dynamic";

const str = (v: unknown) => (typeof v === "string" ? v : null);

async function orderForSession(sessionId: string, metaOrderId: string | null) {
  const byRef = await findOrderByPaymentRef(sessionId);
  if (byRef) return byRef;
  // an older session of the same order (customer retried) — still applies: a late PAID is never lost
  return metaOrderId && /^[0-9a-f-]{36}$/i.test(metaOrderId) ? loadPaymentOrder(metaOrderId) : null;
}

export async function POST(req: NextRequest) {
  if (!isStripeConfigured() || !webhookSecret()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const raw = await req.text();
  const event = verifyWebhook(raw, req.headers.get("stripe-signature"));
  if (!event) return NextResponse.json({ error: "invalid_signature" }, { status: 400 });

  const obj = event.data?.object ?? {};
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const sessionId = str(obj.id);
        if (!sessionId) return NextResponse.json({ ok: true, ignored: "no_session" });
        const metadata = (obj.metadata ?? {}) as Record<string, unknown>;
        const order = await orderForSession(sessionId, str(metadata.order_id));
        if (!order) return NextResponse.json({ ok: true, ignored: "unknown_order" });

        if (order.payment_ref === sessionId) {
          const r = await syncPayment(order.id);
          return NextResponse.json({ ok: true, changed: r.changed, payment_status: r.payment_status });
        }
        // event for a previous session of this order: apply only a real payment (never cancel the current attempt)
        const session = await retrieveSession(sessionId);
        if (session.status === "complete" && session.payment_status === "paid") {
          const r = await applyPaymentStatus(order.id, {
            ref: session.id,
            status: "PAID",
            amount: session.amount_total == null ? null : session.amount_total / 100,
            currency: session.currency,
            meta: sessionMeta(session),
          });
          return NextResponse.json({ ok: true, changed: r.changed, payment_status: r.payment_status });
        }
        return NextResponse.json({ ok: true, ignored: "stale_session" });
      }

      case "charge.refunded": {
        const charge = obj as unknown as StripeCharge;
        if (!charge.payment_intent) return NextResponse.json({ ok: true, ignored: "no_payment_intent" });
        const pi = await retrievePaymentIntent(charge.payment_intent);
        const orderId = pi.metadata?.order_id ?? null;
        const order = orderId && /^[0-9a-f-]{36}$/i.test(orderId) ? await loadPaymentOrder(orderId) : null;
        if (!order || order.payment_provider !== "stripe") return NextResponse.json({ ok: true, ignored: "unknown_order" });
        // the session (with its charge) is authoritative: records PAID first if needed, then (PARTIALLY_)REFUNDED
        const r = await syncPayment(order.id);
        return NextResponse.json({ ok: true, changed: r.changed, payment_status: r.payment_status });
      }

      default:
        return NextResponse.json({ ok: true, ignored: event.type });
    }
  } catch (e) {
    console.error("[stripe webhook] failed", event.type, e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
