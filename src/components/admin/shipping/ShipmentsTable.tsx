"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Printer, RefreshCw, Truck } from "lucide-react";
import { refreshTrackingBulk } from "@/lib/admin/actions/shipping";
import { fmtDateTime, fmtMoney } from "@/lib/admin/format";
import type { ShipmentRow } from "@/lib/shipping/service";
import { buildTrackingUrl, SERVICE_TYPE_LABEL, SHIPMENT_STATUS_LABEL } from "@/lib/shipping/tracking";
import { cn } from "@/lib/utils";
import { Drawer, Spinner, useActionRunner } from "../client-ui";
import { btn } from "../styles";
import { EmptyState, Pill, td, th } from "../ui";
import { ShipmentCard, type CarrierInfo } from "./ShipmentCard";

export type ShipmentListRow = ShipmentRow & { order_number: string | null };

export function ShipmentsTable({ rows, carriers, filtered }: { rows: ShipmentListRow[]; carriers: CarrierInfo[]; filtered: boolean }) {
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const byCode = Object.fromEntries(carriers.map((c) => [c.code, c]));
  const open = rows.find((r) => r.id === openId) ?? null;
  const printable = rows.filter((r) => selected.has(r.id) && (r.label_path || (r.mode === "api" && r.tracking_number)));
  const anyTracking = carriers.some((c) => c.tracking);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <span className="text-[12.5px] text-muted">{selected.size ? `Atzīmēti: ${selected.size}` : "Atzīmējiet sūtījumus, lai drukātu uzlīmes vienā PDF"}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {anyTracking && (
            <button type="button" className={btn("outline", "sm")} disabled={pending} onClick={() => run(() => refreshTrackingBulk(), { loading: "Atjaunina izsekošanu…", onSuccess: () => router.refresh() })}>
              {pending ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />} Atjaunot statusus
            </button>
          )}
          <a
            href={printable.length ? `/api/admin/shipments/labels?ids=${printable.map((r) => r.id).join(",")}` : undefined}
            target="_blank"
            rel="noopener"
            aria-disabled={!printable.length}
            onClick={(e) => {
              if (!printable.length) e.preventDefault();
              else setTimeout(() => router.refresh(), 3000);
            }}
            className={btn("dark", "sm", printable.length ? undefined : "pointer-events-none opacity-50")}
          >
            <Printer className="h-3.5 w-3.5" /> Drukāt uzlīmes{printable.length ? ` (${printable.length})` : ""}
          </a>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Truck} title={filtered ? "Nekas netika atrasts" : "Sūtījumu vēl nav"} description={filtered ? "Mēģiniet mainīt filtrus." : "Izveidojiet pirmo sūtījumu cilnē „Jānosūta”."} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-[13px]">
            <thead>
              <tr>
                <th className={cn(th, "w-10")}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-navy-700"
                    checked={selected.size === rows.length}
                    onChange={() => setSelected(selected.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)))}
                    aria-label="Atzīmēt visus"
                  />
                </th>
                <th className={th}>Sūtījums</th>
                <th className={th}>Pasūtījums / saņēmējs</th>
                <th className={th}>Statuss</th>
                <th className={cn(th, "text-right")}>Izmaksas</th>
                <th className={th}>Izveidots</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = byCode[r.carrier];
                const st = SHIPMENT_STATUS_LABEL[r.status];
                const url = buildTrackingUrl(c?.tracking_url_template, r.tracking_number, r.carrier);
                return (
                  <tr key={r.id} className={cn("transition-colors hover:bg-navy-50/30", selected.has(r.id) && "bg-navy-50/50", r.status === "cancelled" && "opacity-60")}>
                    <td className={td}>
                      <input type="checkbox" className="h-4 w-4 accent-navy-700" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label="Atzīmēt" />
                    </td>
                    <td className={td}>
                      <p className="font-bold text-ink">
                        {c?.name ?? r.carrier} <span className="font-normal text-muted">· {r.type ? SERVICE_TYPE_LABEL[r.type] : r.service_name}</span>
                      </p>
                      {r.tracking_number ? (
                        url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[12px] font-semibold text-navy-600 hover:underline">
                            {r.tracking_number} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="font-mono text-[12px] font-semibold">{r.tracking_number}</span>
                        )
                      ) : (
                        <span className="text-[12px] font-semibold text-orange-700">nav koda</span>
                      )}
                      {r.parcels > 1 && <span className="ml-1 text-[12px] text-muted">+{r.parcels - 1}</span>}
                    </td>
                    <td className={td}>
                      {r.order_id && r.order_number ? (
                        <Link href={`/admin/orders/${r.order_id}#piegade`} className="font-bold text-navy-700 hover:underline">
                          {r.order_number}
                        </Link>
                      ) : (
                        <span className="text-muted">bez pasūtījuma</span>
                      )}
                      <p className="max-w-[240px] truncate text-[12px] text-muted">
                        {[r.receiver?.company || r.receiver?.name, r.pickup_point?.name ?? r.receiver?.city, r.country].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td className={td}>
                      <Pill tone={st?.tone ?? "gray"}>{st?.label ?? r.status}</Pill>
                      {r.tracking_status && <p className="mt-1 max-w-[220px] truncate text-[11.5px] text-muted" title={r.tracking_status}>{r.tracking_status}</p>}
                    </td>
                    <td className={cn(td, "text-right tabular-nums")}>
                      {r.cost_net != null ? fmtMoney(r.cost_net) : "—"}
                      {r.customer_paid_net != null && <p className="text-[11px] text-muted">klients {fmtMoney(r.customer_paid_net)}</p>}
                    </td>
                    <td className={cn(td, "whitespace-nowrap text-[12px] text-muted")}>{fmtDateTime(r.created_at)}</td>
                    <td className={cn(td, "whitespace-nowrap text-right")}>
                      <button type="button" className={btn("outline", "sm")} onClick={() => setOpenId(r.id)}>
                        Atvērt
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={Boolean(open)} onClose={() => setOpenId(null)} title={open ? `${byCode[open.carrier]?.name ?? open.carrier} ${open.tracking_number ?? ""}` : ""} description={open?.order_number ? `Pasūtījums ${open.order_number}` : undefined}>
        {open && <ShipmentCard key={open.id + open.updated_at} s={open} carrier={byCode[open.carrier]} defaultOpen />}
      </Drawer>
    </>
  );
}
