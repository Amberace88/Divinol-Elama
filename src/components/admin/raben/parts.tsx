"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { COUNTRY_NAMES, type RabenParty } from "@/lib/admin/raben";
import { cn } from "@/lib/utils";
import { Field } from "../client-ui";
import { inputCls, selectCls } from "../styles";

export async function copyText(text: string, what = "Nokopēts") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(what, { duration: 1400 });
    return true;
  } catch {
    toast.error("Neizdevās nokopēt — iezīmējiet tekstu un nospiediet Ctrl+C");
    return false;
  }
}

/** Small copy button with a check-mark confirmation. */
export function CopyButton({ value, label = "Kopēt", className, size = "sm" }: { value: string; label?: string; className?: string; size?: "sm" | "md" }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      disabled={!value}
      onClick={async () => {
        if (await copyText(value, `Nokopēts: ${value.length > 40 ? value.slice(0, 40) + "…" : value}`)) {
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        }
      }}
      aria-label={`${label}: ${value}`}
      title={label}
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-lg border transition active:scale-95 disabled:opacity-30",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        done ? "border-emerald-300 bg-emerald-50 text-emerald-600" : "border-line bg-white text-navy-600 hover:border-navy-300 hover:bg-navy-50",
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {done ? (
          <motion.span key="ok" initial={{ scale: 0, rotate: -60 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
            <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
          </motion.span>
        ) : (
          <motion.span key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <Copy className="h-3.5 w-3.5" aria-hidden />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/** One "label — value — copy" row, laid out the way the myRaben form asks for it. */
export function CopyRow({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  const v = value == null ? "" : String(value);
  return (
    <div className="group flex items-center gap-3 border-b border-line/60 py-2 last:border-0">
      <span className="w-[42%] shrink-0 text-[12.5px] font-semibold text-muted sm:w-48">{label}</span>
      <span className={cn("min-w-0 flex-1 break-words text-[13.5px] font-semibold text-ink", mono && "tabular-nums", !v && "font-normal text-muted/60")}>{v || "—"}</span>
      {v && <CopyButton value={v} label={`Kopēt ${label.toLowerCase()}`} />}
    </div>
  );
}

export function CountrySelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  const known = Object.keys(COUNTRY_NAMES);
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
      {!known.includes(value) && value && <option value={value}>{value}</option>}
      {known.map((c) => (
        <option key={c} value={c}>
          {COUNTRY_NAMES[c]} ({c})
        </option>
      ))}
    </select>
  );
}

/** Editable address form (used in the wizard and in the address book). */
export function PartyForm({ value, onChange, errors }: { value: RabenParty; onChange: (p: RabenParty) => void; errors?: Partial<Record<keyof RabenParty, string>> }) {
  const uid = useId();
  const set = <K extends keyof RabenParty>(k: K, v: RabenParty[K]) => onChange({ ...value, [k]: v });
  const f = (k: keyof RabenParty) => `${uid}-${k}`;
  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <Field label="Uzņēmums / nosaukums" htmlFor={f("name")} className="sm:col-span-4" error={errors?.name}>
        <input id={f("name")} className={inputCls} value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="SIA …" autoComplete="off" />
      </Field>
      <Field label="PVN Nr." htmlFor={f("vat_no")} className="sm:col-span-2" hint="Nav obligāts">
        <input id={f("vat_no")} className={inputCls} value={value.vat_no ?? ""} onChange={(e) => set("vat_no", e.target.value)} placeholder="LV4010…" autoComplete="off" />
      </Field>
      <Field label="Iela, māja" htmlFor={f("street")} className="sm:col-span-6" error={errors?.street}>
        <input id={f("street")} className={inputCls} value={value.street} onChange={(e) => set("street", e.target.value)} placeholder="Ventspils iela 51" autoComplete="off" />
      </Field>
      <Field label="Pasta indekss" htmlFor={f("postal_code")} className="sm:col-span-2" error={errors?.postal_code}>
        <input id={f("postal_code")} className={inputCls} value={value.postal_code} onChange={(e) => set("postal_code", e.target.value)} placeholder="1002" autoComplete="off" />
      </Field>
      <Field label="Pilsēta" htmlFor={f("city")} className="sm:col-span-2" error={errors?.city}>
        <input id={f("city")} className={inputCls} value={value.city} onChange={(e) => set("city", e.target.value)} placeholder="Rīga" autoComplete="off" />
      </Field>
      <Field label="Valsts" htmlFor={f("country")} className="sm:col-span-2">
        <CountrySelect id={f("country")} value={value.country} onChange={(v) => set("country", v)} />
      </Field>
      <Field label="Kontaktpersona" htmlFor={f("contact_name")} className="sm:col-span-2">
        <input id={f("contact_name")} className={inputCls} value={value.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} autoComplete="off" />
      </Field>
      <Field label="Tālrunis" htmlFor={f("phone")} className="sm:col-span-2">
        <input id={f("phone")} className={inputCls} value={value.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+371 …" inputMode="tel" autoComplete="off" />
      </Field>
      <Field label="E-pasts" htmlFor={f("email")} className="sm:col-span-2">
        <input id={f("email")} className={inputCls} value={value.email ?? ""} onChange={(e) => set("email", e.target.value)} inputMode="email" autoComplete="off" />
      </Field>
    </div>
  );
}

export function partyErrors(p: RabenParty): Partial<Record<keyof RabenParty, string>> {
  const e: Partial<Record<keyof RabenParty, string>> = {};
  if ((p.name ?? "").trim().length < 2) e.name = "Norādiet nosaukumu";
  if (!(p.street ?? "").trim()) e.street = "Norādiet ielu";
  if (!(p.postal_code ?? "").trim()) e.postal_code = "Norādiet indeksu";
  if (!(p.city ?? "").trim()) e.city = "Norādiet pilsētu";
  return e;
}
