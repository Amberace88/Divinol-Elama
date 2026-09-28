"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

type RollCustom = { dir: number; delay: number };
const spring = { type: "spring", stiffness: 420, damping: 32, mass: 0.8 } as const;

const roll: Variants = {
  // dir > 0 (value went up): new digits rise from below while the old ones leave upwards — and the reverse when it goes down.
  // Enter and exit share the slot's delay so a digit never leaves an empty gap while its successor waits.
  // Pure slide inside a clipped slot (no fade) — reads as a real odometer and never shows an empty slot mid-roll.
  enter: ({ dir }: RollCustom) => ({ y: dir > 0 ? "100%" : "-100%" }),
  center: ({ delay }: RollCustom) => ({ y: "0%", transition: { ...spring, delay } }),
  exit: ({ dir, delay }: RollCustom) => ({ y: dir > 0 ? "-100%" : "100%", transition: { ...spring, delay } }),
};

/**
 * Odometer-style number: every changed character rolls up (value increased) or down (value decreased),
 * staggered from the last digit to the first. Unchanged characters stay still. Respects reduced motion.
 */
export function RollingNumber({
  value,
  format,
  className,
  stagger = 0.035,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  const [track, setTrack] = useState({ value, dir: 1 });
  if (track.value !== value) setTrack({ value, dir: value > track.value ? 1 : -1 });
  const dir = track.dir;

  const text = format(value);
  if (reduce) return <span className={cn("tabular-nums", className)}>{text}</span>;

  const chars = [...text];
  const n = chars.length;

  return (
    <span className={cn("relative inline-flex whitespace-nowrap tabular-nums", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex">
        <AnimatePresence initial={false}>
          {chars.map((c, i) => {
            const pos = n - i; // keyed from the right so "€" and decimals keep their slot when the length changes
            return (
              <motion.span
                key={pos}
                className="relative inline-block overflow-hidden align-bottom"
                style={{ height: "1.12em", lineHeight: "1.12em" }}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <AnimatePresence initial={false} custom={{ dir, delay: (pos - 1) * stagger }} mode="popLayout">
                  <motion.span
                    key={c}
                    custom={{ dir, delay: (pos - 1) * stagger }}
                    variants={roll}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="block"
                  >
                    {c === " " ? " " : c}
                  </motion.span>
                </AnimatePresence>
              </motion.span>
            );
          })}
        </AnimatePresence>
      </span>
    </span>
  );
}
