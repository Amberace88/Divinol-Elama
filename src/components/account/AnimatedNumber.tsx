"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { formatMoney } from "@/lib/commerce";
import { intlLocale } from "./format";

/** Counts up to `value` once visible; renders the final value on the server and with reduced motion. */
export function AnimatedNumber({ value, locale, money = false }: { value: number; locale: string; money?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const format = (n: number) => (money ? formatMoney(n, locale) : new Intl.NumberFormat(intlLocale(locale)).format(Math.round(n)));

  useEffect(() => {
    if (!inView || reduce || !ref.current || value === 0) return;
    const el = ref.current;
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {format(value)}
    </span>
  );
}
