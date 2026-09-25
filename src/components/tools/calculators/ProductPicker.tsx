"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Search } from "lucide-react";
import { ProductImage } from "@/components/ui/ProductImage";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/lib/catalog";

type Item = Pick<ProductSummary, "slug" | "name" | "image" | "sae" | "type">;

/** Searchable single-select (combobox + listbox) over products. */
export function ProductPicker({
  label,
  items,
  value,
  onChange,
  searchPlaceholder,
  emptyText,
}: {
  label: string;
  items: Item[];
  value: string;
  onChange: (slug: string) => void;
  searchPlaceholder: string;
  emptyText: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = items.find((i) => i.slug === value);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/\s+/g, " ");
    if (!needle) return items;
    return items.filter((i) => `${i.name} ${i.sae ?? ""} ${i.type}`.toLowerCase().includes(needle));
  }, [items, q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (slug: string) => {
    onChange(slug);
    setOpen(false);
    setQ("");
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active].slug);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <span id={`${id}-label`} className="label">
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => {
          setActive(Math.max(0, items.findIndex((i) => i.slug === value)));
          setOpen((o) => !o);
        }}
        className="flex w-full items-center gap-3 rounded-xl border border-line bg-white p-2 pr-3.5 text-left shadow-[inset_0_1px_1px_rgb(16_24_40/0.04)] transition hover:border-navy-300 focus-visible:border-navy-400 focus-visible:ring-4 focus-visible:ring-navy-100 focus-visible:outline-none"
      >
        <ProductImage src={selected?.image ?? null} alt="" sizes="48px" className="size-12 shrink-0 rounded-lg ring-1 ring-line" imgClassName="p-1" />
        <span id={`${id}-value`} className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-navy-700">{selected?.name ?? "—"}</span>
          <span className="block truncate text-[12.5px] text-muted">{[selected?.sae, selected?.type].filter(Boolean).join(" · ")}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-navy-400 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-line bg-white shadow-lift"
          >
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="size-4 text-muted" aria-hidden />
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded
                aria-controls={`${id}-list`}
                aria-activedescendant={filtered[active] ? `${id}-opt-${active}` : undefined}
                aria-autocomplete="list"
                aria-label={searchPlaceholder}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKey}
                placeholder={searchPlaceholder}
                className="h-11 w-full bg-transparent text-[15px] outline-none placeholder:text-muted/70"
              />
            </div>
            <ul ref={listRef} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} className="max-h-72 overflow-y-auto p-1.5">
              {filtered.length === 0 && <li className="px-3 py-4 text-sm text-muted">{emptyText}</li>}
              {filtered.map((it, i) => {
                const isSel = it.slug === value;
                return (
                  <li
                    key={it.slug}
                    id={`${id}-opt-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(it.slug)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-colors",
                      i === active ? "bg-navy-50" : "",
                    )}
                  >
                    <ProductImage src={it.image} alt="" sizes="36px" className="size-9 shrink-0 rounded-md" imgClassName="p-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-ink">{it.name}</span>
                      <span className="block truncate text-[12px] text-muted">{it.type}</span>
                    </span>
                    {isSel && <Check className="size-4 shrink-0 text-success" aria-hidden />}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
