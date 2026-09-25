"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Sticky in-page navigation with scroll-spy (all sections stay in the HTML for SEO). */
export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((x): x is HTMLElement => Boolean(x));
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);
  return (
    <nav className="sticky top-14 z-30 -mx-4 border-b border-line bg-white/90 px-4 backdrop-blur-lg sm:-mx-6 sm:px-6 lg:top-16 lg:mx-0 lg:rounded-2xl lg:border lg:px-2">
      <ul className="no-scrollbar flex gap-1 overflow-x-auto py-2">
        {items.map((i) => (
          <li key={i.id} className="shrink-0">
            <a
              href={`#${i.id}`}
              className={cn(
                "relative inline-flex h-9 items-center rounded-lg px-3.5 text-[13.5px] font-bold transition",
                active === i.id ? "bg-navy-700 text-white" : "text-ink/70 hover:bg-canvas hover:text-ink",
              )}
            >
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
