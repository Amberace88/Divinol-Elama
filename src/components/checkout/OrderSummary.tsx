"use client";

import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { CartItem } from "@/components/providers/CartProvider";
import { ProductImage } from "@/components/ui/ProductImage";
import { useMoney } from "@/components/ui/useMoney";

export type SummaryTotals = {
  b2b: boolean;
  discount: number;
  vatRate: number;
  reverse: boolean;
  subtotalNet: number;
  shippingNet: number | null; // null = not chosen / on request
  shippingLabel: string | null; // e.g. "Bezmaksas" / "Pēc vienošanās"
  vat: number;
  total: number;
};

export function OrderSummary({
  lines,
  totals: s,
  compact,
}: {
  lines: { item: CartItem; total: number }[];
  totals: SummaryTotals;
  compact?: boolean;
}) {
  const t = useTranslations("checkout");
  const tu = useTranslations("units");
  const money = useMoney();
  const g = (net: number) => (s.b2b || s.reverse ? net : Math.round(net * (1 + s.vatRate / 100) * 100) / 100);

  return (
    <div>
      {!compact && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">{t("summary")}</h2>
          <Link href="/cart" className="inline-flex items-center gap-1 text-[13px] font-bold text-navy-600 hover:text-navy-800">
            <Pencil className="size-3.5" aria-hidden />
            {t("editCart")}
          </Link>
        </div>
      )}
      <ul className="-mx-1 max-h-[340px] divide-y divide-line overflow-y-auto px-1">
        {lines.map(({ item, total }) => (
          <li key={`${item.slug}:${item.key}`} className="flex items-center gap-3 py-3">
            <div className="relative shrink-0">
              <ProductImage src={item.image} alt="" sizes="56px" className="size-14 rounded-xl border border-line" imgClassName="p-1" />
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-navy-700 px-1 text-[11px] font-extrabold text-white">
                {item.qty}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[13px] font-bold leading-snug text-ink">{item.name}</p>
              <p className="text-[12px] text-muted">{item.pack || tu("piece")}</p>
            </div>
            <p className="shrink-0 text-[13.5px] font-bold tabular-nums text-ink">{money(total)}</p>
          </li>
        ))}
      </ul>
      <dl className="mt-3 grid gap-2 border-t border-line pt-4 text-[14px]">
        {s.b2b && s.discount > 0 && (
          <p className="mb-1 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] font-bold text-emerald-700">{t("b2bPrices", { percent: s.discount })}</p>
        )}
        <div className="flex justify-between text-ink/75">
          <dt>{s.b2b || s.reverse ? t("subtotalNet") : t("subtotal")}</dt>
          <dd className="tabular-nums">{money(g(s.subtotalNet))}</dd>
        </div>
        <div className="flex justify-between text-ink/75">
          <dt>{t("shipping")}</dt>
          <dd className="tabular-nums">
            {s.shippingLabel ?? (s.shippingNet == null ? <span className="text-muted">{t("shippingChoose")}</span> : money(g(s.shippingNet)))}
          </dd>
        </div>
        {(s.b2b || s.reverse) && (
          <div className="flex justify-between text-ink/75">
            <dt>{t("vat", { rate: s.reverse ? 0 : s.vatRate })}</dt>
            <dd className="tabular-nums">{money(s.vat)}</dd>
          </div>
        )}
        <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3">
          <dt className="text-[15px] font-extrabold text-ink">{t("total")}</dt>
          <dd className="text-2xl font-extrabold tabular-nums tracking-tight text-navy-700">{money(s.total)}</dd>
        </div>
        {!s.b2b && !s.reverse && (
          <div className="-mt-1 flex justify-between text-[12px] text-muted">
            <dt>{t("vat", { rate: s.vatRate })}</dt>
            <dd className="tabular-nums">{money(s.vat)}</dd>
          </div>
        )}
        {s.reverse && <p className="rounded-lg bg-canvas px-3 py-2 text-[12px] leading-relaxed text-muted">{t("reverseCharge")}</p>}
      </dl>
    </div>
  );
}
