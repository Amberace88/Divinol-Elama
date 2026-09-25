"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ProductSummary } from "@/lib/catalog";
import { packLabel } from "@/lib/commerce";
import { useCart } from "@/components/providers/CartProvider";

type V = ProductSummary["variants"][number];

/** Adds a product variant to the cart (opens the drawer) and confirms with a toast. */
export function useAddToCart() {
  const { add } = useCart();
  const t = useTranslations("catalog");
  const tu = useTranslations("units");
  return useCallback(
    (p: Pick<ProductSummary, "slug" | "name" | "image">, v: V, qty = 1, opts?: { silent?: boolean }) => {
      const pack = packLabel(v) || tu("piece");
      add(
        {
          slug: p.slug,
          key: v.key,
          sku: v.sku,
          name: p.name,
          pack,
          image: v.image ?? p.image,
          size: v.size,
          unit: v.unit,
          price_net: v.price_net,
        },
        qty,
      );
      if (!opts?.silent) toast.success(t("addedToast", { name: p.name, pack }));
    },
    [add, t, tu],
  );
}

/** Smallest in-stock pack (falls back to the smallest pack). */
export function defaultVariant(p: ProductSummary): V | undefined {
  const bySize = [...p.variants].sort((a, b) => Number(a.size ?? 0) - Number(b.size ?? 0));
  return bySize.find((v) => v.in_stock) ?? bySize[0];
}
