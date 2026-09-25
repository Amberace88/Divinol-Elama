"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CornerDownLeft, Package, Search, ShoppingBag, UserRound } from "lucide-react";
import { fmtMoney } from "@/lib/admin/format";
import { labelOf, ORDER_STATUS } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import { Spinner, useIsClient } from "./client-ui";
import { imgUnoptimized } from "./Thumb";

type Results = {
  orders: { id: string; number: string; email: string; name: string; total: number; status: string }[];
  products: { id: string; name: string; slug: string; sku: string | null; image: string | null }[];
  customers: { id: string; name: string; email: string; company: string | null }[];
};
type Item = { key: string; href: string; group: string; node: React.ReactNode };

const EMPTY: Results = { orders: [], products: [], customers: [] };

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const isClient = useIsClient();
  const isMac = isClient && /Mac|iPhone|iPad/.test(navigator.platform);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex h-10 w-full max-w-xl items-center gap-2.5 rounded-xl border border-line bg-slate-50/80 px-3 text-left text-[13px] text-muted transition hover:border-navy-200 hover:bg-white"
        aria-label="Meklēt"
      >
        <Search className="h-4 w-4 shrink-0 text-muted group-hover:text-navy-600" aria-hidden />
        <span className="flex-1 truncate">
          <span className="sm:hidden">Meklēt…</span>
          <span className="hidden sm:inline">Meklēt pasūtījumus, produktus, klientus…</span>
        </span>
        <kbd className="hidden rounded-md border border-line bg-white px-1.5 py-0.5 font-sans text-[11px] font-bold text-muted sm:inline">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>
      <AnimatePresence>{open && <Palette onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [data, setData] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) {
          setData((await res.json()) as Results);
          setActive(0);
        }
      } catch {
        /* aborted or offline */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const results = q.trim().length < 2 ? EMPTY : data;

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const o of results.orders) {
      const st = labelOf(ORDER_STATUS, o.status);
      out.push({
        key: `o-${o.id}`,
        href: `/admin/orders/${o.id}`,
        group: "Pasūtījumi",
        node: (
          <>
            <ShoppingBag className="h-4 w-4 shrink-0 text-muted" />
            <span className="min-w-0 flex-1">
              <span className="font-bold text-ink">{o.number}</span>
              <span className="ml-2 truncate text-muted">{o.name || o.email}</span>
            </span>
            <span className="text-[12px] text-muted">{st.label}</span>
            <span className="w-20 text-right font-semibold tabular-nums text-ink">{fmtMoney(o.total)}</span>
          </>
        ),
      });
    }
    for (const p of results.products) {
      out.push({
        key: `p-${p.id}`,
        href: `/admin/products/${p.id}`,
        group: "Produkti",
        node: (
          <>
            {p.image ? (
              <Image
                src={p.image}
                alt=""
                width={28}
                height={28}
                unoptimized={imgUnoptimized(p.image)}
                className="h-7 w-7 shrink-0 rounded-md bg-slate-50 object-contain"
              />
            ) : (
              <Package className="h-4 w-4 shrink-0 text-muted" />
            )}
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">{p.name}</span>
            {p.sku && <span className="font-mono text-[12px] text-muted">{p.sku}</span>}
          </>
        ),
      });
    }
    for (const c of results.customers) {
      out.push({
        key: `c-${c.id}`,
        href: `/admin/customers/${c.id}`,
        group: "Klienti",
        node: (
          <>
            <UserRound className="h-4 w-4 shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold text-ink">{c.company || c.name || c.email}</span>
              <span className="ml-2 text-muted">{c.email}</span>
            </span>
          </>
        ),
      });
    }
    return out;
  }, [results]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      go(items[active].href);
    }
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let lastGroup = "";
  const term = q.trim();

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-3 pt-[8vh] sm:p-6 sm:pt-[12vh]" onKeyDown={onKeyDown}>
      <motion.div
        className="absolute inset-0 bg-navy-950/50 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Globālā meklēšana"
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-line"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-5 w-5 text-navy-400" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pasūtījuma nr., e-pasts, produkts, SKU, uzņēmums…"
            className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted/70"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls="admin-search-list"
            aria-activedescendant={items[active] ? `admin-search-${items[active].key}` : undefined}
          />
          {loading && term.length >= 2 && <Spinner className="text-muted" />}
          <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[11px] font-bold text-muted">Esc</kbd>
        </div>
        <div ref={listRef} id="admin-search-list" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
          {term.length < 2 ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted">Ievadiet vismaz 2 simbolus. Padoms: atveriet meklēšanu ar „/” vai Ctrl K.</p>
          ) : items.length === 0 && !loading ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted">Nekas netika atrasts pēc „{term}”.</p>
          ) : (
            items.map((it, idx) => {
              const header = it.group !== lastGroup ? it.group : null;
              lastGroup = it.group;
              return (
                <div key={it.key}>
                  {header && <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted first:pt-1">{header}</p>}
                  <button
                    type="button"
                    id={`admin-search-${it.key}`}
                    role="option"
                    aria-selected={idx === active}
                    data-idx={idx}
                    onMouseMove={() => setActive(idx)}
                    onClick={() => go(it.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition",
                      idx === active ? "bg-navy-50" : "hover:bg-slate-50",
                    )}
                  >
                    {it.node}
                    <CornerDownLeft className={cn("h-3.5 w-3.5 text-navy-400", idx === active ? "opacity-100" : "opacity-0")} aria-hidden />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
