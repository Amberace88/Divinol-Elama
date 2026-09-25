"use client";

import { useTranslations } from "next-intl";
import { useMoney } from "@/components/ui/useMoney";
import type { useCartSummary } from "./useCartSummary";

type Summary = ReturnType<typeof useCartSummary>;

/** Subtotal block: B2C shows gross with included VAT, B2B shows net + VAT + total. */
export function CartTotals({ s }: { s: Summary }) {
  const t = useTranslations("cart");
  const money = useMoney();
  const gross = s.totals.total;
  return (
    <dl className="grid gap-1.5 text-[14px]">
      {s.b2b ? (
        <>
          <div className="flex justify-between text-ink/75">
            <dt>{t("net")}</dt>
            <dd className="tabular-nums">{money(s.totals.subtotalNet)}</dd>
          </div>
          <div className="flex justify-between text-ink/75">
            <dt>{t("vat", { rate: s.vatRate })}</dt>
            <dd className="tabular-nums">{money(s.totals.vat)}</dd>
          </div>
        </>
      ) : null}
      <div className="flex items-baseline justify-between pt-1">
        <dt className="text-[15px] font-bold text-ink">{t("subtotal")}</dt>
        <dd className="text-xl font-extrabold tabular-nums text-navy-700">{money(gross)}</dd>
      </div>
      {!s.b2b && (
        <div className="-mt-1 flex justify-between text-[12px] text-muted">
          <dt>{t("vatIncluded", { rate: s.vatRate })}</dt>
          <dd className="tabular-nums">{money(s.totals.vat)}</dd>
        </div>
      )}
    </dl>
  );
}
