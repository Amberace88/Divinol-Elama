import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CircleAlert, Clock3, CreditCard, Landmark, XCircle } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { redirect } from "@/i18n/navigation";
import { formatMoney } from "@/lib/commerce";
import { getStoreSettings } from "@/lib/settings";
import { isMontonioConfigured, verifyToken } from "@/lib/payments/montonio";
import {
  applyPaymentStatus,
  finalInvoiceOf,
  isOnlineMethod,
  loadPaymentOrder,
  syncPayment,
  verifyOrderSignature,
  type PaymentOrderRow,
} from "@/lib/payments/service";
import { CopyValue, SuccessActions, SuccessBadge } from "@/components/checkout/SuccessExtras";
import { PaymentReturnActions } from "@/components/checkout/PaymentReturnActions";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout.paymentReturn" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

type View = "paid" | "pending" | "failed" | "cancelled" | "invalid";

/**
 * Montonio redirects the customer here: /checkout/return?o=<order id>&s=<signature>&order-token=<JWT>.
 * The link is HMAC-signed by us (guests have no session). The status shown comes from our DB after syncing it
 * with Montonio (GET /orders/:uuid) — the webhook usually got there first; both paths are idempotent.
 */
export default async function PaymentReturnPage({ params, searchParams }: Props) {
  const { locale: l } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const sp = await searchParams;
  const orderId = one(sp.o)?.slice(0, 40) ?? "";
  // the signature has a fixed length — tolerate a gateway that appends "?order-token=…" to a URL that already has a query
  const rawSig = one(sp.s) ?? "";
  const sig = rawSig.slice(0, 32);
  const token = one(sp["order-token"]) ?? (rawSig.includes("order-token=") ? rawSig.split("order-token=")[1] : null);

  const [t, tp, settings] = await Promise.all([getTranslations("checkout.paymentReturn"), getTranslations("checkout.payments"), getStoreSettings()]);
  const c = settings.company;

  let order: PaymentOrderRow | null = null;
  if (isMontonioConfigured() && verifyOrderSignature(orderId, sig)) {
    order = await loadPaymentOrder(orderId).catch(() => null);
    if (order && order.payment_provider === "montonio" && ["pending", "failed"].includes(order.payment_status)) {
      try {
        await syncPayment(order.id);
      } catch (e) {
        console.error("[payment return] Montonio sync failed", e);
        // API unreachable: fall back to the signed order-token Montonio appended to the return URL
        const decoded = verifyToken(token);
        if (decoded && decoded.merchantReference === order.number) {
          await applyPaymentStatus(order.id, {
            ref: decoded.uuid ?? null,
            status: decoded.paymentStatus,
            amount: decoded.grandTotal == null ? null : Number(decoded.grandTotal),
            currency: decoded.currency ?? null,
            meta: { provider_name: decoded.paymentProviderName, sender_name: decoded.senderName, payment_method_type: decoded.paymentMethod },
          }).catch((err) => console.error("[payment return] apply token failed", err));
        }
      }
      order = (await loadPaymentOrder(order.id).catch(() => null)) ?? order;
    }
  }

  // customer already switched to bank transfer (e.g. in another tab) → the regular "thank you" page
  if (order && order.payment_method === "bank_transfer" && order.status !== "cancelled") {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { data } = await createServiceClient()
      .from("invoices")
      .select("number")
      .eq("order_id", order.id)
      .eq("type", "proforma")
      .neq("status", "void")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ number: string }>();
    redirect({
      href: {
        pathname: "/checkout/success",
        query: { n: order.number, t: Number(order.total_gross).toFixed(2), p: "bank_transfer", ...(data?.number ? { inv: data.number } : {}) },
      },
      locale,
    });
  }

  const view: View = !order
    ? "invalid"
    : ["paid", "refunded", "partially_refunded"].includes(order.payment_status)
      ? "paid"
      : order.status === "cancelled"
        ? "cancelled"
        : order.payment_status === "failed"
          ? "failed"
          : "pending";

  const total = order ? Number(order.total_gross) : null;
  const invoice = order && view === "paid" ? await finalInvoiceOf(order.id).catch(() => null) : null;
  const method = order && isOnlineMethod(order.payment_method) ? order.payment_method : null;
  const bankName = typeof order?.payment_meta?.provider_name === "string" ? (order.payment_meta.provider_name as string) : null;

  const icon =
    view === "paid" ? null : view === "pending" ? (
      <Clock3 className="size-10" strokeWidth={2.5} aria-hidden />
    ) : view === "invalid" ? (
      <CircleAlert className="size-10" strokeWidth={2.5} aria-hidden />
    ) : (
      <XCircle className="size-10" strokeWidth={2.5} aria-hidden />
    );

  return (
    <div className="relative overflow-hidden bg-canvas">
      <div aria-hidden className="absolute inset-x-0 top-0 h-72 bg-navy-700">
        <div className="absolute inset-0 grid-bg" />
      </div>
      <div className="container-x relative pb-20 pt-12 sm:pt-16">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-line bg-surface p-6 text-center shadow-lift sm:p-10">
          {view === "paid" ? (
            <SuccessBadge />
          ) : (
            <span
              className={cn(
                "mx-auto grid size-20 place-items-center rounded-3xl text-white",
                view === "pending"
                  ? "bg-brand-500 shadow-[0_20px_40px_-12px_rgb(240_174_0/0.55)]"
                  : view === "invalid"
                    ? "bg-slate-500 shadow-[0_20px_40px_-12px_rgb(100_116_139/0.55)]"
                    : "bg-red-500 shadow-[0_20px_40px_-12px_rgb(239_68_68/0.5)]",
              )}
            >
              {icon}
            </span>
          )}
          <h1 className="h-display mt-6 text-3xl text-ink sm:text-4xl">{t(`${view}.title`)}</h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">{t(`${view}.text`, { number: order?.number ?? "" })}</p>

          {order && (
            <dl className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-line text-left ring-1 ring-line sm:grid-cols-3">
              <div className="bg-surface p-4">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">{t("orderNumber")}</dt>
                <dd className="mt-1 flex items-center justify-between gap-2 font-mono text-[15px] font-bold text-ink">
                  {order.number}
                  <CopyValue value={order.number} />
                </dd>
              </div>
              <div className="bg-surface p-4">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">{t("total")}</dt>
                <dd className="mt-1 text-[17px] font-extrabold tabular-nums text-navy-700">{total != null ? formatMoney(total, locale) : "—"}</dd>
              </div>
              <div className="bg-surface p-4">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">{t("payment")}</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-[14px] font-bold text-ink">
                  {method === "montonio_card" ? <CreditCard className="size-4 text-navy-500" aria-hidden /> : <Landmark className="size-4 text-navy-500" aria-hidden />}
                  {method ? tp(method) : "—"}
                </dd>
                {bankName && view === "paid" && <dd className="text-[12px] text-muted">{bankName}</dd>}
              </div>
              {invoice && (
                <div className="bg-surface p-4 sm:col-span-3">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">{t("invoice")}</dt>
                  <dd className="mt-1 font-mono text-[14px] font-bold text-ink">{invoice}</dd>
                </div>
              )}
            </dl>
          )}

          {view === "paid" && (
            <ol className="mt-8 grid gap-3 text-left">
              {([1, 2, 3] as const).map((i) => (
                <li key={i} className="flex gap-3.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy-700 text-[13px] font-extrabold text-brand-400">{i}</span>
                  <p className="pt-0.5 text-[14.5px] leading-relaxed text-ink/85">{t(`paid.step${i}`, { number: order?.number ?? "", invoice: invoice ?? "" })}</p>
                </li>
              ))}
            </ol>
          )}

          {order && (view === "pending" || view === "failed") && method && (
            <div className="mt-8">
              <PaymentReturnActions orderId={order.id} sig={sig} method={method} pending={view === "pending"} />
            </div>
          )}

          <p className="mt-8 text-[13px] text-muted">{t("questions", { email: c.email, phone: c.phone })}</p>
          {(view === "paid" || view === "cancelled" || view === "invalid") && (
            <div className="mt-6">
              <SuccessActions />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
