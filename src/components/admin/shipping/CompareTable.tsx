"use client";

import { ExternalLink, Plug, Zap } from "lucide-react";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/admin/format";
import { transitLabel, type CompareOption } from "@/lib/shipping/compare";
import { SERVICE_TYPE_LABEL } from "@/lib/shipping/tracking";
import { cn } from "@/lib/utils";
import { Pill, td, th } from "../ui";

/** "Piegādes cenu salīdzinājums" table (order page + calculator). */
export function CompareTable({
  options,
  apiCarriers,
  selected,
  onSelect,
  showMargin,
  compact,
}: {
  options: CompareOption[];
  apiCarriers: string[];
  selected?: string | null;
  onSelect?: (o: CompareOption) => void;
  showMargin?: boolean;
  compact?: boolean;
}) {
  if (options.length === 0) {
    return <p className="rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-muted">Šai valstij un piegādes veidam nav neviena aktīva tarifa. Pievienojiet tarifu cilnē „Tarifi”.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-[13px]">
        <thead>
          <tr>
            {onSelect && <th className={cn(th, "w-8")} aria-label="Izvēle" />}
            <th className={th}>Pārvadātājs / pakalpojums</th>
            <th className={th}>Pakas</th>
            <th className={cn(th, "text-right")}>Izmaksas (bez PVN)</th>
            {!compact && <th className={th}>Piegāde</th>}
            {showMargin && <th className={cn(th, "text-right")}>Starpība</th>}
          </tr>
        </thead>
        <tbody>
          {options.map((o) => {
            const api = apiCarriers.includes(o.carrier);
            const isSel = selected === o.key;
            return (
              <tr
                key={o.key}
                onClick={() => o.valid && onSelect?.(o)}
                className={cn(
                  "transition-colors",
                  !o.valid && "opacity-55",
                  onSelect && o.valid && "cursor-pointer hover:bg-navy-50/40",
                  isSel && "bg-navy-50/70",
                )}
              >
                {onSelect && (
                  <td className={td}>
                    <input
                      type="radio"
                      name="compare-option"
                      checked={isSel}
                      disabled={!o.valid}
                      onChange={() => onSelect(o)}
                      className="h-4 w-4 accent-navy-700"
                      aria-label={`${o.carrierName} ${o.serviceName}`}
                    />
                  </td>
                )}
                <td className={td}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-ink">{o.carrierName}</span>
                    {o.badges.includes("cheapest") && <Pill tone="green">Lētākais</Pill>}
                    {o.badges.includes("fastest") && (
                      <Pill tone="blue" dot={false}>
                        <Zap className="h-3 w-3" /> Ātrākais
                      </Pill>
                    )}
                    {api && (
                      <span title="API pieslēgts — sūtījumu un uzlīmi var izveidot automātiski" className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                        <Plug className="h-3 w-3" /> API
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-muted">
                    {o.serviceName} · {SERVICE_TYPE_LABEL[o.type] ?? o.type}
                  </p>
                  {!o.valid && o.reason && <p className="mt-0.5 text-[12px] font-semibold text-red-600">{o.reason}</p>}
                </td>
                <td className={cn(td, "text-[12px]")}>
                  {o.valid ? (
                    <>
                      <span className="font-semibold text-ink">{o.parcels.length}×</span>{" "}
                      <span className="text-muted">
                        {summarizeParcels(o)} · {fmtNumber(o.totalWeightKg, 1)} kg
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={cn(td, "text-right")}>
                  {o.totalNet != null ? (
                    <>
                      <span className="text-[14px] font-extrabold tabular-nums text-ink">{fmtMoney(o.totalNet)}</span>
                      <p className="text-[11px] text-muted">
                        {o.priceKind === "contract" ? "līguma cena" : "cenrāža cena"}
                        {o.sourceDate && ` · ${fmtDate(o.sourceDate)}`}
                        {o.sourceUrl && (
                          <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex align-middle text-navy-500 hover:text-navy-700" onClick={(e) => e.stopPropagation()} title="Avots">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </p>
                    </>
                  ) : o.valid ? (
                    <span className="text-[12px] font-semibold text-orange-700">jāievada līguma cena</span>
                  ) : (
                    "—"
                  )}
                </td>
                {!compact && <td className={cn(td, "whitespace-nowrap text-[12px] text-muted")}>{transitLabel(o.transitMin, o.transitMax)}</td>}
                {showMargin && (
                  <td className={cn(td, "text-right tabular-nums")}>
                    {o.marginNet != null ? (
                      <span className={cn("font-bold", o.marginNet >= 0 ? "text-emerald-700" : "text-red-600")}>
                        {o.marginNet >= 0 ? "+" : "−"}
                        {fmtMoney(Math.abs(o.marginNet))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function summarizeParcels(o: CompareOption) {
  const counts = new Map<string, number>();
  for (const p of o.parcels) counts.set(p.sizeCode ?? "—", (counts.get(p.sizeCode ?? "—") ?? 0) + 1);
  return [...counts.entries()].map(([k, n]) => (n > 1 ? `${n}×${k}` : k)).join(", ");
}
