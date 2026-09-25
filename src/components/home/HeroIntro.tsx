"use client";

import { motion, useReducedMotion } from "motion/react";

/** Staggered entrance for the hero copy. Starts almost-visible so the headline still counts for LCP. */
export function HeroIntro({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } }}
    >
      {children}
    </motion.div>
  );
}

export function HeroItem({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "p" | "h1" }) {
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      variants={{
        hidden: { opacity: 0.01, y: 22 },
        show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
      }}
    >
      {children}
    </Comp>
  );
}
