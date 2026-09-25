"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { displayPrice, packLabel } from "@/lib/commerce";
import { usePricing } from "@/components/providers/PriceProvider";
import { useMoney } from "@/components/ui/useMoney";
import type { ProductSummary } from "@/lib/catalog";
import type { CartItem } from "@/components/providers/CartProvider";

export type SummaryVariant = ProductSummary["variants"][number];

/** Visitor-facing price helpers (market VAT / B2B net + discount). */
export function usePrice() {
  const { market, b2b, discountPercent } = usePricing();
  const money = useMoney();
  const t = useTranslations("price");
  const ctx = useMemo(() => ({ market, b2b, discountPercent }), [market, b2b, discountPercent]);
  const price = useCallback((v: Pick<SummaryVariant, "price_net">) => displayPrice(v, ctx), [ctx]);
  return { price, money, ctx, vatLabel: b2b ? t("vatExcl") : t("vatIncl") };
}

export function toCartItem(p: Pick<ProductSummary, "slug" | "name" | "image">, v: SummaryVariant): Omit<CartItem, "qty"> {
  return {
    slug: p.slug,
    key: v.key,
    sku: v.sku,
    name: p.name,
    pack: packLabel(v),
    image: v.image ?? p.image,
    size: v.size,
    unit: v.unit,
    price_net: v.price_net,
  };
}

/** Litre packs of a product, smallest first. */
export function litrePacks(p: Pick<ProductSummary, "variants">) {
  return p.variants.filter((v) => v.unit === "l" && v.size && v.size > 0).sort((a, b) => Number(a.size) - Number(b.size));
}
