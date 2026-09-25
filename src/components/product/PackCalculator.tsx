"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Calculator, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import type { ProductSummary } from "@/lib/catalog";
import { displayPrice, packLabel, round2 } from "@/lib/commerce";
import { cheapestCombination } from "@/lib/shop/packs";
import { usePricing } from "@/components/providers/PriceProvider";
import { useMoney } from "@/components/ui/useMoney";
import { useAddToCart } from "@/components/catalog/useAddToCart";

export function PackCalculator({ product }: { product: ProductSummary }) {
  const t = useTranslations("product");
  const tu = useTranslations("units");
  const pricing = usePricing();
  const money = useMoney();
  const addToCart = useAddToCart();
  const sized = useMemo(
    () => product.variants.filter((v) => v.size && v.unit !== "pcs").sort((a, b) => Number(a.size) - Number(b.size)),
    [product.variants],
  );
  const unit = sized[0]?.unit === "kg" ? tu("kg") : tu("l");
  const initial = Math.max(1, Math.round(Number(sized[0]?.size ?? 5) * 4));
  const [need, setNeed] = useState<string>(String(Math.min(initial, 50)));
  const amount = Number(need.replace(",", "."));

  const combo = useMemo(
    () =>
      cheapestCombination(
        sized.map((v) => ({ key: v.key, size: Number(v.size), price: displayPrice(v, pricing) })),
        amount,
      ),
    [sized, pricing, amount],
  );

  if (sized.length < 2) return null;

  const addAll = () => {
    if (!combo) return;
    for (const it of combo.items) {
      const v = product.variants.find((x) => x.key === it.key);
      if (v) addToCart(product, v, it.qty, { silent: true });
    }
    toast.success(t("calcAdded"));
  };

  const leftover = combo ? round2(combo.total - amount) : 0;

  return (
    <section aria-labelledby="pack-calc" className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-navy-700 text-brand-400">
          <Calculator className="size-5" aria-hidden />
        </span>
        <h2 id="pack-calc" className="text-[17px] font-extrabold tracking-tight text-ink">
          {t("calcTitle")}
        </h2>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{t("calcText")}</p>
      <label className="label mt-4" htmlFor="calc-need">
        {t("calcNeed")}
      </label>
      <div className="relative">
        <input
          id="calc-need"
          type="number"
          inputMode="decimal"
          min={0.1}
          step={0.5}
          value={need}
          onChange={(e) => setNeed(e.target.value)}
          className="input pr-12 text-lg font-bold tabular-nums"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-bold text-muted">{unit}</span>
      </div>

      <AnimatePresence mode="wait">
        {combo && (
          <motion.div
            key={combo.items.map((i) => `${i.key}x${i.qty}`).join("|")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-4 rounded-2xl bg-canvas p-4"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted">{t("calcBest")}</p>
            <ul className="mt-2 grid gap-1.5">
              {combo.items.map((it) => {
                const v = product.variants.find((x) => x.key === it.key)!;
                return (
                  <li key={it.key} className="flex items-center justify-between text-[14px]">
                    <span className="font-bold text-ink">
                      {it.qty} × {packLabel(v)}
                    </span>
                    <span className="tabular-nums text-ink/70">{money(round2(it.price * it.qty))}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
              <span className="text-[13px] font-bold text-ink">{t("calcTotal")}</span>
              <span className="text-lg font-extrabold tabular-nums text-navy-700">{money(combo.cost)}</span>
            </div>
            {leftover > 0 && (
              <p className="mt-1 text-[12px] text-muted">{t("calcLeftover", { amount: `${String(leftover).replace(".", ",")} ${unit}` })}</p>
            )}
            <button
              type="button"
              onClick={addAll}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-navy-700 text-[14px] font-bold text-white transition hover:bg-navy-600"
            >
              <ShoppingBag className="size-4" aria-hidden />
              {t("calcAddAll")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
