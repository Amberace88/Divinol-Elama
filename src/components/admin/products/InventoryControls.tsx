"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  AVAILABILITIES,
  fmtDecimal,
  grossOf,
  netOf,
  parseDecimal,
  r4,
  STOCK_LEVEL,
  type Availability,
  type StockLevel,
} from "@/lib/admin/inventory";
import { cn } from "@/lib/utils";

/** Compact inline inputs for the products list. Enter saves (focus stays), Esc reverts, Tab/blur saves. */

const cell =
  "h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-[13px] text-ink outline-none transition hover:border-line hover:bg-white focus:border-navy-400 focus:bg-white focus:ring-4 focus:ring-navy-100 disabled:opacity-60";

export function InlineInput({
  value,
  onCommit,
  ariaLabel,
  placeholder,
  className,
  inputMode = "decimal",
  suffix,
  disabled,
}: {
  value: string;
  onCommit: (draft: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  inputMode?: "decimal" | "numeric";
  suffix?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const d = draft;
    setDraft(null);
    if (d != null && d.trim() !== value.trim()) onCommit(d);
  };
  return (
    <div className="relative">
      <input
        value={draft ?? value}
        inputMode={inputMode}
        aria-label={ariaLabel}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value.replace(inputMode === "numeric" ? /[^\d-]/g : /[^\d.,\s-]/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setDraft(null);
          }
        }}
        onBlur={commit}
        className={cn(cell, "tabular-nums", suffix && "pr-6", draft != null && "border-navy-300 bg-white", className)}
      />
      {suffix && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted">{suffix}</span>}
    </div>
  );
}

export type PriceMode = "gross" | "net";

export function PriceCell({
  net,
  vat,
  mode,
  onSave,
  label,
}: {
  net: number;
  vat: number;
  mode: PriceMode;
  onSave: (net: number) => void;
  label: string;
}) {
  const gross = grossOf(net, vat);
  return (
    <div className="w-[118px]">
      <InlineInput
        value={mode === "gross" ? fmtDecimal(gross) : fmtDecimal(net, 4, 2)}
        suffix="€"
        ariaLabel={`${label}: cena ${mode === "gross" ? `ar PVN ${vat}%` : "bez PVN"}`}
        className="text-right font-bold"
        onCommit={(d) => {
          const n = parseDecimal(d);
          if (n == null || Number.isNaN(n) || n < 0 || n > 1_000_000) {
            toast.error("Nederīga cena");
            return;
          }
          const newNet = mode === "gross" ? netOf(n, vat) : r4(n);
          if (newNet !== net) onSave(newNet);
        }}
      />
      <p className="mt-0.5 pr-2 text-right text-[11px] tabular-nums text-muted">
        {mode === "gross" ? <>bez PVN {fmtDecimal(net, 4, 2)}</> : <>ar PVN {fmtDecimal(gross)}</>}
      </p>
    </div>
  );
}

/** Stock with +/- steppers (debounced, sent as a delta so concurrent orders are never overwritten) and direct input. */
export function StockCell({
  stock,
  onDelta,
  onSet,
  label,
}: {
  stock: number | null;
  onDelta: (delta: number) => void;
  onSet: (value: number | null) => void;
  label: string;
}) {
  const [pending, setPending] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(0);
  const onDeltaRef = useRef(onDelta);
  useEffect(() => {
    onDeltaRef.current = onDelta;
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const d = pendingRef.current;
    pendingRef.current = 0;
    setPending(0);
    if (d) onDeltaRef.current(d);
  }
  function step(d: number) {
    const base = (stock ?? 0) + pendingRef.current;
    if (base + d < 0) return;
    pendingRef.current += d;
    setPending(pendingRef.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 650);
  }
  const shown = stock == null && !pending ? "" : String((stock ?? 0) + pending);
  const btnCls =
    "grid h-8 w-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-navy-50 hover:text-navy-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy-100 disabled:opacity-30";

  return (
    <div className="flex w-[124px] items-center gap-0.5">
      <button type="button" className={btnCls} onClick={() => step(-1)} disabled={(stock ?? 0) + pending <= 0} aria-label={`${label}: samazināt atlikumu`}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <InlineInput
        value={shown}
        inputMode="numeric"
        placeholder="—"
        ariaLabel={`${label}: atlikums`}
        className={cn("text-center font-semibold", pending !== 0 && "text-navy-700")}
        onCommit={(d) => {
          if (timer.current) flush();
          const t = d.trim();
          if (t === "") {
            if (stock != null) onSet(null);
            return;
          }
          const n = Number(t);
          if (!Number.isInteger(n) || n < 0 || n > 10_000_000) {
            toast.error("Atlikumam jābūt veselam skaitlim ≥ 0");
            return;
          }
          onSet(n);
        }}
      />
      <button type="button" className={btnCls} onClick={() => step(1)} aria-label={`${label}: palielināt atlikumu`}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const selectTone: Record<Availability, string> = {
  in_stock: "border-emerald-200 bg-emerald-50 text-emerald-800",
  on_order: "border-sky-200 bg-sky-50 text-sky-800",
  out_of_stock: "border-red-200 bg-red-50 text-red-800",
  discontinued: "border-slate-200 bg-slate-100 text-slate-600",
};

export function StatusCell({
  availability,
  level,
  leadTime,
  onStatus,
  onLeadTime,
  label,
}: {
  availability: Availability;
  level: StockLevel;
  leadTime: number | null;
  onStatus: (a: Availability) => void;
  onLeadTime: (days: number | null) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={availability}
        onChange={(e) => onStatus(e.target.value as Availability)}
        aria-label={`${label}: statuss`}
        title={STOCK_LEVEL[availability].hint}
        className={cn(
          "h-8 rounded-lg border px-2 pr-7 text-[12.5px] font-semibold outline-none transition focus:ring-4 focus:ring-navy-100",
          selectTone[availability],
        )}
      >
        {AVAILABILITIES.map((a) => (
          <option key={a} value={a}>
            {STOCK_LEVEL[a].label}
          </option>
        ))}
      </select>
      {level === "low_stock" && (
        <span className="whitespace-nowrap rounded-full bg-brand-50 px-1.5 py-0.5 text-[11px] font-bold text-brand-700 ring-1 ring-inset ring-brand-200" title={STOCK_LEVEL.low_stock.hint}>
          Zems
        </span>
      )}
      {(availability === "on_order" || availability === "out_of_stock") && (
        <div className="w-[64px]" title="Piegādes termiņš dienās">
          <InlineInput
            value={leadTime == null ? "" : String(leadTime)}
            inputMode="numeric"
            placeholder="dienas"
            suffix="d."
            ariaLabel={`${label}: piegādes termiņš dienās`}
            onCommit={(d) => {
              const t = d.trim();
              if (!t) return onLeadTime(null);
              const n = Number(t);
              if (!Number.isInteger(n) || n < 0 || n > 365) {
                toast.error("Termiņam jābūt 0–365 dienām");
                return;
              }
              onLeadTime(n);
            }}
          />
        </div>
      )}
    </div>
  );
}
