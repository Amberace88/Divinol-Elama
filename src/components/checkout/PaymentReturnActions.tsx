"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CreditCard, Landmark, LoaderCircle, RefreshCw, RotateCcw, FileText } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";
import { payByBankTransfer, retryPayment } from "@/app/[locale]/checkout/return/actions";

type Method = "montonio_bank" | "montonio_card";

/** Return page actions for an unpaid online order: pay again (same / other method), bank transfer, re-check. */
export function PaymentReturnActions({ orderId, sig, method, pending }: { orderId: string; sig: string; method: Method; pending: boolean }) {
  const t = useTranslations("checkout.paymentReturn");
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const other: Method = method === "montonio_bank" ? "montonio_card" : "montonio_bank";

  const pay = (m: Method) => {
    setBusy(m);
    start(async () => {
      const res = await retryPayment(orderId, sig, m, locale);
      if (res.ok) {
        window.location.assign(res.paymentUrl);
        return;
      }
      setBusy(null);
      toast.error(t(`errors.${res.code}`));
      if (res.code === "not_allowed") router.refresh();
    });
  };

  const transfer = () => {
    setBusy("transfer");
    start(async () => {
      const res = await payByBankTransfer(orderId, sig);
      if (res.ok) {
        router.push({
          pathname: "/checkout/success",
          query: { n: res.number, t: res.total.toFixed(2), p: "bank_transfer", ...(res.invoice ? { inv: res.invoice } : {}) },
        });
        return;
      }
      setBusy(null);
      toast.error(t(`errors.${res.code}`));
      if (res.code === "not_allowed") router.refresh();
    });
  };

  const spin = <LoaderCircle className="size-5 animate-spin" aria-hidden />;
  const disabled = busy !== null;

  return (
    <div className="grid gap-3">
      <button type="button" className={buttonClass("primary", "lg", "w-full")} disabled={disabled} onClick={() => pay(method)}>
        {busy === method ? spin : <RotateCcw className="size-5" aria-hidden />}
        {t("retry")}
      </button>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <button type="button" className={buttonClass("outline", "md", "w-full")} disabled={disabled} onClick={() => pay(other)}>
          {busy === other ? spin : other === "montonio_card" ? <CreditCard className="size-4" aria-hidden /> : <Landmark className="size-4" aria-hidden />}
          {t(other === "montonio_card" ? "payByCard" : "payByBank")}
        </button>
        <button type="button" className={buttonClass("outline", "md", "w-full")} disabled={disabled} onClick={transfer}>
          {busy === "transfer" ? spin : <FileText className="size-4" aria-hidden />}
          {t("payByTransfer")}
        </button>
      </div>
      {pending && (
        <button
          type="button"
          className="mx-auto mt-1 inline-flex items-center gap-1.5 text-[13px] font-bold text-navy-600 underline-offset-2 hover:underline disabled:opacity-50"
          disabled={disabled}
          onClick={() => {
            setBusy("refresh");
            router.refresh();
            window.setTimeout(() => setBusy(null), 1500);
          }}
        >
          <RefreshCw className={busy === "refresh" ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden />
          {t("recheck")}
        </button>
      )}
      <p className="text-[12px] text-muted">{t("transferHint")}</p>
    </div>
  );
}
