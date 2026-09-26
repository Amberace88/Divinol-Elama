"use server";

import { isMontonioConfigured } from "@/lib/payments/montonio";
import { isOnlineMethod, loadPaymentOrder, startPayment, switchToBankTransfer, verifyOrderSignature } from "@/lib/payments/service";

export type RetryResult = { ok: true; paymentUrl: string } | { ok: false; code: "forbidden" | "not_allowed" | "payment_failed" };
export type SwitchResult =
  | { ok: true; number: string; total: number; invoice: string | null }
  | { ok: false; code: "forbidden" | "not_allowed" | "generic" };

/** "Pay again" for an unpaid online order (signed return link required). */
export async function retryPayment(orderId: string, sig: string, method: "montonio_bank" | "montonio_card", locale: string): Promise<RetryResult> {
  if (!isMontonioConfigured() || !verifyOrderSignature(orderId, sig)) return { ok: false, code: "forbidden" };
  if (!isOnlineMethod(method)) return { ok: false, code: "not_allowed" };
  const order = await loadPaymentOrder(orderId).catch(() => null);
  if (!order || order.status === "cancelled" || !isOnlineMethod(order.payment_method) || !["pending", "failed"].includes(order.payment_status)) {
    return { ok: false, code: "not_allowed" };
  }
  try {
    // no preselected bank on a retry — Montonio shows its own bank list
    const paymentUrl = await startPayment(orderId, method, { locale: String(locale).slice(0, 5) });
    return { ok: true, paymentUrl };
  } catch (e) {
    console.error("[checkout] retry payment failed", e);
    return { ok: false, code: "payment_failed" };
  }
}

/** "Pay by bank transfer instead": proforma issued + e-mailed, order stays reserved. */
export async function payByBankTransfer(orderId: string, sig: string): Promise<SwitchResult> {
  if (!isMontonioConfigured() || !verifyOrderSignature(orderId, sig)) return { ok: false, code: "forbidden" };
  try {
    const r = await switchToBankTransfer(orderId);
    return { ok: true, number: r.number, total: Number(r.total_gross), invoice: r.invoice_number };
  } catch (e) {
    const msg = (e as { message?: string })?.message ?? "";
    if (/payment_not_allowed|order_cancelled/.test(msg)) return { ok: false, code: "not_allowed" };
    console.error("[checkout] switch to bank transfer failed", e);
    return { ok: false, code: "generic" };
  }
}
