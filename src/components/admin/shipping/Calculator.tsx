"use client";

import { useMemo, useState } from "react";
import { Calculator as CalcIcon, Plus, RotateCcw, Trash2 } from "lucide-react";
import { fmtNumber } from "@/lib/admin/format";
import { MARKET, MARKETS } from "@/lib/admin/labels";
import { compareRates, needsPallet, packUnit, PRESETS, type Unit } from "@/lib/shipping/compare";
import type { RateRow, ServiceType } from "@/lib/shipping/types";
import type { Market } from "@/lib/types";
import { cn } from "@/lib/utils";
import { btn, inputCls, selectCls } from "../styles";
import { CompareTable } from "./CompareTable";

type Item = { size: string; unit: "l" | "kg"; qty: string };
type Box = { weight: string; l: string; w: string; h: string; qty: string };

const n = (s: string) => {
  const v = Number(String(s).replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/** "Cenu kalkulators" — compare carriers without an order. */
export function Calculator({ rates, carriers, apiCarriers }: { rates: RateRow[]; carriers: Record<string, { name: string; enabled: boolean }>; apiCarriers: string[] }) {
  const [country, setCountry] = useState<Market>("LV");
  const [type, setType] = useState<ServiceType | "any">("any");
  const [mode, setMode] = useState<"goods" | "boxes">("goods");
  const [items, setItems] = useState<Item[]>([{ size: "5", unit: "l", qty: "1" }]);
  const [boxes, setBoxes] = useState<Box[]>([{ weight: "5", l: "30", w: "20", h: "15", qty: "1" }]);
  const [charge, setCharge] = useState("");

  const units: Unit[] = useMemo(() => {
    if (mode === "goods") {
      return items.flatMap((it) => {
        const q = Math.min(200, Math.round(n(it.qty)));
        const u = packUnit(n(it.size), it.unit, `${it.size} ${it.unit === "kg" ? "kg" : "L"}`);
        return Array.from({ length: q }, () => u);
      });
    }
    return boxes.flatMap((b) => {
      const q = Math.min(99, Math.round(n(b.qty)));
      const u: Unit = { weightKg: n(b.weight), l: n(b.l) || 1, w: n(b.w) || 1, h: n(b.h) || 1, label: "Kaste" };
      return Array.from({ length: q }, () => u);
    });
  }, [mode, items, boxes]);

  const options = useMemo(
    () =>
      compareRates(rates, {
        country,
        type,
        units,
        combine: mode === "goods",
        carriers,
        customerPaidNet: charge.trim() ? n(charge) : null,
      }),
    [rates, country, type, units, mode, carriers, charge],
  );

  const weight = units.reduce((s, u) => s + u.weightKg, 0);
  const pallet = needsPallet(units);

  return (
    <div className="grid gap-5 p-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="mb-1 block text-[12px] font-bold text-muted">Valsts</span>
            <select className={selectCls} value={country} onChange={(e) => setCountry(e.target.value as Market)}>
              {MARKETS.map((m) => (
                <option key={m} value={m}>
                  {MARKET[m]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[12px] font-bold text-muted">Piegādes veids</span>
            <select className={selectCls} value={type} onChange={(e) => setType(e.target.value as ServiceType | "any")}>
              <option value="any">Visi</option>
              <option value="locker">Pakomāts</option>
              <option value="courier">Kurjers</option>
              <option value="pallet">Palete / krava</option>
            </select>
          </label>
        </div>

        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          {(["goods", "boxes"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn("h-8 rounded-md text-[12.5px] font-bold transition", mode === m ? "bg-white text-navy-700 shadow-sm" : "text-muted hover:text-ink")}
            >
              {m === "goods" ? "Preces (iepakojumi)" : "Gatavas kastes"}
            </button>
          ))}
        </div>

        {mode === "goods" ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="rounded-full border border-line bg-white px-2.5 py-1 text-[12px] font-semibold text-ink/80 transition hover:border-navy-300 hover:bg-navy-50"
                  onClick={() => setItems(p.items.map((i) => ({ size: String(i.size), unit: i.unit, qty: String(i.qty) })))}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {items.map((it, i) => (
              <div key={i} className="flex items-end gap-2">
                <label className="w-16">
                  <span className="mb-1 block text-[11px] font-bold text-muted">Skaits</span>
                  <input className={inputCls} inputMode="numeric" value={it.qty} onChange={(e) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
                </label>
                <span className="pb-2.5 text-muted">×</span>
                <label className="flex-1">
                  <span className="mb-1 block text-[11px] font-bold text-muted">Iepakojums</span>
                  <input className={inputCls} inputMode="decimal" value={it.size} onChange={(e) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))} />
                </label>
                <label className="w-20">
                  <span className="sr-only">Mērvienība</span>
                  <select className={selectCls} value={it.unit} onChange={(e) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, unit: e.target.value as "l" | "kg" } : x)))}>
                    <option value="l">L</option>
                    <option value="kg">kg</option>
                  </select>
                </label>
                <button type="button" className={btn("ghost", "sm", "mb-1")} onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} disabled={items.length === 1} aria-label="Noņemt">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button type="button" className={btn("ghost", "sm")} onClick={() => setItems((xs) => [...xs, { size: "1", unit: "l", qty: "1" }])}>
              <Plus className="h-3.5 w-3.5" /> Pievienot preci
            </button>
            <p className="text-[11.5px] leading-5 text-muted">Svars ≈ litri × 0,9 kg + iepakojums; mazie iepakojumi tiek apvienoti kastēs. 60–208 L mucas → palete.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {boxes.map((b, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <label className="w-14">
                  <span className="mb-1 block text-[11px] font-bold text-muted">Sk.</span>
                  <input className={inputCls} inputMode="numeric" value={b.qty} onChange={(e) => setBoxes((xs) => xs.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
                </label>
                <label className="w-16">
                  <span className="mb-1 block text-[11px] font-bold text-muted">kg</span>
                  <input className={inputCls} inputMode="decimal" value={b.weight} onChange={(e) => setBoxes((xs) => xs.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} />
                </label>
                {(["l", "w", "h"] as const).map((k) => (
                  <label key={k} className="w-14">
                    <span className="mb-1 block text-[11px] font-bold text-muted">{k === "l" ? "G" : k === "w" ? "P" : "A"}, cm</span>
                    <input className={inputCls} inputMode="decimal" value={b[k]} onChange={(e) => setBoxes((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
                  </label>
                ))}
                <button type="button" className={btn("ghost", "sm", "mb-1")} onClick={() => setBoxes((xs) => xs.filter((_, j) => j !== i))} disabled={boxes.length === 1} aria-label="Noņemt">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button type="button" className={btn("ghost", "sm")} onClick={() => setBoxes((xs) => [...xs, { weight: "1", l: "30", w: "20", h: "10", qty: "1" }])}>
              <Plus className="h-3.5 w-3.5" /> Pievienot kasti
            </button>
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-[12px] font-bold text-muted">Klientam piemērotā piegādes cena € bez PVN (neobligāti)</span>
          <input className={inputCls} inputMode="decimal" value={charge} onChange={(e) => setCharge(e.target.value)} placeholder="piem. 2,89" />
        </label>

        <div className="flex items-center justify-between rounded-xl bg-navy-50/70 px-4 py-3 text-[13px]">
          <span className="flex items-center gap-2 font-bold text-navy-700">
            <CalcIcon className="h-4 w-4" /> {units.length} vien. · {fmtNumber(weight, 1)} kg
          </span>
          {pallet && <span className="text-[12px] font-bold text-orange-700">nepieciešama palete</span>}
          <button
            type="button"
            className={btn("ghost", "sm")}
            onClick={() => {
              setItems([{ size: "5", unit: "l", qty: "1" }]);
              setCharge("");
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <CompareTable options={options} apiCarriers={apiCarriers} showMargin={charge.trim() !== ""} />
        <p className="mt-3 text-[12px] leading-5 text-muted">
          „Cenrāža cena” — publiski pieejamā cena bez līguma (DPD, SmartPosti ar PVN pārrēķinātas uz summu bez PVN), ar avota datumu. Omniva, Venipak, Unisend un kravas
          pārvadājumiem publiska biznesa cenrāža nav — ievadiet savas līguma cenas cilnē „Tarifi”, tad tās parādīsies salīdzinājumā. Neviens no pārvadātāju API nepiedāvā
          reāllaika cenu pieprasījumu, tāpēc tiešsaistes cenas netiek rādītas.
        </p>
      </div>
    </div>
  );
}
