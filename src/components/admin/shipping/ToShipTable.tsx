"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, PackagePlus, Printer } from "lucide-react";
import { createShipmentsBulk } from "@/lib/admin/actions/shipping";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/admin/format";
import { labelOf, PAYMENT_STATUS, SHIPPING_METHOD } from "@/lib/admin/labels";
import type { CompareOption } from "@/lib/shipping/compare";
import { cn } from "@/lib/utils";
import { Modal, Spinner, useActionRunner } from "../client-ui";
import { btn, selectCls } from "../styles";
import { EmptyState, Pill, td, th } from "../ui";
import { NewShipmentForm } from "./NewShipmentForm";
import { CarrierLogo } from "@/components/shipping/CarrierLogo";

export type ToShipRow = {
  id: string;
  number: string;
  created_at: string;
  customer: string;
  market: string;
  shipping_method: string;
  payment_status: string;
  point: string | null;
  items: string;
  weightKg: number;
  customerPaidNet: number;
  options: CompareOption[];
  recommendedKey: string | null;
};

type Result = { orderId: string; ok: boolean; message: string; shipmentId?: string };

export function ToShipTable({ rows, apiCarriers }: { rows: ToShipRow[]; apiCarriers: string[] }) {
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [choice, setChoice] = useState<Record<string, string | null>>(() => Object.fromEntries(rows.map((r) => [r.id, r.recommendedKey])));
  const [results, setResults] = useState<Result[] | null>(null);
  const [detail, setDetail] = useState<ToShipRow | null>(null);

  const all = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const totals = useMemo(() => {
    let cost = 0;
    let paid = 0;
    let missing = 0;
    for (const r of rows) {
      if (!selected.has(r.id)) continue;
      const o = r.options.find((x) => x.key === choice[r.id]);
      if (o?.totalNet != null) cost += o.totalNet;
      else missing++;
      paid += r.customerPaidNet;
    }
    return { cost, paid, missing };
  }, [rows, selected, choice]);

  const create = (ids: string[]) => {
    const payload = ids.map((id) => {
      const o = rows.find((r) => r.id === id)?.options.find((x) => x.key === choice[id]);
      return { orderId: id, carrier: o?.carrier ?? null, serviceCode: o?.serviceCode ?? null };
    });
    run(() => createShipmentsBulk(payload), {
      loading: `Veido ${ids.length} sūtījumu(s)…`,
      onSuccess: (d) => {
        setResults(d);
        setSelected(new Set());
        router.refresh();
      },
    });
  };

  if (rows.length === 0 && !results) {
    return <EmptyState icon={PackageCheck} title="Viss nosūtīts" description="Nav apmaksātu vai apstiprinātu pasūtījumu, kuriem vēl nav sūtījuma." />;
  }

  const createdIds = (results ?? []).filter((r) => r.ok && r.shipmentId).map((r) => r.shipmentId!);

  return (
    <div>
      {results && (
        <div className="border-b border-line bg-slate-50/60 px-5 py-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-bold text-ink">Rezultāts</p>
            <div className="flex gap-2">
              {createdIds.length > 0 && (
                <a href={`/api/admin/shipments/labels?ids=${createdIds.join(",")}`} target="_blank" rel="noopener" className={btn("dark", "sm")}>
                  <Printer className="h-3.5 w-3.5" /> Drukāt visas uzlīmes ({createdIds.length})
                </a>
              )}
              <button type="button" className={btn("ghost", "sm")} onClick={() => setResults(null)}>
                Aizvērt
              </button>
            </div>
          </div>
          <ul className="space-y-1 text-[12.5px]">
            {results.map((r) => (
              <li key={r.orderId} className={r.ok ? "text-emerald-700" : "text-red-600"}>
                {r.ok ? "✓" : "✗"} {r.message}
              </li>
            ))}
          </ul>
          {createdIds.length > 0 && <p className="mt-2 text-[12px] text-muted">Manuālā režīma sūtījumiem uzlīmi augšupielādējiet cilnē „Sūtījumi” — tie drukā tiks izlaisti.</p>}
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-navy-700 px-5 py-3 text-white">
          <span className="text-[13px] font-bold">Atzīmēti: {selected.size}</span>
          <span className="text-[12px] text-white/70">
            Izmaksas {fmtMoney(totals.cost)}
            {totals.missing ? ` + ${totals.missing} bez cenas` : ""} · klienti samaksāja {fmtMoney(totals.paid)}
          </span>
          <button type="button" className={btn("primary", "sm", "ml-auto")} disabled={pending} onClick={() => create([...selected])}>
            {pending ? <Spinner /> : <PackagePlus className="h-3.5 w-3.5" />} Izveidot sūtījumus
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-[13px]">
            <thead>
              <tr>
                <th className={cn(th, "w-10")}>
                  <input type="checkbox" className="h-4 w-4 accent-navy-700" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Atzīmēt visus" />
                </th>
                <th className={th}>Pasūtījums</th>
                <th className={th}>Piegāde</th>
                <th className={th}>Preces</th>
                <th className={th}>Ieteicamais pārvadātājs</th>
                <th className={cn(th, "text-right")}>Izmaksas</th>
                <th className={cn(th, "text-right")}>Starpība</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const valid = r.options.filter((o) => o.valid);
                const o = r.options.find((x) => x.key === choice[r.id]) ?? null;
                const pay = labelOf(PAYMENT_STATUS, r.payment_status);
                const margin = o?.totalNet != null ? r.customerPaidNet - o.totalNet : null;
                return (
                  <tr key={r.id} className={cn("transition-colors hover:bg-navy-50/30", selected.has(r.id) && "bg-navy-50/50")}>
                    <td className={td}>
                      <input type="checkbox" className="h-4 w-4 accent-navy-700" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Atzīmēt ${r.number}`} />
                    </td>
                    <td className={td}>
                      <Link href={`/admin/orders/${r.id}#piegade`} className="font-bold text-navy-700 hover:underline">
                        {r.number}
                      </Link>
                      <p className="text-[12px] text-muted">
                        {r.customer} · {fmtDate(r.created_at)}
                      </p>
                      {r.payment_status !== "paid" && (
                        <Pill tone={pay.tone} dot={false} className="mt-1">
                          {pay.label}
                        </Pill>
                      )}
                    </td>
                    <td className={td}>
                      <p className="font-semibold text-ink">
                        {SHIPPING_METHOD[r.shipping_method] ?? r.shipping_method} · {r.market}
                      </p>
                      {r.point && <p className="max-w-[220px] truncate text-[12px] text-muted">{r.point}</p>}
                    </td>
                    <td className={cn(td, "max-w-[220px]")}>
                      <p className="truncate text-[12px] text-ink/80" title={r.items}>
                        {r.items}
                      </p>
                      <p className="text-[12px] text-muted">~{fmtNumber(r.weightKg, 1)} kg</p>
                    </td>
                    <td className={td}>
                      {valid.length ? (
                        <div className="flex items-center gap-2">
                        <CarrierLogo code={valid.find((x) => x.key === choice[r.id])?.carrier ?? valid[0]?.carrier} name={valid.find((x) => x.key === choice[r.id])?.carrierName ?? valid[0]?.carrierName} />
                        <select
                          className={cn(selectCls, "h-9 min-w-[210px] text-[12.5px]")}
                          value={choice[r.id] ?? ""}
                          onChange={(e) => setChoice((c) => ({ ...c, [r.id]: e.target.value }))}
                          aria-label="Pārvadātājs"
                        >
                          {valid.map((x) => (
                            <option key={x.key} value={x.key}>
                              {x.carrierName} · {x.serviceName}
                              {x.totalNet != null ? ` — ${fmtMoney(x.totalNet)}` : " — līguma cena"}
                              {x.badges.includes("cheapest") ? " ★" : ""}
                              {apiCarriers.includes(x.carrier) ? " · API" : ""}
                            </option>
                          ))}
                        </select>
                        </div>
                      ) : (
                        <span className="text-[12px] font-semibold text-red-600">{r.options[0]?.reason ?? "Nav tarifu"}</span>
                      )}
                      {o && o.parcels.length > 1 && <p className="mt-1 text-[11.5px] text-muted">{o.parcels.length} pakas</p>}
                    </td>
                    <td className={cn(td, "text-right tabular-nums")}>
                      {o?.totalNet != null ? fmtMoney(o.totalNet) : <span className="text-[12px] text-orange-700">—</span>}
                      <p className="text-[11px] text-muted">klients {fmtMoney(r.customerPaidNet)}</p>
                    </td>
                    <td className={cn(td, "text-right font-bold tabular-nums", margin == null ? "text-muted" : margin >= 0 ? "text-emerald-700" : "text-red-600")}>
                      {margin == null ? "—" : `${margin >= 0 ? "+" : "−"}${fmtMoney(Math.abs(margin))}`}
                    </td>
                    <td className={cn(td, "whitespace-nowrap text-right")}>
                      <button type="button" className={btn("outline", "sm")} onClick={() => setDetail(r)}>
                        Salīdzināt
                      </button>{" "}
                      <button type="button" className={btn("dark", "sm")} disabled={pending || !o} onClick={() => create([r.id])}>
                        Izveidot sūtījumu
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} size="lg" title={detail ? `Piegāde — ${detail.number}` : ""} description={detail ? `${detail.items} · ~${fmtNumber(detail.weightKg, 1)} kg` : undefined}>
        {detail && <NewShipmentForm orderId={detail.id} options={detail.options} apiCarriers={apiCarriers} initialKey={choice[detail.id]} onDone={() => setDetail(null)} />}
      </Modal>
    </div>
  );
}
