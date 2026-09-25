"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteRate, saveRate, setRateActive, type RateInput } from "@/lib/admin/actions/shipping";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/admin/format";
import { MARKETS } from "@/lib/admin/labels";
import { transitLabel } from "@/lib/shipping/compare";
import { SERVICE_TYPE_LABEL } from "@/lib/shipping/tracking";
import type { Carrier, RateRow } from "@/lib/shipping/types";
import { cn } from "@/lib/utils";
import { Drawer, Field, Spinner, Switch, useActionRunner, useConfirm } from "../client-ui";
import { btn, inputCls, selectCls } from "../styles";
import { td, th } from "../ui";

type Form = Record<keyof Omit<RateInput, "id" | "is_contract" | "active">, string> & { id: string | null; is_contract: boolean; active: boolean };

const EMPTY: Form = {
  id: null,
  carrier: "omniva",
  service_code: "",
  service_name: "",
  type: "locker",
  country: "LV",
  size_code: "",
  min_weight_kg: "0",
  max_weight_kg: "30",
  max_length_cm: "",
  max_width_cm: "",
  max_height_cm: "",
  price_net: "",
  transit_days_min: "",
  transit_days_max: "",
  source_url: "",
  source_date: "",
  source_note: "",
  is_contract: true,
  active: true,
};

const s = (v: unknown) => (v == null ? "" : String(v));
const toForm = (r: RateRow): Form => ({
  id: r.id,
  carrier: r.carrier,
  service_code: r.service_code,
  service_name: r.service_name,
  type: r.type,
  country: r.country,
  size_code: s(r.size_code),
  min_weight_kg: s(r.min_weight_kg),
  max_weight_kg: s(r.max_weight_kg),
  max_length_cm: s(r.max_length_cm),
  max_width_cm: s(r.max_width_cm),
  max_height_cm: s(r.max_height_cm),
  price_net: s(r.price_net),
  transit_days_min: s(r.transit_days_min),
  transit_days_max: s(r.transit_days_max),
  source_url: s(r.source_url),
  source_date: s(r.source_date),
  source_note: s(r.source_note),
  is_contract: r.is_contract,
  active: r.active,
});

