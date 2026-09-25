"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { bulkSaveInventory } from "@/lib/admin/actions/inventory";
import {
  AVAILABILITIES,
  fmtDecimal,
  grossOf,
  netOf,
  parseDecimal,
  ROUNDING_LABEL,
  roundGross,
  STOCK_LEVEL,
  type Availability,
  type InventoryChange,
  type InventoryRow,
  type InventoryVariant,
  type Rounding,
} from "@/lib/admin/inventory";
import { cn } from "@/lib/utils";
import { Field, Modal, Spinner, useActionRunner, useConfirm } from "../client-ui";
import { btn, inputCls, selectCls } from "../styles";

export type BulkMode = "status" | "stock" | "price";
export type BulkItem = { variant: InventoryVariant; productName: string; pack: string };

const TABS: { id: BulkMode; label: string }[] = [
  { id: "status", label: "Statuss" },
  { id: "stock", label: "Atlikums" },
  { id: "price", label: "Cenas" },
];

const variantsWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "variantam" : "variantiem");

export function BulkInventoryModal({
  open,
  mode,
  onMode,
  onClose,
  items,
  vat,
  onApplied,
}: {
  open: boolean;
  mode: BulkMode;
  onMode: (m: BulkMode) => void;
  onClose: () => void;
  items: BulkItem[];
  vat: number;
  onApplied: (rows: InventoryRow[]) => void;
}) {
  const { run, pending } = useActionRunner();
  const confirm = useConfirm();

  // status
  const [status, setStatus] = useState<Availability>("in_stock");
  const [lead, setLead] = useState("");
  // stock
  const [stockMode, setStockMode] = useState<"set" | "adjust" | "untrack">("set");
  const [stockVal, setStockVal] = useState("");
  // price
  const [priceKind, setPriceKind] = useState<"percent" | "fixed">("percent");
  const [priceVal, setPriceVal] = useState("");
  const [rounding, setRounding] = useState<Rounding>("none");
  const [threshold, setThreshold] = useState("");

  const n = items.length;

  const pricePreview = useMemo(() => {
    const val = parseDecimal(priceVal);
    if (val == null || Number.isNaN(val)) return null;
    return items.map((it) => {
      const oldGross = grossOf(it.variant.price_net, vat);
      const raw = priceKind === "percent" ? oldGross * (1 + val / 100) : oldGross + val;
      const newGross = Math.max(0, roundGross(raw, rounding));
      return { ...it, oldGross, newGross, newNet: netOf(newGross, vat) };
    });
  }, [items, priceVal, priceKind, rounding, vat]);

  function build(): { changes: InventoryChange[]; summary: string } | { error: string } {
    const ids = items.map((i) => i.variant.id);
    if (!ids.length) return { error: "Nav atlasītu variantu" };
    if (mode === "status") {
      let lt: number | null | undefined = undefined;
      if (status === "on_order" || status === "out_of_stock") {
        if (lead.trim()) {
          const x = Number(lead.trim());
          if (!Number.isInteger(x) || x < 0 || x > 365) return { error: "Termiņam jābūt 0–365 dienām" };
          lt = x;
        }
      }
      const t = threshold.trim() ? Number(threshold.trim()) : undefined;
      if (t !== undefined && (!Number.isInteger(t) || t < 0)) return { error: "Nederīgs zema atlikuma slieksnis" };
      return {
        changes: ids.map((id) => ({
          variant_id: id,
          availability: status,
          ...(lt !== undefined ? { lead_time_days: lt } : {}),
          ...(t !== undefined ? { low_stock_threshold: t } : {}),
        })),
        summary: `Statuss “${STOCK_LEVEL[status].label}”${lt != null ? `, piegāde ${lt} d.` : ""}${t !== undefined ? `, slieksnis ${t}` : ""}`,
      };
    }
    if (mode === "stock") {
      if (stockMode === "untrack") return { changes: ids.map((id) => ({ variant_id: id, stock: null })), summary: "Izslēgt atlikuma uzskaiti" };
      const x = Number(stockVal.trim());
      if (!stockVal.trim() || !Number.isInteger(x)) return { error: "Ievadiet veselu skaitli" };
      if (stockMode === "set") {
        if (x < 0) return { error: "Atlikums nevar būt negatīvs" };
        return { changes: ids.map((id) => ({ variant_id: id, stock: x })), summary: `Atlikums = ${x}` };
      }
      if (x === 0) return { error: "Izmaiņa nevar būt 0" };
      return { changes: ids.map((id) => ({ variant_id: id, stock_delta: x })), summary: `Atlikums ${x > 0 ? "+" : ""}${x} (ne mazāk par 0)` };
    }
    if (!pricePreview) return { error: "Ievadiet izmaiņas vērtību" };
    const changed = pricePreview.filter((p) => p.newNet !== p.variant.price_net);
    if (!changed.length) return { error: "Cenas nemainās" };
    if (pricePreview.some((p) => p.newGross <= 0)) return { error: "Kādai cenai rezultāts būtu 0 € vai mazāk — samaziniet izmaiņu" };
    return {
      changes: changed.map((p) => ({ variant_id: p.variant.id, price_net: p.newNet })),
      summary: `Cenas ${priceKind === "percent" ? `${priceVal}%` : `${priceVal} €`} (ar PVN)${rounding !== "none" ? `, ${ROUNDING_LABEL[rounding].toLowerCase()}` : ""}`,
    };
  }

  async function submit() {
    const b = build();
    if ("error" in b) {
      toast.error(b.error);
      return;
    }
    const ok = await confirm({
      title: `Piemērot izmaiņas ${b.changes.length} ${variantsWord(b.changes.length)}?`,
      description: `${b.summary}. Izmaiņas tiks saglabātas vēsturē kā grupas darbība, un veikals atjaunosies uzreiz.`,
      confirmLabel: "Piemērot",
      danger: mode === "price" || (mode === "stock" && stockMode !== "adjust"),
    });
    if (!ok) return;
    run(() => bulkSaveInventory(b.changes, b.summary), {
      loading: "Saglabā izmaiņas…",
      onSuccess: (d) => {
        onApplied(d.rows);
        onClose();
      },
    });
  }

  const seg = (active: boolean) =>
    cn("rounded-lg px-3 py-1.5 text-[13px] font-bold transition", active ? "bg-navy-700 text-white shadow-sm" : "text-muted hover:bg-navy-50 hover:text-navy-700");

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      size="lg"
      title="Grupas izmaiņas"
      description={`Atlasīti ${n} ${n === 1 ? "variants" : "varianti"}`}
      footer={
        <>
          <button type="button" className={btn("outline")} onClick={onClose} disabled={pending}>
            Atcelt
          </button>
          <button type="button" className={btn("dark")} onClick={submit} disabled={pending || !n}>
            {pending && <Spinner />} Priekšskatīt un piemērot
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="inline-flex rounded-xl border border-line bg-white p-1 shadow-card" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={mode === t.id} className={seg(mode === t.id)} onClick={() => onMode(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {mode === "status" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Jaunais statuss" htmlFor="bulk-status" className="sm:col-span-3" hint={STOCK_LEVEL[status].hint}>
              <select id="bulk-status" className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as Availability)}>
                {AVAILABILITIES.map((a) => (
                  <option key={a} value={a}>
                    {STOCK_LEVEL[a].label}
                  </option>
                ))}
              </select>
            </Field>
            {(status === "on_order" || status === "out_of_stock") && (
              <Field label="Piegādes termiņš (dienas)" htmlFor="bulk-lead" hint="Tukšs = nemainīt">
                <input id="bulk-lead" className={inputCls} inputMode="numeric" value={lead} onChange={(e) => setLead(e.target.value.replace(/[^\d]/g, ""))} placeholder="piem. 7" />
              </Field>
            )}
            <Field label="Zema atlikuma slieksnis" htmlFor="bulk-thr" hint="Tukšs = nemainīt">
              <input id="bulk-thr" className={inputCls} inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value.replace(/[^\d]/g, ""))} placeholder="piem. 3" />
            </Field>
          </div>
        )}

        {mode === "stock" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Darbība" htmlFor="bulk-stock-mode">
              <select id="bulk-stock-mode" className={selectCls} value={stockMode} onChange={(e) => setStockMode(e.target.value as typeof stockMode)}>
                <option value="set">Iestatīt atlikumu</option>
                <option value="adjust">Palielināt / samazināt par</option>
                <option value="untrack">Izslēgt atlikuma uzskaiti</option>
              </select>
            </Field>
            {stockMode !== "untrack" && (
              <Field
                label={stockMode === "set" ? "Atlikums" : "Izmaiņa (piem. 10 vai -5)"}
                htmlFor="bulk-stock"
                hint={stockMode === "set" ? "Ja atlikums ir 0, statuss “Noliktavā” automātiski mainās uz “Nav noliktavā”." : "Atlikums nekad nekļūst negatīvs."}
              >
                <input id="bulk-stock" className={inputCls} inputMode="numeric" value={stockVal} onChange={(e) => setStockVal(e.target.value.replace(/[^\d-]/g, ""))} placeholder="0" />
              </Field>
            )}
            {stockMode === "untrack" && (
              <p className="self-end rounded-xl bg-slate-50 px-3.5 py-2.5 text-[13px] text-muted sm:col-span-1">
                Atlikums netiks skaitīts un pasūtījumi to nesamazinās. Statuss paliek, kā iestatīts.
              </p>
            )}
          </div>
        )}

        {mode === "price" && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Izmaiņas veids" htmlFor="bulk-price-kind">
                <select id="bulk-price-kind" className={selectCls} value={priceKind} onChange={(e) => setPriceKind(e.target.value as typeof priceKind)}>
                  <option value="percent">Procentos (%)</option>
                  <option value="fixed">Fiksēta summa (€ ar PVN)</option>
                </select>
              </Field>
              <Field label={priceKind === "percent" ? "Izmaiņa, % (piem. 5 vai -10)" : "Izmaiņa, € (piem. 1,50 vai -2)"} htmlFor="bulk-price">
                <input id="bulk-price" className={inputCls} inputMode="decimal" value={priceVal} onChange={(e) => setPriceVal(e.target.value.replace(/[^\d.,-]/g, ""))} placeholder="0" autoFocus />
              </Field>
              <Field label="Noapaļošana (cenai ar PVN)" htmlFor="bulk-round">
                <select id="bulk-round" className={selectCls} value={rounding} onChange={(e) => setRounding(e.target.value as Rounding)}>
                  {(Object.keys(ROUNDING_LABEL) as Rounding[]).map((r) => (
                    <option key={r} value={r}>
                      {ROUNDING_LABEL[r]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="flex items-center justify-between border-b border-line bg-slate-50 px-3.5 py-2 text-[12px] font-bold uppercase tracking-[0.06em] text-muted">
                <span>Priekšskatījums</span>
                <span className="normal-case tracking-normal">ar PVN {vat}% · saglabā cenu bez PVN</span>
              </div>
              {!pricePreview ? (
                <p className="px-3.5 py-6 text-center text-[13px] text-muted">Ievadiet izmaiņu, lai redzētu jaunās cenas.</p>
              ) : (
                <ul className="max-h-[300px] divide-y divide-line/70 overflow-y-auto">
                  {pricePreview.map((p) => (
                    <li key={p.variant.id} className="flex items-center gap-3 px-3.5 py-2 text-[13px]">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-semibold text-ink">{p.productName}</span>
                        <span className="text-muted"> · {p.pack || p.variant.sku || "—"}</span>
                      </span>
                      <span className="tabular-nums text-muted">{fmtDecimal(p.oldGross)} €</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted" aria-hidden />
                      <span className={cn("w-20 text-right font-bold tabular-nums", p.newGross > p.oldGross ? "text-emerald-700" : p.newGross < p.oldGross ? "text-red-700" : "text-ink")}>
                        {fmtDecimal(p.newGross)} €
                      </span>
                      <span className="hidden w-24 text-right text-[11px] tabular-nums text-muted sm:inline">{fmtDecimal(p.newNet, 4, 2)} bez PVN</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {mode !== "price" && (
          <details className="rounded-xl border border-line text-[13px]">
            <summary className="cursor-pointer px-3.5 py-2 font-semibold text-muted">Atlasītie varianti ({n})</summary>
            <ul className="max-h-[220px] divide-y divide-line/70 overflow-y-auto border-t border-line">
              {items.map((it) => (
                <li key={it.variant.id} className="flex items-center gap-2 px-3.5 py-1.5">
                  <span className="min-w-0 flex-1 truncate">
                    {it.productName} <span className="text-muted">· {it.pack || "—"}</span>
                  </span>
                  <span className="font-mono text-[11px] text-muted">{it.variant.sku ?? ""}</span>
                  <span className="w-10 text-right tabular-nums">{it.variant.stock ?? "—"}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Modal>
  );
}
