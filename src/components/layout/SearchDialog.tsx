"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowRight, CornerDownLeft, LoaderCircle, Search, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { displayPrice } from "@/lib/commerce";
import { searchDocs } from "@/lib/shop/search";
import { usePricing } from "@/components/providers/PriceProvider";
import { ProductImage } from "@/components/ui/ProductImage";
import { useMoney } from "@/components/ui/useMoney";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { cn } from "@/lib/utils";
import { useSearchIndex } from "./useSearchIndex";
import { POPULAR_SEARCHES, type HeaderCategory } from "./nav";

export function SearchDialog({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: HeaderCategory[];
}) {
  return (
    <AnimatePresence>
      {open && <SearchPanel key="search" onClose={onClose} categories={categories} />}
    </AnimatePresence>
  );
}

function SearchPanel({ onClose, categories }: { onClose: () => void; categories: HeaderCategory[] }) {
  const t = useTranslations("header");
  const tc = useTranslations("a11y");
  const router = useRouter();
  const pricing = usePricing();
  const money = useMoney();
  const { docs, loading } = useSearchIndex(true);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => (docs ? searchDocs(docs, q, 8) : []), [docs, q]);
  const catName = useMemo(() => Object.fromEntries(categories.map((c) => [c.slug, c.name])), [categories]);

  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const goAll = () => {
    onClose();
    router.push({ pathname: "/catalog", query: q.trim() ? { q: q.trim() } : {} });
  };
  const goProduct = (slug: string) => {
    onClose();
    router.push({ pathname: "/product/[slug]", params: { slug } });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) goProduct(results[active].slug);
      else if (q.trim()) goAll();
    }
  };

  const showResults = q.trim().length > 0;

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-start justify-center px-3 pt-[8vh] sm:px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onKeyDown={onKeyDown}
    >
      <div aria-hidden className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={t("searchTitle")}
        initial={{ opacity: 0, y: -16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_40px_80px_-20px_rgb(0_0_0/0.5)] ring-1 ring-black/5"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 sm:px-5">
          {loading ? (
            <LoaderCircle className="size-5 shrink-0 animate-spin text-navy-400" aria-hidden />
          ) : (
            <Search className="size-5 shrink-0 text-navy-400" aria-hidden />
          )}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            role="combobox"
            aria-expanded={showResults}
            aria-controls={listId}
            aria-activedescendant={showResults && results[active] ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            aria-label={t("searchTitle")}
            placeholder={t("searchPlaceholder")}
            className="h-16 min-w-0 flex-1 bg-transparent text-[16px] font-medium text-ink outline-none placeholder:text-muted/70"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={tc("close")}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!showResults ? (
            <div className="grid gap-6 p-5">
              <div>
                <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">{t("searchSuggestions")}</p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_SEARCHES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setQ(s);
                        setActive(0);
                        inputRef.current?.focus();
                      }}
                      className="rounded-full border border-line bg-canvas px-3 py-1.5 text-[13px] font-semibold text-navy-700 transition hover:border-navy-300 hover:bg-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">{t("categoriesTitle")}</p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {categories.map((c) => (
                    <Link
                      key={c.slug}
                      href={{ pathname: "/catalog/[category]", params: { category: c.slug } }}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 text-[14px] font-semibold text-ink/85 transition hover:bg-canvas hover:text-navy-700"
                    >
                      <CategoryIcon name={c.icon} className="size-4 text-navy-400" aria-hidden />
                      <span className="truncate">{c.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <ul id={listId} role="listbox" aria-label={t("searchProducts")} className="p-2">
              {results.length === 0 && !loading && (
                <li className="px-4 py-10 text-center text-[14px] text-muted">{t("searchNoResults")}</li>
              )}
              {loading && results.length === 0 && (
                <li className="px-4 py-10 text-center text-[14px] text-muted">{t("searchLoading")}</li>
              )}
              {results.map((r, i) => (
                <li
                  key={r.slug}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => goProduct(r.slug)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3.5 rounded-xl p-2.5 transition",
                    i === active ? "bg-navy-50" : "hover:bg-canvas",
                  )}
                >
                  <ProductImage src={r.image} alt="" sizes="56px" className="size-14 shrink-0 rounded-lg border border-line" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-ink">{r.name}</p>
                    <p className="truncate text-[12px] text-muted">
                      {[r.type, catName[r.category]].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {(r.sae || r.iso_vg) && (
                    <span className="hidden shrink-0 rounded-md bg-navy-700 px-2 py-0.5 text-[11px] font-bold text-white sm:inline">
                      {r.sae ?? r.iso_vg}
                    </span>
                  )}
                  {r.price_net != null && (
                    <span className="w-20 shrink-0 text-right text-[13px] font-extrabold tabular-nums text-navy-700">
                      {money(displayPrice({ price_net: r.price_net }, pricing))}
                    </span>
                  )}
                  <CornerDownLeft
                    className={cn("hidden size-4 shrink-0 text-navy-400 sm:block", i === active ? "opacity-100" : "opacity-0")}
                    aria-hidden
                  />
                </li>
              ))}
              {q.trim() && (
                <li
                  id={`${listId}-${results.length}`}
                  role="option"
                  aria-selected={active === results.length}
                  onMouseEnter={() => setActive(results.length)}
                  onClick={goAll}
                  className={cn(
                    "mt-1 flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-3 text-[14px] font-bold text-navy-700 transition",
                    active === results.length ? "bg-navy-50" : "hover:bg-canvas",
                  )}
                >
                  <span className="truncate">
                    {t("searchAll")}: “{q.trim()}”
                  </span>
                  <ArrowRight className="size-4 shrink-0" aria-hidden />
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="hidden items-center gap-4 border-t border-line bg-canvas px-5 py-2.5 text-[11px] font-semibold text-muted sm:flex">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-line bg-white px-1.5 py-0.5 font-sans">↑</kbd>
            <kbd className="rounded border border-line bg-white px-1.5 py-0.5 font-sans">↓</kbd>
            {t("searchNavigate")}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-line bg-white px-1.5 py-0.5 font-sans">Enter</kbd>
            {t("searchOpen")}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-line bg-white px-1.5 py-0.5 font-sans">Esc</kbd>
            {t("searchClose")}
          </span>
          <span className="ml-auto truncate">{t("searchHint")}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
