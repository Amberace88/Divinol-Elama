"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus, Plus, Trash2 } from "lucide-react";
import { createShipmentAction } from "@/lib/admin/actions/shipping";
import { fmtNumber } from "@/lib/admin/format";
import type { CompareOption } from "@/lib/shipping/compare";
import { cn } from "@/lib/utils";
import { Spinner, useActionRunner } from "../client-ui";
import { btn, inputCls } from "../styles";
import { CompareTable } from "./CompareTable";

type P = { weight: string; l: string; w: string; h: string; sizeCode: string | null };

const toP = (o: CompareOption | null): P[] =>
  o && o.parcels.length ? o.parcels.map((p) => ({ weight: String(p.weightKg), l: "", w: "", h: "", sizeCode: p.sizeCode })) : [{ weight: "1", l: "", w: "", h: "", sizeCode: null }];

const num = (s: string) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Create a shipment for an order: pick a carrier service from the comparison, adjust parcels, API or manual. */
export function NewShipmentForm({
  orderId,
  options,
  apiCarriers,
  initialKey,
  onDone,
}: {
  orderId: string;
  options: CompareOption[];
  apiCarriers: string[];
  initialKey?: string | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const first = options.find((o) => o.key === initialKey) ?? options.find((o) => o.valid && o.totalNet != null) ?? options.find((o) => o.valid) ?? null;
  const [sel, setSel] = useState<CompareOption | null>(first);
  const [parcels, setParcels] = useState<P[]>(toP(first));
  const [manualCode, setManualCode] = useState("");
  const [cost, setCost] = useState("");
  const [markShipped, setMarkShipped] = useState(false);
  const api = sel ? apiCarriers.includes(sel.carrier) : false;
  const [useApi, setUseApi] = useState(api);
  const mode: "api" | "manual" = api && useApi ? "api" : "manual";

  const choose = (o: CompareOption) => {
    setSel(o);
    setParcels(toP(o));
    setUseApi(apiCarriers.includes(o.carrier));
  };

  const setP = (i: number, k: keyof P, v: string) => setParcels((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const total = parcels.reduce((s, p) => s + (num(p.weight) ?? 0), 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sel) return;
    run(
      () =>
        createShipmentAction({
          orderId,
          carrier: sel.carrier,
          serviceCode: sel.serviceCode,
          mode,
          parcels: parcels.map((p) => ({ weightKg: num(p.weight) ?? 0, l: num(p.l), w: num(p.w), h: num(p.h), sizeCode: p.sizeCode })),
          trackingNumber: mode === "manual" ? manualCode : null,
          costNet: cost.trim() ? Number(cost.replace(",", ".")) : null,
          markShipped,
        }),
      {
        loading: mode === "api" ? `Veido sūtījumu ${sel.carrierName} sistēmā…` : "Saglabā…",
        onSuccess: () => {
          onDone?.();
          router.refresh();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <CompareTable options={options} apiCarriers={apiCarriers} selected={sel?.key} onSelect={choose} showMargin />

      {sel && (
        <div className="grid gap-4 rounded-xl border border-line bg-slate-50/50 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">
              Pakas · {sel.carrierName} {sel.serviceName} · kopā {fmtNumber(total, 2)} kg
            </p>
            <div className="space-y-2">
              {parcels.map((p, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <span className="w-6 pb-2.5 text-[12px] font-bold text-muted">{i + 1}.</span>
                  <label className="w-24">
                    <span className="mb-1 block text-[11px] font-bold text-muted">Svars, kg</span>
                    <input className={inputCls} inputMode="decimal" value={p.weight} onChange={(e) => setP(i, "weight", e.target.value)} aria-label={`Pakas ${i + 1} svars`} />
                  </label>
                  {(["l", "w", "h"] as const).map((k) => (
                    <label key={k} className="w-20">
                      <span className="mb-1 block text-[11px] font-bold text-muted">{k === "l" ? "Garums" : k === "w" ? "Platums" : "Augstums"}, cm</span>
                      <input className={inputCls} inputMode="decimal" value={p[k]} onChange={(e) => setP(i, k, e.target.value)} placeholder="—" />
                    </label>
                  ))}
                  {p.sizeCode && <span className="pb-2.5 text-[12px] font-bold text-navy-600">{p.sizeCode}</span>}
                  {parcels.length > 1 && (
                    <button type="button" className={btn("ghost", "sm", "mb-1")} onClick={() => setParcels((ps) => ps.filter((_, j) => j !== i))} aria-label="Noņemt paku">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className={btn("ghost", "sm", "mt-2")} onClick={() => setParcels((ps) => [...ps, { weight: "1", l: "", w: "", h: "", sizeCode: null }])}>
              <Plus className="h-3.5 w-3.5" /> Pievienot paku
            </button>
          </div>

          <div className="space-y-3">
            <div role="radiogroup" aria-label="Režīms" className="grid grid-cols-2 gap-1 rounded-lg bg-white p-1 ring-1 ring-line">
              {(["api", "manual"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  disabled={m === "api" && !api}
                  onClick={() => setUseApi(m === "api")}
                  title={m === "api" && !api ? "API nav pieslēgts (Tarifi → Pārvadātāji)" : undefined}
                  className={cn("h-8 rounded-md text-[12px] font-bold transition disabled:opacity-40", mode === m ? "bg-navy-700 text-white" : "text-muted hover:text-ink")}
                >
                  {m === "api" ? "Caur API" : "Manuāli"}
                </button>
              ))}
            </div>
            {mode === "manual" ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-bold text-muted">Sūtījuma kods (var ievadīt vēlāk)</span>
                  <input className={inputCls} value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="no pārvadātāja portāla" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-bold text-muted">Faktiskās izmaksas € (bez PVN)</span>
                  <input className={inputCls} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder={sel.totalNet != null ? String(sel.totalNet) : "—"} />
                </label>
              </>
            ) : (
              <p className="text-[12px] leading-5 text-muted">Sūtījums tiks reģistrēts {sel.carrierName} sistēmā, sūtījuma kods un uzlīme (PDF) būs pieejami uzreiz.</p>
            )}
            <label className="flex items-center gap-2 text-[13px] text-ink/80">
              <input type="checkbox" checked={markShipped} onChange={(e) => setMarkShipped(e.target.checked)} className="h-4 w-4 accent-navy-700" />
              Uzreiz atzīmēt pasūtījumu kā „Nosūtīts”
            </label>
            <button type="submit" className={btn("primary", "md", "w-full")} disabled={pending || !sel.valid || total <= 0}>
              {pending ? <Spinner /> : <PackagePlus className="h-4 w-4" />} Izveidot sūtījumu
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
