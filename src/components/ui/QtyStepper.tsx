"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  size = "md",
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const t = useTranslations("a11y");
  const h = size === "sm" ? "h-8" : size === "lg" ? "h-14" : "h-11";
  const w = size === "sm" ? "w-8" : size === "lg" ? "w-12" : "w-10";
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n) || min));
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-xl border border-line bg-white shadow-[inset_0_1px_1px_rgb(16_24_40/0.04)]",
        h,
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label={t("decrease")}
        className={cn("grid h-full place-items-center rounded-l-xl text-navy-700 transition hover:bg-navy-50 disabled:opacity-35", w)}
      >
        <Minus className="size-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-label={t("quantity")}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className={cn(
          "h-full min-w-0 border-x border-line bg-transparent text-center font-bold tabular-nums text-ink outline-none [appearance:textfield] focus:bg-navy-50/60 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          size === "sm" ? "w-9 text-[13px]" : size === "lg" ? "w-14 text-base" : "w-11 text-sm",
        )}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label={t("increase")}
        className={cn("grid h-full place-items-center rounded-r-xl text-navy-700 transition hover:bg-navy-50 disabled:opacity-35", w)}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
