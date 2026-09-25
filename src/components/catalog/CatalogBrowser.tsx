"use client";

import { Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { MessageCircle, Search, SlidersHorizontal, X } from "lucide-react";
import type { ProductSummary } from "@/lib/catalog";
import { Link } from "@/i18n/navigation";
import { usePricing } from "@/components/providers/PriceProvider";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { ProductCard } from "./ProductCard";
import { FilterPanel, type CategoryLink } from "./FilterPanel";
import {
  EMPTY_FILTERS,
  SORTS,
  activeCount,
  applyFilters,
  buildFacets,
  parseFilters,
  serializeFilters,
  type Filters,
  type SortKey,
} from "./filters";

type Props = {
  products: ProductSummary[];
  categories: CategoryLink[];
  activeCategory?: string;
  totalCount: number;
};

/**
 * Client catalog with filters synced to the URL query. The server-prerendered HTML (Suspense fallback)
 * contains the full, unfiltered grid so every product link is crawlable.
 */
export function CatalogBrowser(props: Props) {
  return (
    <Suspense fallback={<Browser {...props} qs="" />}>
      <WithSearchParams {...props} />
    </Suspense>
  );
}

function WithSearchParams(props: Props) {
  const qs = useSearchParams().toString();
  return <Browser {...props} qs={qs} />;
}

const SORT_LABEL: Record<SortKey, string> = {
  popular: "sortPopular",
  "price-asc": "sortPriceAsc",
  "price-desc": "sortPriceDesc",
  name: "sortName",
};

function Browser({ products, categories, activeCategory, qs }: Props & { qs: string }) {
  const t = useTranslations("catalog");
  const tu = useTranslations("units");
  const pricing = usePricing();
  const [filters, setFilters] = useState<Filters>(() => parseFilters(qs));
  const [seenQs, setSeenQs] = useState(qs);
  const [written, setWritten] = useState<string[]>([]);
  const [drawer, setDrawer] = useState(false);

  // External navigation (e.g. header search → ?q=) replaces the state; our own URL writes are ignored.
  if (qs !== seenQs) {
    setSeenQs(qs);
    if (!written.includes(qs)) {
      setFilters(parseFilters(qs));
      setWritten([]);
    }
  }

  const commit = (next: Filters) => {
    const s = serializeFilters(next);
    setFilters(next);
    setWritten((w) => [...w.slice(-30), s]);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
  };
  const update = (patch: Partial<Filters>) => commit({ ...filters, ...patch });
  const toggle = (key: "sae" | "iso" | "spec" | "pack", value: string) => {
    const cur = filters[key];
    commit({ ...filters, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] });
  };

  const clear = () => update({ ...EMPTY_FILTERS, sort: filters.sort });

  const facets = useMemo(() => buildFacets(products, tu("pcs")), [products, tu]);
  const deferred = useDeferredValue(filters);
  const results = useMemo(
    () => applyFilters(products, deferred, { market: pricing.market, b2b: pricing.b2b, discountPercent: pricing.discountPercent }),
    [products, deferred, pricing.market, pricing.b2b, pricing.discountPercent],
  );
  const nActive = activeCount(filters);

  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [drawer]);

  const chips: { label: string; onRemove: () => void }[] = [
    ...(filters.q.trim() ? [{ label: `“${filters.q.trim()}”`, onRemove: () => update({ q: "" }) }] : []),
    ...filters.sae.map((v) => ({ label: v, onRemove: () => toggle("sae", v) })),
    ...filters.iso.map((v) => ({ label: v, onRemove: () => toggle("iso", v) })),
    ...filters.spec.map((v) => ({ label: v, onRemove: () => toggle("spec", v) })),
    ...filters.pack.map((v) => ({
      label: facets.packs.find((p) => p.key === v)?.label ?? v,
      onRemove: () => toggle("pack", v),
    })),
    ...(filters.approval.trim() ? [{ label: filters.approval.trim(), onRemove: () => update({ approval: "" }) }] : []),
    ...(filters.stock ? [{ label: t("inStockOnly"), onRemove: () => update({ stock: false }) }] : []),
  ];

  const panel = (
    <FilterPanel
      filters={filters}
      facets={facets}
      categories={categories}
      activeCategory={activeCategory}
      query={serializeFilters(filters)}
      onToggle={toggle}
      onUpdate={update}
    />
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] xl:gap-10">
      <aside className="hidden lg:block" aria-label={t("filters")}>
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain pb-6 pr-2 [scrollbar-width:thin]">
          {panel}
        </div>
      </aside>

      <div className="min-w-0">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-0 flex-1 basis-full sm:basis-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder={t("search")}
              aria-label={t("search")}
              className="input pl-10"
              enterKeyHint="search"
            />
          </div>
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[14px] font-bold text-navy-700 shadow-card lg:hidden"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            {t("filters")}
            {nActive > 0 && (
              <span className="grid size-5 place-items-center rounded-full bg-brand-400 text-[11px] font-extrabold text-navy-900">{nActive}</span>
            )}
          </button>
          <label className="relative ml-auto inline-flex h-11 items-center">
            <span className="sr-only">{t("sort")}</span>
            <select
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value as SortKey })}
              className="h-11 appearance-none rounded-xl border border-line bg-surface pl-3.5 pr-9 text-[14px] font-semibold text-ink shadow-card outline-none focus:border-navy-400 focus:ring-4 focus:ring-navy-100"
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t(SORT_LABEL[s])}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="pointer-events-none absolute right-3 size-4 rotate-90 text-muted" aria-hidden />
          </label>
        </div>

        <div className="mt-4 flex min-h-8 flex-wrap items-center gap-2">
          <p className="mr-2 text-[14px] font-bold text-ink" aria-live="polite">
            {t("results", { count: results.length })}
          </p>
          <AnimatePresence initial={false}>
            {chips.map((c) => (
              <motion.button
                key={c.label}
                type="button"
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                onClick={c.onRemove}
                className="inline-flex max-w-64 items-center gap-1.5 rounded-full bg-navy-700 py-1 pl-3 pr-2 text-[12px] font-bold text-white transition hover:bg-navy-600"
              >
                <span className="truncate">{c.label}</span>
                <X className="size-3.5 shrink-0 text-brand-300" aria-hidden />
              </motion.button>
            ))}
          </AnimatePresence>
          {nActive > 0 && (
            <button type="button" onClick={clear} className="text-[12.5px] font-bold text-navy-500 underline-offset-2 hover:underline">
              {t("clearFilters")}
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex flex-col items-center rounded-3xl border border-dashed border-navy-200 bg-canvas px-6 py-16 text-center"
          >
            <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-surface text-navy-400 shadow-card">
              <Search className="size-6" aria-hidden />
            </span>
            <p className="text-lg font-extrabold text-ink">{t("noResults")}</p>
            <p className="mt-1.5 max-w-md text-[14px] text-muted">{t("noResultsHint")}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={clear} className={buttonClass("dark", "md")}>
                {t("clearFilters")}
              </button>
              <Link href="/contact" className={buttonClass("outline", "md")}>
                <MessageCircle className="size-4" aria-hidden />
                {t("askExpert")}
              </Link>
            </div>
          </motion.div>
        ) : (
          <LayoutGroup>
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:gap-5">
              <AnimatePresence mode="popLayout" initial={false}>
                {results.map((p, i) => (
                  <motion.li
                    key={p.slug}
                    layout="position"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  >
                    <ProductCard product={p} priority={i < 3} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </LayoutGroup>
        )}
      </div>

      {/* mobile filter drawer */}
      <AnimatePresence>
        {drawer && (
          <div className="fixed inset-0 z-[85] lg:hidden">
            <motion.div
              aria-hidden
              className="absolute inset-0 bg-navy-950/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t("filters")}
              className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl bg-surface"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
            >
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <p className="text-lg font-extrabold">{t("filters")}</p>
                <button
                  type="button"
                  onClick={() => setDrawer(false)}
                  aria-label={t("closeFilters")}
                  className="grid size-10 place-items-center rounded-xl text-muted hover:bg-canvas"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{panel}</div>
              <div className="flex gap-2 border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {nActive > 0 && (
                  <button type="button" onClick={clear} className={buttonClass("outline", "lg", "flex-1")}>
                    {t("clearFilters")}
                  </button>
                )}
                <button type="button" onClick={() => setDrawer(false)} className={buttonClass("primary", "lg", cn("flex-[2]"))}>
                  {t("apply")} ({results.length})
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
