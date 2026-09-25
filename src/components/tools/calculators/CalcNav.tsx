"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Droplets, Fuel, Snowflake, Truck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = { oil: Droplets, fleet: Truck, "2t": Fuel, washer: Snowflake };

/** Sticky in-page navigation with scroll-spy for the calculators (#oil, #fleet, #2t, #washer). */
export function CalcNav({ items, label }: { items: { id: string; label: string }[]; label: string }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => Boolean(e));
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [items]);

  return (
    <nav aria-label={label} className="sticky top-14 z-20 -mx-4 border-b border-line/70 bg-canvas/85 px-4 py-3 backdrop-blur-md sm:top-[4.25rem] lg:top-[4.75rem] sm:mx-0 sm:rounded-2xl sm:border sm:bg-white/85 sm:px-2 sm:py-2 sm:shadow-card">
      <ul className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {items.map((it) => {
          const Icon = ICONS[it.id] ?? Droplets;
          const isActive = active === it.id;
          return (
            <li key={it.id} className="shrink-0">
              <a
                href={`#${it.id}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => setActive(it.id)}
                className={cn(
                  "relative flex h-10 items-center gap-2 rounded-xl px-3.5 text-[13.5px] font-bold transition-colors",
                  isActive ? "text-navy-900" : "text-navy-600 hover:bg-navy-50",
                )}
              >
                {isActive && (
                  <motion.span layoutId="calc-nav-pill" className="absolute inset-0 -z-0 rounded-xl bg-brand-400" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                )}
                <Icon className="relative size-4" aria-hidden />
                <span className="relative">{it.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
