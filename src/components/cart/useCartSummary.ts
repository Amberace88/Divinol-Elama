"use client";

import { useMemo } from "react";
import { displayPrice, round2 } from "@/lib/commerce";
import { computeTotals } from "@/lib/shop/totals";
import { isFreightItem } from "@/lib/shop/shipping";
import { useCart } from "@/components/providers/CartProvider";
import { usePricing } from "@/components/providers/PriceProvider";
import { useSettings } from "@/components/providers/SettingsProvider";

/** Everything the cart UIs need: per-line display prices, totals, free-shipping progress. */
export function useCartSummary() {
  const cart = useCart();
  const pricing = usePricing();
  const settings = useSettings();
  const vatRate = settings.vat?.[pricing.market] ?? 21;
  return useMemo(() => {
    const ctx = { market: pricing.market, b2b: pricing.b2b, discountPercent: pricing.discountPercent };
    const lines = cart.items.map((it) => {
      const unit = displayPrice(it, ctx);
      return { item: it, unit, total: round2(unit * it.qty) };
    });
    const totals = computeTotals(cart.items, ctx, vatRate);
    const threshold = settings.shipping.free_threshold?.[pricing.market] ?? null;
    const left = threshold != null ? Math.max(0, round2(threshold - totals.subtotalGross)) : null;
    const progress = threshold ? Math.min(1, totals.subtotalGross / threshold) : 0;
    const hasFreight = cart.items.some(isFreightItem);
    return { ...cart, ctx, lines, totals, vatRate, threshold, left, progress, hasFreight, b2b: pricing.b2b, discount: pricing.discountPercent };
  }, [cart, pricing.market, pricing.b2b, pricing.discountPercent, settings.shipping, vatRate]);
}
