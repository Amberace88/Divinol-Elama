"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { useLocale } from "next-intl";

/**
 * Number that counts up once when it approaches the viewport. The final value is server-rendered
 * (SEO / no-JS) and the animation writes directly to the DOM, so no re-renders are triggered.
 */
export function CountUp({
  value,
  prefix = "",
  suffix = "",
  grouping = true,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  /** false for years (1866, not 1 866) */
  grouping?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px 160px 0px" });
  const reduce = useReducedMotion();
  const locale = useLocale();
  const fmt = new Intl.NumberFormat(locale, { useGrouping: grouping });

  useEffect(() => {
    if (!inView || reduce || !ref.current) return;
    const el = ref.current;
    const nf = new Intl.NumberFormat(locale, { useGrouping: grouping });
    const from = grouping ? 0 : Math.max(0, value - 80);
    const controls = animate(from, value, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = nf.format(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value, grouping, locale]);

  return (
    <span className={className}>
      {prefix}
      <span ref={ref} className="tabular-nums">
        {fmt.format(value)}
      </span>
      {suffix}
    </span>
  );
}
