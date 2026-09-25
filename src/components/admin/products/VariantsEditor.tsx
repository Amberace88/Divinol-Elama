"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronUp, Copy, ImageOff, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "../client-ui";
import { btn, inputCls } from "../styles";
import { imgUnoptimized } from "../Thumb";

export type VariantState = {
  key: string;
  id: string | null;
  sku: string;
  size: string;
  unit: "l" | "kg" | "pcs";
  gross: string;
  net: string;
  cost: string;
  stock: string;
  in_stock: boolean;
  is_active: boolean;
  image: string | null;
  weight_kg: number | null;
};

export function parseDec(s: string): number | null {
  const t = s.replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
export function fmtDec(n: number | null | undefined, max = 2, min = 2) {
  if (n == null || !Number.isFinite(n)) return "";
  return new Intl.NumberFormat("lv-LV", { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: false }).format(n);
}
const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

let seq = 0;
export function newVariantKey() {
  seq += 1;
  return `v${Date.now().toString(36)}${seq}`;
}

export function emptyVariant(): VariantState {
  return { key: newVariantKey(), id: null, sku: "", size: "", unit: "l", gross: "", net: "", cost: "", stock: "", in_stock: true, is_active: true, image: null, weight_kg: null };
}

const small = cn(inputCls, "h-9 px-2.5 text-[13px]");

export function VariantsEditor({
  variants,
  onChange,
  images,
  vat,
  errors,
}: {
  variants: VariantState[];
  onChange: (v: VariantState[]) => void;
  images: string[];
  vat: number;
  errors: Record<string, string>;
}) {
  const k = 1 + vat / 100;
  const update = (i: number, patch: Partial<VariantState>) => onChange(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= variants.length) return;
    const next = [...variants];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {variants.map((v, i) => {
          const net = parseDec(v.net);
          const cost = parseDec(v.cost);
          const margin = net && cost != null && Number.isFinite(cost) && Number.isFinite(net) && net > 0 ? ((net - cost) / net) * 100 : null;
          const err = (f: string) => errors[`variants.${i}.${f}`];
          const hasErr = Object.keys(errors).some((e) => e.startsWith(`variants.${i}.`));
          return (
            <motion.div
              key={v.key}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className={cn(
                "rounded-xl border bg-white p-3 sm:p-4",
                hasErr ? "border-red-300 ring-2 ring-red-100" : "border-line",
                !v.is_active && "bg-slate-50/80",
              )}
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-0.5 text-muted hover:bg-slate-100 hover:text-ink disabled:opacity-30" aria-label="Pārvietot uz augšu">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <span className="text-[11px] font-bold text-muted">{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === variants.length - 1}
                    className="rounded p-0.5 text-muted hover:bg-slate-100 hover:text-ink disabled:opacity-30"
                    aria-label="Pārvietot uz leju"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
                <ImagePicker value={v.image} images={images} onChange={(image) => update(i, { image })} />
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-[1.3fr_0.8fr_0.7fr_auto]">
                  <Mini label="SKU" error={err("sku")} className="col-span-2 sm:col-span-2 lg:col-span-1">
                    <input className={cn(small, "font-mono")} value={v.sku} onChange={(e) => update(i, { sku: e.target.value })} placeholder="06560-5" aria-invalid={Boolean(err("sku"))} />
                  </Mini>
                  <Mini label="Izmērs" error={err("size")}>
                    <input className={small} inputMode="decimal" value={v.size} onChange={(e) => update(i, { size: e.target.value })} placeholder="5" aria-invalid={Boolean(err("size"))} />
                  </Mini>
                  <Mini label="Mērv.">
                    <select className={small} value={v.unit} onChange={(e) => update(i, { unit: e.target.value as VariantState["unit"] })}>
                      <option value="l">L</option>
                      <option value="kg">kg</option>
                      <option value="pcs">gab.</option>
                    </select>
                  </Mini>
                  <div className="col-span-2 flex items-end gap-4 pb-1.5 sm:col-span-4 lg:col-span-1">
                    <label className="flex items-center gap-2 text-[12px] font-semibold text-muted">
                      <Switch size="sm" checked={v.in_stock} onChange={(x) => update(i, { in_stock: x })} label="Pieejams pasūtīšanai" />
                      Pieejams
                    </label>
                    <label className="flex items-center gap-2 text-[12px] font-semibold text-muted">
                      <Switch size="sm" checked={v.is_active} onChange={(x) => update(i, { is_active: x })} label="Aktīvs variants" />
                      Aktīvs
                    </label>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onChange([...variants.slice(0, i + 1), { ...v, key: newVariantKey(), id: null, sku: "" }, ...variants.slice(i + 1)])}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-slate-100 hover:text-ink"
                    aria-label="Dublēt variantu"
                    title="Dublēt"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(variants.filter((_, j) => j !== i))}
                    className="grid h-8 w-8 place-items-center rounded-lg text-red-500 hover:bg-red-50"
                    aria-label="Dzēst variantu"
                    title="Dzēst"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-dashed border-line pt-3 sm:grid-cols-3 lg:grid-cols-5 sm:pl-[92px]">
                <Mini label={`Cena ar PVN ${vat}%`} error={err("price_net")}>
                  <PriceInput
                    value={v.gross}
                    onChange={(gross) => {
                      const g = parseDec(gross);
                      update(i, { gross, net: g == null || Number.isNaN(g) ? "" : fmtDec(r4(g / k), 4, 2) });
                    }}
                    onBlurFormat={() => {
                      const g = parseDec(v.gross);
                      if (g != null && Number.isFinite(g)) update(i, { gross: fmtDec(g) });
                    }}
                    strong
                    invalid={Boolean(err("price_net"))}
                  />
                </Mini>
                <Mini label="Cena bez PVN">
                  <PriceInput
                    value={v.net}
                    onChange={(netStr) => {
                      const n = parseDec(netStr);
                      update(i, { net: netStr, gross: n == null || Number.isNaN(n) ? "" : fmtDec(r2(n * k)) });
                    }}
                  />
                </Mini>
                <Mini label="Pašizmaksa bez PVN" error={err("cost_net")}>
                  <PriceInput value={v.cost} onChange={(cost) => update(i, { cost })} placeholder="nav obligāta" />
                </Mini>
                <Mini label="Uzcenojums">
                  <div
                    className={cn(
                      "flex h-9 items-center rounded-lg px-2.5 text-[13px] font-bold tabular-nums",
                      margin == null ? "bg-slate-50 text-muted" : margin < 10 ? "bg-red-50 text-red-700" : margin < 25 ? "bg-brand-50 text-brand-700" : "bg-emerald-50 text-emerald-700",
                    )}
                    title="(cena bez PVN − pašizmaksa) / cena bez PVN"
                  >
                    {margin == null ? "—" : `${fmtDec(margin, 1, 0)}%`}
                  </div>
                </Mini>
                <Mini label="Atlikums" error={err("stock")}>
                  <input
                    className={small}
                    inputMode="numeric"
                    value={v.stock}
                    onChange={(e) => update(i, { stock: e.target.value.replace(/[^\d]/g, "") })}
                    placeholder="netiek uzskaitīts"
                    aria-invalid={Boolean(err("stock"))}
                  />
                </Mini>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      <button type="button" className={btn("outline", "md", "w-full border-dashed")} onClick={() => onChange([...variants, emptyVariant()])}>
        <Plus className="h-4 w-4" /> Pievienot variantu
      </button>
      <p className="text-[12px] text-muted">
        Ievadiet cenu ar {vat}% PVN — cena bez PVN tiek aprēķināta automātiski (÷ {fmtDec(k, 2, 2)}) un saglabāta ar 4 zīmēm aiz komata. Varat ievadīt arī cenu bez PVN. Tukšs
        atlikums = netiek uzskaitīts.
      </p>
    </div>
  );
}

function Mini({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.06em] text-muted">{label}</span>
      {children}
      {error && <span className="mt-0.5 block text-[11px] font-semibold text-red-600">{error}</span>}
    </label>
  );
}

function PriceInput({
  value,
  onChange,
  onBlurFormat,
  placeholder,
  strong,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlurFormat?: () => void;
  placeholder?: string;
  strong?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <input
        className={cn(small, "pr-6 tabular-nums", strong && "font-bold")}
        inputMode="decimal"
        value={value}
        placeholder={placeholder ?? "0,00"}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        onBlur={onBlurFormat}
        aria-invalid={invalid}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted">€</span>
    </div>
  );
}

function ImagePicker({ value, images, onChange }: { value: string | null; images: string[]; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const options = value && !images.includes(value) ? [value, ...images] : images;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-lg border border-line bg-white transition hover:border-navy-300"
        aria-label="Izvēlēties varianta attēlu"
        aria-expanded={open}
      >
        {value ? (
          <Image src={value} alt="" fill sizes="64px" unoptimized={imgUnoptimized(value)} className="object-contain p-1" />
        ) : (
          <ImageOff className="h-5 w-5 text-slate-300" />
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-[70px] z-20 w-64 rounded-xl border border-line bg-white p-2 shadow-lift" role="listbox" aria-label="Produkta attēli">
          {options.length === 0 ? (
            <p className="p-2 text-[12px] text-muted">Vispirms pievienojiet produkta attēlus.</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className={cn("grid aspect-square place-items-center rounded-md border text-[10px] font-bold text-muted", !value ? "border-navy-500" : "border-line")}
              >
                Nav
              </button>
              {options.map((src) => (
                <button
                  key={src}
                  type="button"
                  role="option"
                  aria-selected={src === value}
                  onClick={() => {
                    onChange(src);
                    setOpen(false);
                  }}
                  className={cn("relative aspect-square overflow-hidden rounded-md border", src === value ? "border-navy-600 ring-2 ring-navy-200" : "border-line hover:border-navy-300")}
                >
                  <Image src={src} alt="" fill sizes="60px" unoptimized={imgUnoptimized(src)} className="object-contain p-0.5" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
