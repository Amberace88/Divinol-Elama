"use client";

import { useState } from "react";
import { Building2, Mail, Phone, Reply } from "lucide-react";
import { setInquiryStatus } from "@/lib/admin/actions/inquiries";
import { fmtDateTime, fmtRelative } from "@/lib/admin/format";
import { INQUIRY_STATUS, INQUIRY_TYPE, labelOf } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import { Drawer, useActionRunner } from "../client-ui";
import { btn } from "../styles";
import { Pill } from "../ui";

export type Inquiry = {
  id: string;
  type: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string | null;
  payload: Record<string, unknown> | null;
  locale: string | null;
  status: string;
  created_at: string;
};

const PAYLOAD_LABEL: Record<string, string> = {
  vehicle: "Transportlīdzeklis",
  make: "Marka",
  model: "Modelis",
  year: "Gads",
  engine: "Dzinējs",
  product: "Produkts",
  products: "Produkti",
  sku: "SKU",
  qty: "Daudzums",
  quantity: "Daudzums",
  reg_no: "Reģ. nr.",
  vat_no: "PVN nr.",
  country: "Valsts",
  market: "Tirgus",
  volume: "Apjoms",
  page: "Lapa",
};

function renderValue(v: unknown): React.ReactNode {
  if (v == null || v === "") return "—";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "Jā" : "Nē";
  if (Array.isArray(v)) {
    return (
      <ul className="list-disc space-y-0.5 pl-4">
        {v.map((x, i) => (
          <li key={i}>{typeof x === "object" && x ? Object.entries(x).map(([k, val]) => `${PAYLOAD_LABEL[k] ?? k}: ${String(val)}`).join(", ") : String(x)}</li>
        ))}
      </ul>
    );
  }
  return <pre className="whitespace-pre-wrap break-words font-mono text-[12px]">{JSON.stringify(v, null, 2)}</pre>;
}

export function InquiryList({ rows }: { rows: Inquiry[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusOverride, setStatusOverride] = useState<Record<string, string>>({});
  const { run, pending } = useActionRunner();
  const current = rows.find((r) => r.id === openId) ?? null;
  const statusOf = (r: Inquiry) => statusOverride[r.id] ?? r.status;

  function change(r: Inquiry, status: string) {
    const prev = statusOf(r);
    setStatusOverride((s) => ({ ...s, [r.id]: status }));
    run(() => setInquiryStatus(r.id, status), { onError: () => setStatusOverride((s) => ({ ...s, [r.id]: prev })) });
  }

  function open(r: Inquiry) {
    setOpenId(r.id);
    if (statusOf(r) === "new") change(r, "in_progress");
  }

  const subject = current ? `Re: ${labelOf(INQUIRY_TYPE, current.type).label} — Divinol / SIA Elama` : "";
  const quoted = current?.message ? `\n\n---\n${current.name} rakstīja:\n${current.message}` : "";

  return (
    <>
      <ul className="divide-y divide-line/70">
        {rows.map((r) => {
          const t = labelOf(INQUIRY_TYPE, r.type);
          const s = labelOf(INQUIRY_STATUS, statusOf(r));
          const isNew = statusOf(r) === "new";
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => open(r)}
                className={cn(
                  "flex w-full flex-col gap-1.5 px-5 py-3.5 text-left transition hover:bg-navy-50/40 focus-visible:bg-navy-50 focus-visible:outline-none sm:flex-row sm:items-center sm:gap-4",
                  isNew && "bg-brand-50/40",
                )}
              >
                <span className="flex items-center gap-2 sm:w-44 sm:shrink-0">
                  {isNew && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Jauns" />}
                  <Pill tone={t.tone} dot={false}>
                    {t.label}
                  </Pill>
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[13px] text-ink", isNew ? "font-extrabold" : "font-semibold")}>
                    {r.company ? `${r.name} · ${r.company}` : r.name}
                  </span>
                  <span className="block truncate text-[12px] text-muted">{r.message || r.email}</span>
                </span>
                <span className="flex items-center gap-3">
                  <Pill tone={s.tone}>{s.label}</Pill>
                  <span className="w-24 text-right text-[12px] text-muted">{fmtRelative(r.created_at)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Drawer
        open={Boolean(current)}
        onClose={() => setOpenId(null)}
        title={current ? current.name : ""}
        description={current && `${labelOf(INQUIRY_TYPE, current.type).label} · ${fmtDateTime(current.created_at)}${current.locale ? ` · ${current.locale.toUpperCase()}` : ""}`}
        footer={
          current && (
            <>
              <select
                aria-label="Statuss"
                className="h-9 rounded-lg border border-line bg-white px-2.5 text-[13px] font-semibold"
                value={statusOf(current)}
                disabled={pending}
                onChange={(e) => change(current, e.target.value)}
              >
                {Object.entries(INQUIRY_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
              <a
                href={`mailto:${current.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Labdien, ${current.name}!\n\n${quoted}`)}`}
                className={btn("primary")}
              >
                <Reply className="h-4 w-4" /> Atbildēt e-pastā
              </a>
            </>
          )
        }
      >
        {current && (
          <div className="space-y-5">
            <div className="grid gap-2 text-[13px]">
              <a href={`mailto:${current.email}`} className="flex items-center gap-2 text-navy-600 hover:underline">
                <Mail className="h-4 w-4" /> {current.email}
              </a>
              {current.phone && (
                <a href={`tel:${current.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-navy-600 hover:underline">
                  <Phone className="h-4 w-4" /> {current.phone}
                </a>
              )}
              {current.company && (
                <p className="flex items-center gap-2 text-ink">
                  <Building2 className="h-4 w-4 text-muted" /> {current.company}
                </p>
              )}
            </div>
            {current.message && (
              <div>
                <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Ziņojums</p>
                <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-[14px] leading-relaxed text-ink">{current.message}</p>
              </div>
            )}
            {current.payload && Object.keys(current.payload).length > 0 && (
              <div>
                <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Papildu dati</p>
                <dl className="divide-y divide-line/70 rounded-xl border border-line text-[13px]">
                  {Object.entries(current.payload).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[140px_1fr] gap-3 px-4 py-2.5">
                      <dt className="text-muted">{PAYLOAD_LABEL[k] ?? k}</dt>
                      <dd className="min-w-0 break-words text-ink">{renderValue(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
