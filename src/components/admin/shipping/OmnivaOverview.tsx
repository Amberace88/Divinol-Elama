"use client";

import Link from "next/link";
import { CheckCircle2, CircleSlash, PlugZap, Settings2 } from "lucide-react";
import { testCarrierConnection } from "@/lib/admin/actions/shipping";
import { fmtMoney } from "@/lib/admin/format";
import { CarrierLogo } from "@/components/shipping/CarrierLogo";
import { cn } from "@/lib/utils";
import { Spinner, useActionRunner } from "../client-ui";
import { btn } from "../styles";

type Market = "LV" | "EE" | "LT";
const MARKETS: Market[] = ["LV", "EE", "LT"];
const MARKET_NAME: Record<Market, string> = { LV: "Latvija", EE: "Igaunija", LT: "Lietuva" };

export type OmnivaPriceRow = {
  id: string;
  label: string;
  max_kg: number | null;
  /** customer price incl. VAT */
  gross: Partial<Record<Market, number>>;
  /** shop cost (net) from the Omniva tariffs, when entered */
  cost: Partial<Record<Market, number>>;
  /** customer price net (for the margin) */
  net: Partial<Record<Market, number>>;
};

/** Omniva at a glance: connection, customer prices per size and country, margin vs. Omniva tariff. */
export function OmnivaOverview({
  api,
  enabled,
  markets,
  freeOver,
  thresholds,
  rows,
}: {
  api: boolean;
  enabled: boolean;
  markets: Market[];
  freeOver: boolean;
  thresholds: Partial<Record<Market, number>>;
  rows: OmnivaPriceRow[];
}) {
  const { run, pending } = useActionRunner();
  return (
    <section className="overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-card">
      <div className="flex flex-wrap items-center gap-4 bg-[linear-gradient(110deg,#fff1e6_0%,#ffffff_70%)] px-5 py-4">
        <CarrierLogo code="omniva" name="Omniva" size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-extrabold text-ink">Omniva pakomāti</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
            {api ? (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> API pieslēgts — sūtījumi, uzlīmes un izsekošana automātiski
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold text-orange-700">
                <CircleSlash className="h-3.5 w-3.5" /> API nav pieslēgts
              </span>
            )}
            <span className={cn("font-semibold", enabled ? "text-ink/70" : "text-red-600")}>{enabled ? "Klientiem piedāvāts kasē" : "Pakomāti izslēgti"}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {api && (
            <button type="button" className={btn("outline", "sm")} disabled={pending} onClick={() => run(() => testCarrierConnection("omniva"), { loading: "Pārbauda savienojumu ar Omniva…" })}>
              {pending ? <Spinner /> : <PlugZap className="h-3.5 w-3.5" />} Pārbaudīt savienojumu
            </button>
          )}
          <Link href="/admin/settings#shipping" className={btn("primary", "sm")}>
            <Settings2 className="h-3.5 w-3.5" /> Mainīt cenas klientiem
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead className="border-y border-line bg-slate-50 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
            <tr>
              <th className="px-5 py-2 text-left">Izmērs</th>
              {MARKETS.map((mk) => (
                <th key={mk} className="px-4 py-2 text-right">
                  {MARKET_NAME[mk]}
                  {!markets.includes(mk) && <span className="ml-1 normal-case text-red-500">(izslēgts)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  <p className="font-bold text-ink">{r.label}</p>
                  {r.max_kg != null && <p className="text-[11.5px] text-muted">sūtījums līdz {String(r.max_kg).replace(".", ",")} kg</p>}
                </td>
                {MARKETS.map((mk) => {
                  const g = r.gross[mk];
                  const cost = r.cost[mk];
                  const net = r.net[mk];
                  const margin = cost != null && net != null ? Math.round((net - cost) * 100) / 100 : null;
                  return (
                    <td key={mk} className={cn("px-4 py-3 text-right tabular-nums", !markets.includes(mk) && "opacity-40")}>
                      <p className="text-[15px] font-extrabold text-navy-700">{g != null ? fmtMoney(g) : "—"}</p>
                      <p className="text-[11px] text-muted">
                        {cost != null ? (
                          <>
                            Omniva {fmtMoney(cost)} ·{" "}
                            <span className={cn("font-bold", margin != null && margin < 0 ? "text-red-600" : "text-emerald-700")}>
                              {margin != null && margin >= 0 ? "+" : ""}
                              {margin != null ? fmtMoney(margin) : ""}
                            </span>
                          </>
                        ) : (
                          "Omniva cena nav ievadīta"
                        )}
                      </p>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line bg-slate-50 px-5 py-2.5 text-[12px] text-muted">
        Cenas klientam ar PVN. {freeOver ? `Bezmaksas virs ${MARKETS.filter((m) => thresholds[m]).map((m) => `${m} ${fmtMoney(thresholds[m]!)}`).join(", ")}. ` : ""}
        „Omniva” = jūsu izmaksas bez PVN no tarifiem zemāk (ievadiet līguma cenas, lai redzētu peļņu par katru sūtījumu).
      </p>
    </section>
  );
}
