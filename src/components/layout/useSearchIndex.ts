"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import type { SearchDoc } from "@/lib/shop/search";

const cache = new Map<string, Promise<SearchDoc[]>>();

function load(locale: string) {
  let p = cache.get(locale);
  if (!p) {
    p = fetch(`/api/search-index?locale=${locale}`)
      .then((r) => (r.ok ? (r.json() as Promise<SearchDoc[]>) : []))
      .catch(() => {
        cache.delete(locale);
        return [];
      });
    cache.set(locale, p);
  }
  return p;
}

/** Lazily loads the product search index once per locale (shared by all consumers). */
export function useSearchIndex(enabled: boolean) {
  const locale = useLocale();
  const [docs, setDocs] = useState<SearchDoc[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    load(locale).then((d) => active && setDocs(d));
    return () => {
      active = false;
    };
  }, [enabled, locale]);
  const prefetch = useCallback(() => void load(locale), [locale]);
  return { docs, loading: enabled && docs === null, prefetch };
}
