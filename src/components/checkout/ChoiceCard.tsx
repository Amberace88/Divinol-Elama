"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Large radio card used for delivery and payment options. */
export function ChoiceCard({
  name,
  value,
  checked,
  disabled,
  onChange,
  icon,
  title,
  text,
  aside,
  badge,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: string) => void;
  icon: React.ReactNode;
  title: string;
  text?: React.ReactNode;
  aside?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "relative flex items-start gap-3.5 rounded-2xl border-2 p-4 transition",
        disabled
          ? "cursor-not-allowed border-line bg-canvas/60 opacity-60"
          : checked
            ? "cursor-pointer border-navy-700 bg-navy-50/50 shadow-[0_10px_24px_-14px_rgb(30_45_81/0.55)]"
            : "cursor-pointer border-line bg-surface hover:border-navy-200",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="peer sr-only"
      />
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl transition",
          checked ? "bg-navy-700 text-brand-400" : "bg-canvas text-navy-500",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold text-ink">{title}</span>
          {badge}
        </span>
        {text && <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">{text}</span>}
      </span>
      {aside && <span className="shrink-0 text-right text-[14px] font-extrabold tabular-nums text-navy-700">{aside}</span>}
      <span
        aria-hidden
        className={cn(
          "absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-navy-700 text-white transition peer-focus-visible:ring-4 peer-focus-visible:ring-navy-200",
          checked ? "scale-100" : "scale-0",
        )}
      >
        <Check className="size-3" strokeWidth={3.5} />
      </span>
    </label>
  );
}
