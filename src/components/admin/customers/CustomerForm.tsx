"use client";

import { useState } from "react";
import { Save, ShieldAlert } from "lucide-react";
import { updateCustomer } from "@/lib/admin/actions/customers";
import { B2B_STATUS, CUSTOMER_TYPE, MARKET, MARKETS } from "@/lib/admin/labels";
import { Field, Spinner, useActionRunner, useConfirm } from "../client-ui";
import { btn, inputCls, selectCls, textareaCls } from "../styles";

export type CustomerFormValues = {
  full_name: string;
  phone: string;
  customer_type: "private" | "business";
  company_name: string;
  reg_no: string;
  vat_no: string;
  legal_address: string;
  market: "LV" | "EE" | "LT";
  b2b_status: "none" | "pending" | "approved" | "rejected";
  discount_percent: string;
  payment_terms_days: string;
  role: "customer" | "admin";
  admin_notes: string;
};

export function CustomerForm({ id, initial, isSelf }: { id: string; initial: CustomerFormValues; isSelf: boolean }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useActionRunner();
  const confirm = useConfirm();
  const set = <K extends keyof CustomerFormValues>(k: K, val: CustomerFormValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (v.role !== initial.role) {
      const ok = await confirm({
        title: v.role === "admin" ? "Piešķirt administratora tiesības?" : "Noņemt administratora tiesības?",
        description:
          v.role === "admin"
            ? "Šis lietotājs iegūs pilnu piekļuvi administrācijas panelim: pasūtījumiem, klientu datiem, cenām un iestatījumiem."
            : "Lietotājs zaudēs piekļuvi administrācijas panelim.",
        confirmLabel: v.role === "admin" ? "Piešķirt" : "Noņemt",
        danger: true,
      });
      if (!ok) return;
    }
    setErrors({});
    run(
      () =>
        updateCustomer(id, {
          ...v,
          discount_percent: Number(v.discount_percent.replace(",", ".")),
          payment_terms_days: Number(v.payment_terms_days),
        }),
      { onError: (_e, fe) => fe && setErrors(fe) },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-4 text-[15px] font-bold text-ink">B2B un cenas</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="B2B statuss" htmlFor="c-b2b">
            <select id="c-b2b" className={selectCls} value={v.b2b_status} onChange={(e) => set("b2b_status", e.target.value as CustomerFormValues["b2b_status"])}>
              {Object.entries(B2B_STATUS).map(([k, x]) => (
                <option key={k} value={k}>
                  {k === "none" ? "Nav B2B" : x.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Atlaide, %" htmlFor="c-disc" error={errors.discount_percent} hint="Tiek piemērota tikai apstiprinātiem B2B">
            <input id="c-disc" inputMode="decimal" className={inputCls} value={v.discount_percent} onChange={(e) => set("discount_percent", e.target.value)} />
          </Field>
          <Field label="Apmaksas termiņš, dienas" htmlFor="c-terms" error={errors.payment_terms_days} hint="Rēķiniem „Pēc rēķina”">
            <input id="c-terms" type="number" min={0} max={120} className={inputCls} value={v.payment_terms_days} onChange={(e) => set("payment_terms_days", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-4 text-[15px] font-bold text-ink">Profila un uzņēmuma dati</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vārds, uzvārds" htmlFor="c-name" error={errors.full_name}>
            <input id="c-name" className={inputCls} value={v.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </Field>
          <Field label="Tālrunis" htmlFor="c-phone" error={errors.phone}>
            <input id="c-phone" className={inputCls} value={v.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Klienta tips" htmlFor="c-type">
            <select id="c-type" className={selectCls} value={v.customer_type} onChange={(e) => set("customer_type", e.target.value as CustomerFormValues["customer_type"])}>
              {Object.entries(CUSTOMER_TYPE).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tirgus" htmlFor="c-market">
            <select id="c-market" className={selectCls} value={v.market} onChange={(e) => set("market", e.target.value as CustomerFormValues["market"])}>
              {MARKETS.map((m) => (
                <option key={m} value={m}>
                  {MARKET[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Uzņēmuma nosaukums" htmlFor="c-company" error={errors.company_name} className="sm:col-span-2">
            <input id="c-company" className={inputCls} value={v.company_name} onChange={(e) => set("company_name", e.target.value)} />
          </Field>
          <Field label="Reģistrācijas nr." htmlFor="c-reg" error={errors.reg_no}>
            <input id="c-reg" className={inputCls} value={v.reg_no} onChange={(e) => set("reg_no", e.target.value)} />
          </Field>
          <Field label="PVN maksātāja nr." htmlFor="c-vat" error={errors.vat_no} hint="Nepieciešams reverse charge (EE/LT B2B)">
            <input id="c-vat" className={inputCls} value={v.vat_no} onChange={(e) => set("vat_no", e.target.value)} />
          </Field>
          <Field label="Juridiskā adrese" htmlFor="c-addr" error={errors.legal_address} className="sm:col-span-2">
            <input id="c-addr" className={inputCls} value={v.legal_address} onChange={(e) => set("legal_address", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-4 text-[15px] font-bold text-ink">Iekšējās piezīmes</h2>
        <label htmlFor="c-notes" className="sr-only">
          Iekšējās piezīmes
        </label>
        <textarea id="c-notes" rows={4} className={textareaCls} value={v.admin_notes} onChange={(e) => set("admin_notes", e.target.value)} placeholder="Redzamas tikai administratoriem…" />
      </section>

      <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-card">
        <h2 className="mb-1 flex items-center gap-2 text-[15px] font-bold text-ink">
          <ShieldAlert className="h-4 w-4 text-red-600" /> Loma
        </h2>
        <p className="mb-3 text-[13px] text-muted">Administratoriem ir pilna piekļuve šim panelim.</p>
        <label htmlFor="c-role" className="sr-only">
          Loma
        </label>
        <select
          id="c-role"
          className={selectCls}
          value={v.role}
          disabled={isSelf}
          onChange={(e) => set("role", e.target.value as CustomerFormValues["role"])}
        >
          <option value="customer">Klients</option>
          <option value="admin">Administrators</option>
        </select>
        {isSelf && <p className="mt-1.5 text-[12px] text-muted">Savu lomu nevar mainīt.</p>}
      </section>

      <div className="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
        <button type="submit" className={btn("primary", "md", "shadow-lift")} disabled={pending || !dirty}>
          {pending ? <Spinner /> : <Save className="h-4 w-4" />} Saglabāt izmaiņas
        </button>
      </div>
    </form>
  );
}
