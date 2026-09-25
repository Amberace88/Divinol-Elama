"use client";

import { useCallback } from "react";
import { useLocale } from "next-intl";
import { formatMoney } from "@/lib/commerce";

/** Locale-aware EUR formatter for client components. */
export function useMoney() {
  const locale = useLocale();
  return useCallback((n: number) => formatMoney(n, locale), [locale]);
}
