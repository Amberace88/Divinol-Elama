"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { History, PackageOpen, Tags } from "lucide-react";
import { getVariantHistory } from "@/lib/admin/actions/inventory";
import { fmtDateTime } from "@/lib/admin/format";
import { fmtDecimal, grossOf, isAvailability, levelOf, MOVEMENT_REASON, STOCK_LEVEL, type HistoryMovement, type HistoryPrice, type InventoryVariant } from "@/lib/admin/inventory";
import { cn } from "@/lib/utils";
import { Drawer, Spinner } from "../client-ui";
import { EmptyState, Pill } from "../ui";

type Data = { movements: HistoryMovement[]; prices: HistoryPrice[] };

export type HistoryTarget = { variant: InventoryVariant; productName: string; pack: string };

export function VariantHistoryDrawer({ target, onClose, vat }: { target: HistoryTarget | null; onClose: () => void; vat: number }) {
  const [state, setState] = useState<{ id: string; data: Data | null; error: string | null } | null>(null);
  const [tab, setTab] = useState<"stock" | "price">("stock");
  const id = target?.variant.id ?? null;

  useEffect(() => {
    if (!id) return;
    let alive = true;
    getVariantHistory(id).then((res) => {
      if (!alive) return;
      setState(res.ok ? { id, data: res.data, error: null } : { id, data: null, error: res.error });
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const current = state && state.id === id ? state : null;
  const v = target?.variant;
  const level = v ? levelOf(v) : null;

  return (
    <Drawer
      open={Boolean(target)}
      onClose={onClose}
      title={target ? `${target.productName}${target.pack ? ` · ${target.pack}` : ""}` : ""}
      description={
        v && (
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{v.sku ?? "bez SKU"}</span>
            {level && <Pill tone={STOCK_LEVEL[level].tone}>{STOCK_LEVEL[level].label}</Pill>}
          </span>
        )
      }
    >
      {v && (
        <div className="mb-5 grid grid-cols-3 gap-2">
          <Stat label={`Cena ar PVN ${vat}%`} value={`${fmtDecimal(grossOf(v.price_net, vat))} €`} sub={`bez PVN ${fmtDecimal(v.price_net, 4, 2)} €`} />
          <Stat label="Atlikums" value={v.stock == null ? "—" : String(v.stock)} sub={v.stock == null ? "netiek uzskaitīts" : `slieksnis ${v.low_stock_threshold}`} />
          <Stat label="Piegāde" value={v.lead_time_days == null ? "—" : `${v.lead_time_days} d.`} sub={v.availability === "on_order" ? "pēc pasūtījuma" : "termiņš"} />
        </div>
      )}

      <div className="mb-4 inline-flex rounded-xl border border-line bg-white p-1 shadow-card" role="tablist">
        {(
          [
            ["stock", "Atlikuma kustība", History],
            ["price", "Cenu vēsture", Tags],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold transition",
              tab === k ? "bg-navy-700 text-white shadow-sm" : "text-muted hover:bg-navy-50 hover:text-navy-700",
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {!current ? (
        <div className="grid place-items-center py-12 text-muted">
          <Spinner className="h-5 w-5" />
        </div>
      ) : current.error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{current.error}</p>
      ) : tab === "stock" ? (
        <Movements rows={current.data!.movements} />
      ) : (
        <Prices rows={current.data!.prices} vat={vat} />
      )}
    </Drawer>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-slate-50/60 px-3 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">{label}</p>
      <p className="mt-0.5 text-[17px] font-extrabold tabular-nums text-ink">{value}</p>
      <p className="text-[11px] text-muted">{sub}</p>
    </div>
  );
}

const statusLabel = (s: string | null) => (s && isAvailability(s) ? STOCK_LEVEL[s].label : s ?? "—");

function Movements({ rows }: { rows: HistoryMovement[] }) {
  if (!rows.length)
    return <EmptyState icon={PackageOpen} title="Kustību vēl nav" description="Šeit parādīsies pasūtījumi, atcelšanas, manuālas un importa izmaiņas." />;
  return (
    <ol className="relative space-y-3 border-l border-line pl-4">
      {rows.map((m) => {
        const r = MOVEMENT_REASON[m.reason] ?? { label: m.reason, tone: "gray" as const };
        const statusChanged = m.availability_before !== m.availability_after && m.availability_before != null;
        return (
          <li key={m.id} className="relative">
            <span className={cn("absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white", m.delta > 0 ? "bg-emerald-500" : m.delta < 0 ? "bg-red-500" : "bg-slate-400")} aria-hidden />
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              {m.delta !== 0 && (
                <span className={cn("font-extrabold tabular-nums", m.delta > 0 ? "text-emerald-700" : "text-red-700")}>
                  {m.delta > 0 ? "+" : "−"}
                  {Math.abs(m.delta)}
                </span>
              )}
              {(m.stock_before != null || m.stock_after != null) && (
                <span className="tabular-nums text-muted">
                  {m.stock_before ?? "—"} → <strong className="text-ink">{m.stock_after ?? "—"}</strong>
                </span>
              )}
              <Pill tone={r.tone} dot={false}>
                {r.label}
              </Pill>
              {m.order && (
                <Link href={`/admin/orders/${m.order.id}`} className="font-bold text-navy-600 hover:underline">
                  {m.order.number}
                </Link>
              )}
            </div>
            {statusChanged && (
              <p className="mt-0.5 text-[12px] text-ink/80">
                Statuss: {statusLabel(m.availability_before)} → <strong>{statusLabel(m.availability_after)}</strong>
              </p>
            )}
            {m.note && <p className="mt-0.5 text-[12px] text-muted">{m.note}</p>}
            <p className="mt-0.5 text-[11px] text-muted">
              {fmtDateTime(m.created_at)}
              {m.by && <> · {m.by}</>}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function Prices({ rows, vat }: { rows: HistoryPrice[]; vat: number }) {
  if (!rows.length) return <EmptyState icon={Tags} title="Cenu izmaiņu vēl nav" description="Katra cenas maiņa tiek saglabāta ar laiku un lietotāju." />;
  return (
    <ul className="divide-y divide-line/70 rounded-xl border border-line">
      {rows.map((p) => {
        const r = MOVEMENT_REASON[p.reason] ?? { label: p.reason, tone: "gray" as const };
        const diff = p.old_net ? ((p.new_net - p.old_net) / p.old_net) * 100 : null;
        return (
          <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-[13px]">
            <span className="tabular-nums text-muted">{p.old_net == null ? "—" : `${fmtDecimal(grossOf(p.old_net, vat))} €`}</span>
            <span aria-hidden className="text-muted">→</span>
            <span className="font-bold tabular-nums text-ink">{fmtDecimal(grossOf(p.new_net, vat))} €</span>
            {diff != null && Number.isFinite(diff) && (
              <span className={cn("text-[12px] font-bold tabular-nums", diff > 0 ? "text-emerald-700" : diff < 0 ? "text-red-700" : "text-muted")}>
                {diff > 0 ? "+" : ""}
                {fmtDecimal(diff, 1, 0)}%
              </span>
            )}
            <Pill tone={r.tone} dot={false} className="ml-auto">
              {r.label}
            </Pill>
            <p className="w-full text-[11px] text-muted">
              bez PVN {p.old_net == null ? "—" : fmtDecimal(p.old_net, 4, 2)} → {fmtDecimal(p.new_net, 4, 2)} € · {fmtDateTime(p.created_at)}
              {p.by && <> · {p.by}</>}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
