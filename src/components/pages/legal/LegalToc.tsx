"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { CalendarClock, ChevronDown, List } from "lucide-react";
import { cn } from "@/lib/utils";

export function LegalToc({ items, label, updated }: { items: { id: string; title: string }[]; label: string; updated: string }) {
  const [active, setActive] = useState(items[0]?.id);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => Boolean(e));
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [items]);

  const list = (
    <ol className="grid gap-0.5">
      {items.map((it) => {
        const isActive = active === it.id;
        return (
          <li key={it.id} className="relative">
            {isActive && (
              <motion.span layoutId="legal-toc-bar" className="absolute top-1.5 bottom-1.5 left-0 w-1 -skew-x-12 rounded-sm bg-brand-400" transition={{ type: "spring", stiffness: 400, damping: 34 }} />
            )}
            <a
              href={`#${it.id}`}
              onClick={() => {
                setActive(it.id);
                setOpen(false);
              }}
              aria-current={isActive ? "location" : undefined}
              className={cn(
                "block rounded-lg py-1.5 pr-2 pl-4 text-[13.5px] leading-snug transition-colors",
                isActive ? "font-bold text-navy-700" : "font-medium text-muted hover:text-navy-700",
              )}
            >
              {it.title}
            </a>
          </li>
        );
      })}
    </ol>
  );

  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-canvas px-3 py-1.5 text-[12.5px] font-bold text-navy-600 ring-1 ring-line">
        <CalendarClock className="size-3.5" aria-hidden />
        {updated}
      </p>
      {/* mobile: collapsible */}
      <div className="rounded-2xl border border-line bg-white lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-navy-700"
        >
          <span className="flex items-center gap-2">
            <List className="size-4" aria-hidden />
            {label}
          </span>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {open && <nav aria-label={label} className="border-t border-line px-2 py-2">{list}</nav>}
      </div>
      {/* desktop */}
      <nav aria-label={label} className="hidden lg:block">
        <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">{label}</p>
        {list}
      </nav>
    </aside>
  );
}
