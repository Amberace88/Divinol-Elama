"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/** Slider + number input pair. The number input accepts values beyond the slider range (up to `hardMax`). */
export function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hardMax,
  suffix,
  className,
  format,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  hardMax?: number;
  suffix?: string;
  className?: string;
  format?: (n: number) => string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const upper = hardMax ?? max;
  const clamp = (n: number) => Math.min(upper, Math.max(min, n));
  const decimals = step < 1 ? String(step).split(".")[1]?.length ?? 1 : 0;

  return (
    <div className={cn("group", className)}>
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-ink/80">
          {label}
        </label>
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface pr-2.5 shadow-[inset_0_1px_1px_rgb(16_24_40/0.04)] focus-within:border-navy-400 focus-within:ring-4 focus-within:ring-navy-100">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={min}
            max={upper}
            step={step}
            value={draft ?? (format ? format(value) : String(Number(value.toFixed(decimals))))}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = Number(e.target.value.replace(",", "."));
              if (e.target.value !== "" && Number.isFinite(n)) onChange(clamp(n));
            }}
            onBlur={() => setDraft(null)}
            className="h-9 w-20 min-w-0 bg-transparent pl-2.5 text-right text-[15px] font-bold tabular-nums text-navy-700 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {suffix && <span className="text-[13px] font-semibold text-muted">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => {
          setDraft(null);
          onChange(Number(e.target.value));
        }}
        style={{ background: `linear-gradient(to right, var(--color-brand-400) ${pct}%, var(--color-navy-100) ${pct}%)` }}
        className={cn(
          "h-2 w-full cursor-pointer appearance-none rounded-full outline-none",
          "[&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-navy-700 [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgb(16_24_40/0.35)] [&::-webkit-slider-thumb]:transition-transform active:[&::-webkit-slider-thumb]:scale-110",
          "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-navy-700 [&::-moz-range-thumb]:shadow-[0_2px_8px_rgb(16_24_40/0.35)]",
          "focus-visible:ring-4 focus-visible:ring-navy-100",
        )}
      />
    </div>
  );
}
