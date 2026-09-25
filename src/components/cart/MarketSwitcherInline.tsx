"use client";

import { useTranslations } from "next-intl";
import { MARKETS } from "@/lib/commerce";
import { usePricing } from "@/components/providers/PriceProvider";
import { cn } from "@/lib/utils";
import { Flag } from "@/components/ui/Flag";

/** Segmented control for the delivery country (affects VAT and shipping). */
export function MarketSwitcherInline({ className }: { className?: string }) {
  const t = useTranslations("market");
  const { market, setMarket } = usePricing();
  return (
    <div className={className}>
      <p className="label">{t("label")}</p>
      <div role="radiogroup" aria-label={t("label")} className="grid grid-cols-3 gap-1 rounded-xl bg-canvas p-1 ring-1 ring-line">
        {MARKETS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={m === market}
            onClick={() => setMarket(m)}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-2 rounded-lg text-[13px] font-bold transition",
              m === market ? "bg-surface text-navy-700 shadow-card ring-1 ring-line" : "text-muted hover:text-ink",
            )}
          >
            <Flag code={m} />
            {t(m)}
          </button>
        ))}
      </div>
    </div>
  );
}
