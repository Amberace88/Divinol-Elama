"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, ChevronDown, ExternalLink, FileUp, PackageCheck, Pencil, Printer, RefreshCw, Truck } from "lucide-react";
import { toast } from "sonner";
import { cancelShipmentAction, markShipmentShipped, refreshTrackingAction, updateShipmentAction } from "@/lib/admin/actions/shipping";
import { fmtDateTime, fmtMoney, fmtNumber } from "@/lib/admin/format";
import type { ShipmentRow } from "@/lib/shipping/service";
import { buildTrackingUrl, SERVICE_TYPE_LABEL, SHIPMENT_STATUS_LABEL } from "@/lib/shipping/tracking";
import { SHIPMENT_STATUSES, type ShipmentStatus } from "@/lib/shipping/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Spinner, useActionRunner, useConfirm } from "../client-ui";
import { btn, inputCls, selectCls } from "../styles";
import { Pill } from "../ui";

export type CarrierInfo = { code: string; name: string; tracking_url_template: string | null; api: boolean; tracking: boolean };

const SHIPPED: ShipmentStatus[] = ["handed_over", "in_transit", "delivered", "returned", "cancelled"];

export function ShipmentCard({ s, carrier, defaultOpen }: { s: ShipmentRow; carrier?: CarrierInfo; defaultOpen?: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending } = useActionRunner();
  const [editCode, setEditCode] = useState(!s.tracking_number && s.status === "draft");
  const [code, setCode] = useState((s.tracking_numbers.length ? s.tracking_numbers : [s.tracking_number ?? ""]).join(", "));
  const [cost, setCost] = useState(s.cost_net != null ? String(s.cost_net) : "");
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const st = SHIPMENT_STATUS_LABEL[s.status] ?? { label: s.status, tone: "gray" as const };
  const numbers = s.tracking_numbers.length ? s.tracking_numbers : s.tracking_number ? [s.tracking_number] : [];
  const canPrint = Boolean(s.label_path) || (s.mode === "api" && numbers.length > 0);
  const cancelled = s.status === "cancelled";

  const upload = async (file: File) => {
    if (!/pdf|png|jpe?g/i.test(file.type)) return toast.error("Atļauti PDF, PNG vai JPG faili");
    if (file.size > 10 * 1024 * 1024) return toast.error("Fails ir lielāks par 10 MB");
    setUploading(true);
    const ext = file.type.includes("pdf") ? "pdf" : file.type.includes("png") ? "png" : "jpg";
    const path = `manual/${s.id}-${Date.now()}.${ext}`;
    const { error } = await createClient().storage.from("shipping-labels").upload(path, file, { contentType: file.type, upsert: true });
    setUploading(false);
    if (error) return toast.error(error.message.includes("row-level security") ? "Nav tiesību augšupielādēt" : error.message);
    run(() => updateShipmentAction(s.id, { labelPath: path }), { success: "Uzlīme augšupielādēta", onSuccess: () => router.refresh() });
  };

  return (
    <div className={cn("rounded-xl border bg-white", cancelled ? "border-line opacity-70" : "border-line shadow-card")}>
      <div className="flex flex-wrap items-start gap-3 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-600">
          <Truck className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-ink">
            {carrier?.name ?? s.carrier}
            <Pill tone={st.tone}>{st.label}</Pill>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-600">{s.mode === "api" ? "API" : "manuāli"}</span>
          </p>
          <p className="text-[12px] text-muted">
            {[s.service_name, s.type ? SERVICE_TYPE_LABEL[s.type] : null, `${s.parcels} ${s.parcels === 1 ? "paka" : "pakas"}`, s.weight_kg ? `${fmtNumber(s.weight_kg, 1)} kg` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {numbers.length > 0 && !editCode && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {numbers.map((n) => {
                const url = buildTrackingUrl(carrier?.tracking_url_template, n, s.carrier);
                return url ? (
                  <a key={n} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[12.5px] font-semibold text-navy-600 hover:underline">
                    {n} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span key={n} className="font-mono text-[12.5px] font-semibold text-ink">
                    {n}
                  </span>
                );
              })}
            </div>
          )}
          {s.pickup_point?.name && <p className="mt-1 text-[12px] text-muted">Pakomāts: {s.pickup_point.name}</p>}
        </div>
        <div className="text-right text-[12px]">
          <p className="font-bold tabular-nums text-ink">{s.cost_net != null ? fmtMoney(s.cost_net) : "—"}</p>
          <p className="text-muted">{s.cost_source === "actual" ? "faktiskās" : s.cost_source === "contract" ? "pēc līguma" : s.cost_source === "rate" ? "pēc cenrāža" : "izmaksas"}</p>
        </div>
      </div>

      {editCode && !cancelled && (
        <form
          className="flex flex-wrap items-end gap-2 border-t border-line px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateShipmentAction(s.id, { trackingNumber: code, costNet: cost.trim() ? Number(cost.replace(",", ".")) : null }), {
              success: "Saglabāts",
              onSuccess: () => {
                setEditCode(false);
                router.refresh();
              },
            });
          }}
        >
          <label className="min-w-[200px] flex-1">
            <span className="mb-1 block text-[12px] font-bold text-muted">Sūtījuma kods(-i)</span>
            <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="piem. CC123456789EE" autoFocus />
          </label>
          <label className="w-32">
            <span className="mb-1 block text-[12px] font-bold text-muted">Izmaksas €</span>
            <input className={inputCls} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="bez PVN" />
          </label>
          <button type="submit" className={btn("dark")} disabled={pending}>
            {pending ? <Spinner /> : null} Saglabāt
          </button>
          {numbers.length > 0 && (
            <button type="button" className={btn("ghost")} onClick={() => setEditCode(false)}>
              Atcelt
            </button>
          )}
        </form>
      )}

      {!cancelled && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-slate-50/50 px-4 py-3">
          {canPrint && (
            <a href={`/api/admin/shipments/labels?ids=${s.id}`} target="_blank" rel="noopener" className={btn("dark", "sm")} onClick={() => setTimeout(() => router.refresh(), 2500)}>
              <Printer className="h-3.5 w-3.5" /> Uzlīme (PDF)
            </a>
          )}
          {s.mode === "manual" && (
            <>
              <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <button type="button" className={btn("outline", "sm")} onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Spinner /> : <FileUp className="h-3.5 w-3.5" />} {s.label_path ? "Aizstāt uzlīmi" : "Augšupielādēt uzlīmi"}
              </button>
            </>
          )}
          {!editCode && (
            <button type="button" className={btn("outline", "sm")} onClick={() => setEditCode(true)}>
              <Pencil className="h-3.5 w-3.5" /> {numbers.length ? "Labot kodu / izmaksas" : "Ievadīt kodu"}
            </button>
          )}
          {!SHIPPED.includes(s.status) && numbers.length > 0 && (
            <button type="button" className={btn("primary", "sm")} disabled={pending} onClick={() => run(() => markShipmentShipped(s.id), { onSuccess: () => router.refresh() })}>
              <PackageCheck className="h-3.5 w-3.5" /> Atzīmēt kā nosūtītu
            </button>
          )}
          {carrier?.tracking && numbers.length > 0 && (
            <button type="button" className={btn("outline", "sm")} disabled={pending} onClick={() => run(() => refreshTrackingAction(s.id), { loading: "Sazinās ar pārvadātāju…", onSuccess: () => router.refresh() })}>
              <RefreshCw className="h-3.5 w-3.5" /> Atjaunot statusu
            </button>
          )}
          <label className="ml-auto flex items-center gap-1.5 text-[12px] text-muted">
            <span className="sr-only">Statuss</span>
            <select
              className={cn(selectCls, "h-8 w-auto text-[12px]")}
              value={s.status}
              onChange={(e) => run(() => updateShipmentAction(s.id, { status: e.target.value as ShipmentStatus }), { onSuccess: () => router.refresh() })}
            >
              {SHIPMENT_STATUSES.filter((x) => x !== "cancelled").map((x) => (
                <option key={x} value={x}>
                  {SHIPMENT_STATUS_LABEL[x].label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={btn("ghost", "sm", "text-red-600 hover:bg-red-50")}
            onClick={async () => {
              if (await confirm({ title: "Atcelt sūtījumu?", description: s.mode === "api" ? "Pārvadātāja sistēmā sūtījums jāatceļ atsevišķi (API atcelšanu nepiedāvā)." : undefined, danger: true, confirmLabel: "Atcelt sūtījumu" }))
                run(() => cancelShipmentAction(s.id), { onSuccess: () => router.refresh() });
            }}
          >
            <Ban className="h-3.5 w-3.5" /> Atcelt
          </button>
        </div>
      )}

      {s.events?.length > 0 && (
        <div className="border-t border-line px-4 py-2">
          <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between py-1 text-[12px] font-bold text-muted hover:text-ink" aria-expanded={open}>
            Vēsture ({s.events.length}){s.last_tracked_at && ` · pārbaudīts ${fmtDateTime(s.last_tracked_at)}`}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <ol className="mb-2 mt-1 space-y-1.5 border-l-2 border-line pl-3">
              {[...s.events].reverse().map((e, i) => (
                <li key={i} className="text-[12px]">
                  <span className="font-semibold text-ink">{e.text}</span>
                  {e.location && <span className="text-muted"> · {e.location}</span>}
                  <span className="block text-muted">
                    {fmtDateTime(e.at)} · {e.source === "api" ? "pārvadātājs" : "admin"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
