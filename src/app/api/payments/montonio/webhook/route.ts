import { NextResponse, type NextRequest } from "next/server";
import { isMontonioConfigured, verifyToken, type MontonioOrderToken, type MontonioRefundToken } from "@/lib/payments/montonio";
import { applyPaymentStatus, findOrderByNumber, findOrderByPaymentRef, syncPayment } from "@/lib/payments/service";

/**
 * Montonio webhook (our `notificationUrl`, sent with every order — nothing to configure in the Partner System).
 * https://docs.montonio.com/api/stargate/guides/webhooks
 *   body { orderToken } | { refundToken } — HS256 JWTs signed with our Secret Key (verified, incl. accessKey).
 *   Must answer 200/201, otherwise Montonio retries (13× over 48 h). Handling is idempotent
 *   (payment_apply_status(), migration 0011), so duplicates / retries / out-of-order deliveries are safe.
 * We answer 200 for tokens we cannot use (unknown order) so Montonio stops retrying, 400 for forged tokens and
 * 500 only for our own transient failures (DB), which Montonio then retries.
 */
export const dynamic = "force-dynamic";

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") ?? "";
  const text = (await req.text()).slice(0, 20_000);
  if (type.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(text));
  try {
    const j = JSON.parse(text) as unknown;
    return j && typeof j === "object" ? (j as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  if (!isMontonioConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const body = await readBody(req);

  try {
    if (typeof body.orderToken === "string") {
      const t = verifyToken<MontonioOrderToken>(body.orderToken);
      if (!t || !t.merchantReference || !t.paymentStatus) return NextResponse.json({ error: "invalid_token" }, { status: 400 });
      const order = await findOrderByNumber(String(t.merchantReference));
      if (!order) {
        console.warn("[montonio webhook] unknown merchantReference", t.merchantReference);
        return NextResponse.json({ ok: true, ignored: "unknown_order" });
      }
      const r = await applyPaymentStatus(order.id, {
        ref: t.uuid ?? null,
        status: String(t.paymentStatus),
        amount: t.grandTotal == null ? null : Number(t.grandTotal),
        currency: t.currency ?? null,
        meta: {
          provider_name: t.paymentProviderName,
          sender_name: t.senderName,
          payment_method_type: t.paymentMethod,
        },
      });
      return NextResponse.json({ ok: true, changed: r.changed, payment_status: r.payment_status });
    }

    if (typeof body.refundToken === "string") {
      const t = verifyToken<MontonioRefundToken>(body.refundToken);
      if (!t || !t.orderUuid) return NextResponse.json({ error: "invalid_token" }, { status: 400 });
      const order = await findOrderByPaymentRef(String(t.orderUuid));
      if (!order) return NextResponse.json({ ok: true, ignored: "unknown_order" });
      // the order's paymentStatus (REFUNDED / PARTIALLY_REFUNDED) is authoritative → re-read it from Montonio
      const r = await syncPayment(order.id);
      return NextResponse.json({ ok: true, changed: r.changed, payment_status: r.payment_status });
    }
  } catch (e) {
    console.error("[montonio webhook] failed", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({ error: "invalid_body" }, { status: 400 });
}
