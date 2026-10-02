"use server";

import { z } from "zod";
import { PAYMENT_STATUS } from "../labels";
import { ActionError, adminAction, revalidateAdmin, UUID_RE } from "../server";
import { MontonioError } from "@/lib/payments/montonio";
import { StripeError } from "@/lib/payments/stripe";
import { isOnlinePaymentsConfigured, syncPayment } from "@/lib/payments/service";

const id = z.string().regex(UUID_RE, "Nederīgs ID");

/** "Atkārtoti pārbaudīt maksājumu": re-reads the payment from Stripe / Montonio → the same idempotent update as the webhook. */
export async function recheckPayment(orderId: string) {
  return adminAction(
    async () => {
      id.parse(orderId);
      if (!isOnlinePaymentsConfigured()) throw new ActionError("Tiešsaistes maksājumi nav pieslēgti (trūkst vides mainīgo).");
      try {
        const r = await syncPayment(orderId);
        if (!r.found) throw new ActionError("Pasūtījums nav atrasts");
        revalidateAdmin();
        return { provider: r.providerStatus ?? null, changed: r.changed, paymentStatus: r.payment_status ?? null, mismatch: Boolean(r.amount_mismatch) };
      } catch (e) {
        if (e instanceof MontonioError) throw new ActionError(`Montonio: ${e.message}`);
        if (e instanceof StripeError) throw new ActionError(`Stripe: ${e.message}`);
        throw e;
      }
    },
    (d) =>
      d.mismatch
        ? "Summa nesakrīt — skatiet vēsturi"
        : d.changed
          ? `Apmaksas statuss atjaunināts: ${PAYMENT_STATUS[d.paymentStatus ?? ""]?.label ?? d.paymentStatus}`
          : `Maksājuma statuss: ${d.provider ?? "—"} · izmaiņu nav`,
  );
}
