"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Droplets, PiggyBank, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/components/providers/CartProvider";
import { cheapestPacks, referencePack, singlePackCost } from "@/lib/calculators";
import { packLabel } from "@/lib/commerce";
import type { ProductSummary } from "@/lib/catalog";
import { AnimatedNumber } from "../AnimatedNumber";
import { RangeField } from "../RangeField";
import { litrePacks, toCartItem, usePrice } from "../usePrice";
import { BigValue, CalcCard, ResultLabel } from "./CalcCard";
import { ProductPicker } from "./ProductPicker";

export function OilPlanner({ products, defaultSlug }: { products: ProductSummary[]; defaultSlug: string }) {
  const t = useTranslations("calc");
  const locale = useLocale();
  const { price, money, vatLabel } = usePrice();
  const { add } = useCart();
  const [slug, setSlug] = useState(defaultSlug);
  const [capacity, setCapacity] = useState(4.5);
  const [changes, setChanges] = useState(2);

  const product = products.find((p) => p.slug === slug) ?? products[0];
  const variants = useMemo(() => (product ? litrePacks(product).filter((v) => v.price_net > 0) : []), [product]);
  const packs = useMemo(() => variants.map((v) => ({ key: v.key, size: Number(v.size), price: price(v) })), [variants, price]);
  const need = Math.round(capacity * changes * 100) / 100;
  const plan = useMemo(() => cheapestPacks(packs, need), [packs, need]);
  const ref = referencePack(packs);
  const single = ref ? singlePackCost(ref, need) : null;
  const savings = plan && single ? Math.max(0, Math.round((single.total - plan.total) * 100) / 100) : 0;
  const litres = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
  const fillPct = plan && plan.litres > 0 ? (need / plan.litres) * 100 : 0;

  const addAll = () => {
    if (!product || !plan) return;
    for (const line of plan.lines) {
      const v = variants.find((x) => x.key === line.key);
      if (v) add(toCartItem(product, v), line.qty);
    }
    toast.success(t("oil.added"));
  };

  return (
    <CalcCard
      id="oil"
      index={1}
      icon={Droplets}
      title={t("oil.title")}
      text={t("oil.text")}
      inputs={
        <>
          <ProductPicker
            label={t("oil.product")}
            items={products}
            value={product?.slug ?? ""}
            onChange={setSlug}
            searchPlaceholder={t("oil.search")}
            emptyText={t("oil.noProducts")}
          />
          <RangeField label={t("oil.capacity")} value={capacity} onChange={setCapacity} min={1} max={12} step={0.1} hardMax={80} suffix="L" />
          <RangeField label={t("oil.changes")} value={changes} onChange={(n) => setChanges(Math.round(n))} min={1} max={10} step={1} hardMax={50} />
        </>
      }
      result={
        !plan || plan.lines.length === 0 ? (
          <p className="text-white/70">{t("oil.empty")}</p>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <ResultLabel>{t("oil.total")}</ResultLabel>
                <BigValue>
                  <AnimatedNumber value={plan.total} format={money} />
                </BigValue>
                <p className="mt-1.5 text-[12px] text-white/55">{vatLabel}</p>
              </div>
              <div className="text-right">
                <ResultLabel>{t("oil.required")}</ResultLabel>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">{t("liters", { amount: litres(need) })}</p>
              </div>
            </div>

            {/* litres bar: required vs bought */}
            <div className="mt-6">
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300"
                  initial={false}
                  animate={{ width: `${fillPct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
              <p className="mt-2 text-[12.5px] text-white/65">
                {plan.leftover > 0 ? t("oil.leftover", { amount: litres(plan.leftover) }) : t("oil.noLeftover")}
              </p>
            </div>

            <div className="mt-6">
              <ResultLabel>{t("oil.result")}</ResultLabel>
              <ul className="mt-3 grid gap-2">
                <AnimatePresence initial={false} mode="popLayout">
                  {plan.lines.map((l) => (
                    <motion.li
                      key={l.key}
                      layout
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.07] px-4 py-3 ring-1 ring-white/10"
                    >
                      <span className="flex items-center gap-3">
                        <span className="grid h-8 min-w-10 -skew-x-6 place-items-center rounded-md bg-brand-400 px-2 text-sm font-extrabold text-navy-900">
                          <span className="skew-x-6">{l.qty}×</span>
                        </span>
                        <span className="font-bold">{packLabel({ size: l.size, unit: "l" })}</span>
                      </span>
                      <span className="font-bold tabular-nums text-white/90">{money(l.qty * l.price)}</span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>

            {ref && (
              <p className="mt-5 flex items-start gap-2 text-[13px] leading-5 text-white/75">
                <PiggyBank className="mt-0.5 size-4 shrink-0 text-brand-400" aria-hidden />
                {savings > 0
                  ? t("oil.vsSmall", { pack: packLabel({ size: ref.size, unit: "l" }), amount: money(savings) })
                  : t("oil.noSavings", { pack: packLabel({ size: ref.size, unit: "l" }) })}
              </p>
            )}

            <Button className="mt-7 w-full" size="lg" onClick={addAll}>
              <ShoppingCart className="size-4" aria-hidden />
              {t("oil.addAll")}
            </Button>
          </div>
        )
      }
    />
  );
}
