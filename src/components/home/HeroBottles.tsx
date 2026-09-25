"use client";

import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type HeroBottle = { slug: string; name: string; image: string; label: string };

const SLOTS = [
  { cls: "left-[22%] top-[6%] z-20 w-[46%] rotate-[-3deg]", depth: 26, delay: "0s" },
  { cls: "left-[0%] top-[46%] z-10 w-[34%] rotate-[-8deg]", depth: 14, delay: "-2.2s" },
  { cls: "right-[0%] top-[2%] z-10 w-[32%] rotate-[7deg]", depth: 18, delay: "-4.1s" },
  { cls: "right-[4%] top-[52%] z-30 w-[34%] rotate-[4deg]", depth: 34, delay: "-1.3s" },
];

function Bottle({ b, slot, i, mx, my }: { b: HeroBottle; slot: (typeof SLOTS)[number]; i: number; mx: ReturnType<typeof useSpring>; my: ReturnType<typeof useSpring> }) {
  const x = useTransform(mx, (v) => v * slot.depth);
  const y = useTransform(my, (v) => v * slot.depth);
  return (
    <motion.div
      className={cn("absolute", slot.cls)}
      initial={{ opacity: 0, scale: 0.85, y: 40 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.25 + i * 0.12, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div style={{ x, y }}>
        <div className="animate-float" style={{ animationDelay: slot.delay }}>
          <Link
            href={{ pathname: "/product/[slug]", params: { slug: b.slug } }}
            className="group block rounded-[1.6rem] bg-white p-3 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.55)] ring-1 ring-white/60 transition-transform duration-300 hover:scale-[1.04]"
            aria-label={b.name}
          >
            <span className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-[radial-gradient(100%_80%_at_50%_20%,#fff_55%,#eef2f9_100%)]">
              <Image
                src={b.image}
                alt={b.name}
                fill
                priority={i === 0}
                sizes="(min-width:1024px) 260px, 40vw"
                className="object-contain p-2 mix-blend-multiply"
              />
            </span>
            <span className="mt-2 flex items-center justify-between gap-2 px-1">
              <span className="truncate text-[11px] font-extrabold text-ink">{b.name.replace(/^Divinol\s+/i, "")}</span>
              <span className="shrink-0 rounded-md bg-navy-700 px-1.5 py-0.5 text-[10px] font-bold text-brand-300">{b.label}</span>
            </span>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Floating product packshots with gentle mouse parallax. */
export function HeroBottles({ bottles, className }: { bottles: HeroBottle[]; className?: string }) {
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const mx = useSpring(rx, { stiffness: 60, damping: 18 });
  const my = useSpring(ry, { stiffness: 60, damping: 18 });
  return (
    <div
      className={cn("relative", className)}
      onMouseMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        rx.set((e.clientX - r.left) / r.width - 0.5);
        ry.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      {bottles.slice(0, 4).map((b, i) => (
        <Bottle key={b.slug} b={b} slot={SLOTS[i]} i={i} mx={mx} my={my} />
      ))}
    </div>
  );
}