const numOrNull = (v: string) => {
  const t = v.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

export function RatesEditor({ rates, carriers }: { rates: RateRow[]; carriers: Carrier[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending } = useActionRunner();
  const [carrier, setCarrier] = useState("");
  const [country, setCountry] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const names = Object.fromEntries(carriers.map((c) => [c.code, c.name]));

  const list = useMemo(
    () => rates.filter((r) => (!carrier || r.carrier === carrier) && (!country || r.country === country) && (!missingOnly || r.price_net == null)),
    [rates, carrier, country, missingOnly],
  );
  const missing = rates.filter((r) => r.active && r.price_net == null).length;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const payload: RateInput = {
      id: form.id,
      carrier: form.carrier,
      service_code: form.service_code.trim(),
      service_name: form.service_name.trim(),
      type: form.type as RateInput["type"],
      country: form.country as RateInput["country"],
      size_code: form.size_code.trim() || null,
      min_weight_kg: numOrNull(form.min_weight_kg) ?? 0,
      max_weight_kg: numOrNull(form.max_weight_kg) ?? 0,
      max_length_cm: numOrNull(form.max_length_cm),
      max_width_cm: numOrNull(form.max_width_cm),
      max_height_cm: numOrNull(form.max_height_cm),
      price_net: numOrNull(form.price_net),
      transit_days_min: numOrNull(form.transit_days_min),
      transit_days_max: numOrNull(form.transit_days_max),
      source_url: form.source_url.trim(),
      source_date: form.source_date.trim(),
      source_note: form.source_note.trim() || null,
      is_contract: form.is_contract,
      active: form.active,
    };
    run(() => saveRate(payload), {
      onSuccess: () => {
        setForm(null);
        setErrors({});
        router.refresh();
      },
      onError: (_m, fe) => setErrors(fe ?? {}),
    });
  };

  const inp = (k: keyof Form, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input className={inputCls} value={String(form?.[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} aria-invalid={Boolean(errors[k]) || undefined} {...props} />
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <select className={cn(selectCls, "h-9 w-auto text-[13px]")} value={carrier} onChange={(e) => setCarrier(e.target.value)} aria-label="Pārvadātājs">
          <option value="">Visi pārvadātāji</option>
          {carriers.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <select className={cn(selectCls, "h-9 w-auto text-[13px]")} value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Valsts">
          <option value="">Visas valstis</option>
          {MARKETS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-[13px] text-ink/80">
          <input type="checkbox" className="h-4 w-4 accent-navy-700" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
          Tikai bez cenas ({missing})
        </label>
        <button type="button" className={btn("primary", "sm", "ml-auto")} onClick={() => setForm({ ...EMPTY, carrier: carrier || EMPTY.carrier, country: country || "LV" })}>
          <Plus className="h-3.5 w-3.5" /> Jauns tarifs
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-[13px]">
          <thead>
            <tr>
              <th className={th}>Pārvadātājs / pakalpojums</th>
              <th className={th}>Valsts</th>
              <th className={th}>Izmērs</th>
              <th className={th}>Maks. izmēri / svars</th>
              <th className={cn(th, "text-right")}>Cena bez PVN</th>
              <th className={th}>Piegāde</th>
              <th className={th}>Avots</th>
              <th className={th}>Aktīvs</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className={cn("transition-colors hover:bg-navy-50/30", !r.active && "opacity-50")}>
                <td className={td}>
                  <p className="font-bold text-ink">{names[r.carrier] ?? r.carrier}</p>
                  <p className="text-[12px] text-muted">
                    {r.service_name} · {SERVICE_TYPE_LABEL[r.type]}
                  </p>
                </td>
                <td className={td}>{r.country}</td>
                <td className={cn(td, "font-bold")}>{r.size_code ?? "—"}</td>
                <td className={cn(td, "text-[12px] text-muted")}>
                  {r.max_length_cm != null ? `${fmtNumber(r.max_length_cm)}×${fmtNumber(r.max_width_cm)}×${fmtNumber(r.max_height_cm)} cm` : "—"}
                  <br />
                  {Number(r.min_weight_kg) > 0 ? `${fmtNumber(r.min_weight_kg)}–` : "līdz "}
                  {fmtNumber(r.max_weight_kg)} kg
                </td>
                <td className={cn(td, "text-right")}>
                  {r.price_net != null ? (
                    <span className="font-bold tabular-nums text-ink">{fmtMoney(r.price_net)}</span>
                  ) : (
                    <span className="text-[12px] font-semibold text-orange-700">jāievada līguma cena</span>
                  )}
                  <p className="text-[11px] text-muted">{r.is_contract ? "līguma" : "publiska"}</p>
                </td>
                <td className={cn(td, "whitespace-nowrap text-[12px] text-muted")}>{transitLabel(r.transit_days_min, r.transit_days_max)}</td>
                <td className={cn(td, "max-w-[220px] text-[12px] text-muted")}>
                  {r.source_url ? (
                    <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-navy-600 hover:underline">
                      {new URL(r.source_url).hostname.replace(/^www\./, "")} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "—"
                  )}
                  {r.source_date && <span> · {fmtDate(r.source_date)}</span>}
                  {r.source_note && <p className="truncate" title={r.source_note}>{r.source_note}</p>}
                </td>
                <td className={td}>
                  <Switch size="sm" checked={r.active} label={r.active ? "Deaktivizēt" : "Aktivizēt"} disabled={pending} onChange={(v) => run(() => setRateActive(r.id, v), { onSuccess: () => router.refresh() })} />
                </td>
                <td className={cn(td, "whitespace-nowrap text-right")}>
                  <button type="button" className={btn("ghost", "sm")} onClick={() => setForm(toForm(r))} aria-label="Labot">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className={btn("ghost", "sm", "text-red-600 hover:bg-red-50")}
                    aria-label="Dzēst"
                    onClick={async () => {
                      if (await confirm({ title: "Dzēst tarifu?", description: `${names[r.carrier] ?? r.carrier} · ${r.service_name} · ${r.country} ${r.size_code ?? ""}`, danger: true, confirmLabel: "Dzēst" }))
                        run(() => deleteRate(r.id), { onSuccess: () => router.refresh() });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-[13px] text-muted">
                  Nav tarifu ar šiem filtriem.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Drawer
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? "Labot tarifu" : "Jauns tarifs"}
        description="Cena par vienu paku (vai paleti) šajā izmēra/svara klasē, bez PVN."
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={() => setForm(null)}>
              Atcelt
            </button>
            <button type="submit" form="rate-form" className={btn("primary")} disabled={pending}>
              {pending && <Spinner />} Saglabāt
            </button>
          </>
        }
      >
        {form && (
          <form id="rate-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field label="Pārvadātājs" error={errors.carrier}>
              <select className={selectCls} value={form.carrier} onChange={(e) => set("carrier", e.target.value)}>
                {carriers.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Veids">
              <select className={selectCls} value={form.type} onChange={(e) => set("type", e.target.value)}>
                {Object.entries(SERVICE_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pakalpojuma kods" hint="piem. parcel_machine, courier, pickup" error={errors.service_code}>
              {inp("service_code")}
            </Field>
            <Field label="Nosaukums" error={errors.service_name}>
              {inp("service_name")}
            </Field>
            <Field label="Valsts">
              <select className={selectCls} value={form.country} onChange={(e) => set("country", e.target.value)}>
                {MARKETS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Izmēra klase" hint="S, M, L, XL, 0-5kg …" error={errors.size_code}>
              {inp("size_code")}
            </Field>
            <Field label="Min. svars, kg" error={errors.min_weight_kg}>
              {inp("min_weight_kg", { inputMode: "decimal" })}
            </Field>
            <Field label="Maks. svars, kg" error={errors.max_weight_kg}>
              {inp("max_weight_kg", { inputMode: "decimal" })}
            </Field>
            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
              <Field label="Garums, cm">{inp("max_length_cm", { inputMode: "decimal" })}</Field>
              <Field label="Platums, cm">{inp("max_width_cm", { inputMode: "decimal" })}</Field>
              <Field label="Augstums, cm">{inp("max_height_cm", { inputMode: "decimal" })}</Field>
            </div>
            <Field label="Cena bez PVN, €" hint="Tukšs = jāievada līguma cena" error={errors.price_net}>
              {inp("price_net", { inputMode: "decimal", placeholder: "—" })}
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Dienas no">{inp("transit_days_min", { inputMode: "numeric" })}</Field>
              <Field label="līdz">{inp("transit_days_max", { inputMode: "numeric" })}</Field>
            </div>
            <Field label="Avota saite" error={errors.source_url} className="sm:col-span-2">
              {inp("source_url", { placeholder: "https://…" })}
            </Field>
            <Field label="Avota datums" error={errors.source_date}>
              {inp("source_date", { type: "date" })}
            </Field>
            <Field label="Piezīme">{inp("source_note")}</Field>
            <label className="flex items-center gap-2 text-[13px] text-ink/80">
              <input type="checkbox" className="h-4 w-4 accent-navy-700" checked={form.is_contract} onChange={(e) => set("is_contract", e.target.checked)} />
              Līguma cena (nevis publiskais cenrādis)
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink/80">
              <input type="checkbox" className="h-4 w-4 accent-navy-700" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
              Aktīvs (izmanto salīdzinājumā)
            </label>
          </form>
        )}
      </Drawer>
    </div>
  );
}
