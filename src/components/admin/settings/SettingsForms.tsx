"use client";

import { useState } from "react";
import { Building2, FileText, Percent, Save, Truck } from "lucide-react";
import { saveSettings, type SettingsKey } from "@/lib/admin/actions/settings";
import { fmtMoney } from "@/lib/admin/format";
import { MARKET, MARKETS, SHIPPING_METHOD } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import { Field, Spinner, Switch, useActionRunner } from "../client-ui";
import { btn, inputCls, textareaCls } from "../styles";

type Market = (typeof MARKETS)[number];
type Company = { name: string; reg_no: string; vat_no: string; address: string; warehouse: string; phone: string; email: string; bank_name: string; iban: string; swift: string; hours: string };
type Method = { enabled: boolean; price_net: number | null; markets: Market[]; max_item?: number | null; free_over?: boolean; surcharge?: Partial<Record<Market, number>> };
export type SettingsInit = {
  company: Company;
  vat: Record<Market, number>;
  shipping: { free_threshold: Record<Market, number>; methods: Record<string, Method> };
  invoice: { due_days_default: number; notes: string; auto_final_invoice: boolean };
  updated: Partial<Record<SettingsKey, string>>;
};

const METHOD_IDS = ["pickup", "parcel_locker", "courier", "freight"] as const;
const num = (s: string) => {
  const t = s.replace(/\s/g, "").replace(",", ".");
  return t === "" ? Number.NaN : Number(t);
};
const str = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

function Section({
  id,
  icon: Icon,
  title,
  description,
  children,
  onSave,
  pending,
  updated,
}: {
  id: string;
  icon: typeof Building2;
  title: string;
  description: string;
  children: React.ReactNode;
  onSave: () => void;
  pending: boolean;
  updated?: string;
}) {
  return (
    <form
      id={id}
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-white shadow-card"
      noValidate
    >
      <header className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 -skew-x-6 place-items-center rounded-lg bg-navy-50 text-navy-600">
          <Icon className="h-4 w-4 skew-x-6" />
        </span>
        <div>
          <h2 className="text-[15px] font-bold text-ink">{title}</h2>
          <p className="text-[13px] text-muted">{description}</p>
        </div>
      </header>
      <div className="p-5">{children}</div>
      <footer className="flex items-center justify-between gap-3 border-t border-line bg-slate-50/60 px-5 py-3">
        <span className="text-[12px] text-muted">{updated ? `Pēdējās izmaiņas: ${updated}` : "Noklusējuma vērtības"}</span>
        <button type="submit" className={btn("dark")} disabled={pending}>
          {pending ? <Spinner /> : <Save className="h-4 w-4" />} Saglabāt
        </button>
      </footer>
    </form>
  );
}

export function SettingsForms({ initial }: { initial: SettingsInit }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav className="hidden lg:block" aria-label="Iestatījumu sadaļas">
        <ul className="sticky top-24 space-y-1 text-[13px] font-semibold">
          {[
            ["#company", "Uzņēmums"],
            ["#vat", "PVN likmes"],
            ["#shipping", "Piegāde"],
            ["#invoice", "Rēķini"],
          ].map(([href, label]) => (
            <li key={href}>
              <a href={href} className="block rounded-lg px-3 py-2 text-muted transition hover:bg-white hover:text-navy-700">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 space-y-6">
        <CompanyForm initial={initial.company} updated={initial.updated.company} />
        <VatForm initial={initial.vat} updated={initial.updated.vat} />
        <ShippingForm initial={initial.shipping} vat={initial.vat} updated={initial.updated.shipping} />
        <InvoiceForm initial={initial.invoice} updated={initial.updated.invoice} />
      </div>
    </div>
  );
}

function useSave(key: SettingsKey) {
  const { run, pending } = useActionRunner();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = (value: unknown) => {
    setErrors({});
    run(() => saveSettings(key, value), { onError: (_e, fe) => fe && setErrors(fe) });
  };
  return { save, pending, errors };
}

function CompanyForm({ initial, updated }: { initial: Company; updated?: string }) {
  const [v, setV] = useState(initial);
  const { save, pending, errors } = useSave("company");
  const f = (k: keyof Company, label: string, opts: { hint?: string; span?: boolean; mono?: boolean } = {}) => (
    <Field label={label} htmlFor={`co-${k}`} error={errors[k]} hint={opts.hint} className={opts.span ? "sm:col-span-2" : undefined}>
      <input id={`co-${k}`} className={cn(inputCls, opts.mono && "font-mono")} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </Field>
  );
  return (
    <Section
      id="company"
      icon={Building2}
      title="Uzņēmuma rekvizīti"
      description="Tiek rādīti veikala kājenē, kontaktos un jaunos rēķinos (esošie rēķini saglabā izrakstīšanas brīža datus)."
      onSave={() => save(v)}
      pending={pending}
      updated={updated}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {f("name", "Nosaukums", { span: true })}
        {f("reg_no", "Reģistrācijas nr.")}
        {f("vat_no", "PVN maksātāja nr.")}
        {f("address", "Juridiskā adrese", { span: true })}
        {f("warehouse", "Noliktava / saņemšanas vieta", { span: true })}
        {f("phone", "Tālrunis")}
        {f("email", "E-pasts")}
        {f("bank_name", "Banka")}
        {f("swift", "SWIFT/BIC", { mono: true })}
        {f("iban", "IBAN", { span: true, mono: true, hint: "Tiek drukāts uz rēķiniem" })}
        {f("hours", "Darba laiks", { span: true, hint: "piem. „P.–Pk. 9:00–17:00”" })}
      </div>
    </Section>
  );
}

function VatForm({ initial, updated }: { initial: Record<Market, number>; updated?: string }) {
  const [v, setV] = useState<Record<Market, string>>({ LV: str(initial.LV), EE: str(initial.EE), LT: str(initial.LT) });
  const { save, pending, errors } = useSave("vat");
  return (
    <Section
      id="vat"
      icon={Percent}
      title="PVN likmes"
      description="Piemēro cenām ar PVN katrā tirgū. B2B klientiem ar derīgu PVN nr. EE/LT tiek piemērots reverse charge (0%)."
      onSave={() => save({ LV: num(v.LV), EE: num(v.EE), LT: num(v.LT) })}
      pending={pending}
      updated={updated}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {MARKETS.map((m) => (
          <Field key={m} label={`${MARKET[m]} (${m})`} htmlFor={`vat-${m}`} error={errors[m]}>
            <div className="relative">
              <input id={`vat-${m}`} inputMode="decimal" className={cn(inputCls, "pr-8")} value={v[m]} onChange={(e) => setV({ ...v, [m]: e.target.value })} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">%</span>
            </div>
          </Field>
        ))}
      </div>
    </Section>
  );
}

type MethodState = { enabled: boolean; price: string; manual: boolean; markets: Market[]; max_item: string; free_over: boolean; surcharge: Record<Market, string> };

function ShippingForm({ initial, vat, updated }: { initial: SettingsInit["shipping"]; vat: Record<Market, number>; updated?: string }) {
  const [thr, setThr] = useState<Record<Market, string>>({
    LV: str(initial.free_threshold?.LV),
    EE: str(initial.free_threshold?.EE),
    LT: str(initial.free_threshold?.LT),
  });
  const [methods, setMethods] = useState<Record<string, MethodState>>(() =>
    Object.fromEntries(
      METHOD_IDS.map((id) => {
        const m = initial.methods?.[id];
        return [
          id,
          {
            enabled: m?.enabled ?? true,
            price: str(m?.price_net ?? null),
            manual: m ? m.price_net == null : id === "freight",
            markets: (m?.markets ?? (id === "pickup" ? ["LV"] : [...MARKETS])) as Market[],
            max_item: str(m?.max_item ?? null),
            free_over: Boolean(m?.free_over),
            surcharge: { LV: str(m?.surcharge?.LV ?? 0), EE: str(m?.surcharge?.EE ?? 0), LT: str(m?.surcharge?.LT ?? 0) },
          },
        ];
      }),
    ),
  );
  const { save, pending, errors } = useSave("shipping");
  const upd = (id: string, patch: Partial<MethodState>) => setMethods((ms) => ({ ...ms, [id]: { ...ms[id], ...patch } }));

  function submit() {
    save({
      free_threshold: { LV: num(thr.LV), EE: num(thr.EE), LT: num(thr.LT) },
      methods: Object.fromEntries(
        METHOD_IDS.map((id) => {
          const m = methods[id];
          const out: Record<string, unknown> = { enabled: m.enabled, markets: m.markets, price_net: m.manual ? null : num(m.price) };
          if (m.max_item.trim()) out.max_item = num(m.max_item);
          if (id !== "pickup" && id !== "freight") out.free_over = m.free_over;
          if (id === "courier" || id === "parcel_locker") {
            const sc = { LV: num(m.surcharge.LV || "0"), EE: num(m.surcharge.EE || "0"), LT: num(m.surcharge.LT || "0") };
            if (id === "courier" || sc.LV || sc.EE || sc.LT) out.surcharge = sc;
          }
          return [id, out];
        }),
      ),
    });
  }

  return (
    <Section
      id="shipping"
      icon={Truck}
      title="Piegāde"
      description="Cenas bez PVN; klientam tiek rādītas ar attiecīgā tirgus PVN. Bezmaksas piegādes slieksnis tiek salīdzināts ar grozu ar PVN."
      onSave={submit}
      pending={pending}
      updated={updated}
    >
      <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Bezmaksas piegāde no (grozs ar PVN)</p>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {MARKETS.map((m) => (
          <Field key={m} label={MARKET[m]} htmlFor={`thr-${m}`} error={errors[`free_threshold.${m}`]}>
            <div className="relative">
              <input id={`thr-${m}`} inputMode="decimal" className={cn(inputCls, "pr-8")} value={thr[m]} onChange={(e) => setThr({ ...thr, [m]: e.target.value })} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">€</span>
            </div>
          </Field>
        ))}
      </div>

      <div className="space-y-3">
        {METHOD_IDS.map((id) => {
          const m = methods[id];
          const price = num(m.price);
          const err = (k: string) => errors[`methods.${id}.${k}`];
          return (
            <fieldset key={id} className={cn("rounded-xl border p-4 transition", m.enabled ? "border-line" : "border-dashed border-line bg-slate-50/70")}>
              <legend className="sr-only">{SHIPPING_METHOD[id]}</legend>
              <div className="flex flex-wrap items-center gap-3">
                <Switch checked={m.enabled} onChange={(x) => upd(id, { enabled: x })} label={`${SHIPPING_METHOD[id]}: ieslēgts`} />
                <p className="flex-1 text-[14px] font-bold text-ink">{SHIPPING_METHOD[id]}</p>
                <div className="flex gap-1.5" role="group" aria-label="Tirgi">
                  {MARKETS.map((mk) => {
                    const on = m.markets.includes(mk);
                    return (
                      <button
                        key={mk}
                        type="button"
                        aria-pressed={on}
                        onClick={() => upd(id, { markets: on ? m.markets.filter((x) => x !== mk) : [...m.markets, mk] })}
                        className={cn("rounded-md px-2 py-1 text-[11px] font-extrabold ring-1 ring-inset transition", on ? "bg-navy-700 text-white ring-navy-700" : "bg-white text-muted ring-line hover:ring-navy-300")}
                      >
                        {mk}
                      </button>
                    );
                  })}
                </div>
              </div>
              {m.enabled && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Cena bez PVN" htmlFor={`pr-${id}`} error={err("price_net")}>
                    {id === "freight" || m.manual ? (
                      <div className="flex h-10 items-center gap-2">
                        <label className="flex items-center gap-2 text-[13px] text-muted">
                          <input type="checkbox" checked={m.manual} onChange={(e) => upd(id, { manual: e.target.checked })} className="h-4 w-4 accent-navy-700" />
                          Aprēķina menedžeris
                        </label>
                        {!m.manual && (
                          <input id={`pr-${id}`} inputMode="decimal" className={inputCls} value={m.price} onChange={(e) => upd(id, { price: e.target.value })} />
                        )}
                      </div>
                    ) : (
                      <input id={`pr-${id}`} inputMode="decimal" className={inputCls} value={m.price} onChange={(e) => upd(id, { price: e.target.value })} />
                    )}
                  </Field>
                  <div className="text-[12px] text-muted sm:col-span-1">
                    <p className="mb-1.5 text-[13px] font-semibold text-ink/80">Ar PVN</p>
                    {m.manual || !Number.isFinite(price) ? (
                      <p className="pt-2">—</p>
                    ) : (
                      <ul className="space-y-0.5 pt-0.5">
                        {m.markets.map((mk) => {
                          const sc = id === "courier" || id === "parcel_locker" ? num(m.surcharge[mk] || "0") || 0 : 0;
                          return (
                            <li key={mk} className="flex justify-between gap-2 tabular-nums">
                              <span>{mk}</span>
                              <span className="font-semibold text-ink">{fmtMoney((price + sc) * (1 + (vat[mk] ?? 21) / 100))}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {id !== "pickup" && (
                    <Field label="Maks. vienības izmērs (L/kg)" htmlFor={`mx-${id}`} error={err("max_item")} hint="Tukšs = bez ierobežojuma">
                      <input id={`mx-${id}`} inputMode="decimal" className={inputCls} value={m.max_item} onChange={(e) => upd(id, { max_item: e.target.value })} />
                    </Field>
                  )}
                  {id !== "pickup" && id !== "freight" && (
                    <div className="flex items-center gap-2.5 pt-6">
                      <Switch size="sm" checked={m.free_over} onChange={(x) => upd(id, { free_over: x })} label="Bezmaksas virs sliekšņa" />
                      <span className="text-[13px] font-semibold text-ink/80">Bezmaksas virs sliekšņa</span>
                    </div>
                  )}
                  {(id === "courier" || id === "parcel_locker") && (
                    <div className="sm:col-span-2 lg:col-span-4">
                      <p className="mb-1.5 text-[13px] font-semibold text-ink/80">Piemaksa pēc tirgus (bez PVN)</p>
                      <div className="grid grid-cols-3 gap-3">
                        {MARKETS.map((mk) => (
                          <label key={mk} className="flex items-center gap-2 text-[12px] font-bold text-muted">
                            {mk}
                            <input
                              inputMode="decimal"
                              className={cn(inputCls, "h-9")}
                              value={m.surcharge[mk]}
                              onChange={(e) => upd(id, { surcharge: { ...m.surcharge, [mk]: e.target.value } })}
                              aria-label={`${SHIPPING_METHOD[id]} piemaksa ${mk}`}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </fieldset>
          );
        })}
      </div>
    </Section>
  );
}

function InvoiceForm({ initial, updated }: { initial: SettingsInit["invoice"]; updated?: string }) {
  const [days, setDays] = useState(String(initial.due_days_default ?? 7));
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [autoFinal, setAutoFinal] = useState(initial.auto_final_invoice !== false);
  const { save, pending, errors } = useSave("invoice");
  return (
    <Section
      id="invoice"
      icon={FileText}
      title="Rēķini"
      description="Noklusējuma apmaksas termiņš manuāli izrakstītiem rēķiniem, piezīme rēķina PDF apakšā un automātiskā rēķina izrakstīšana."
      onSave={() => save({ due_days_default: Number(days), notes, auto_final_invoice: autoFinal })}
      pending={pending}
      updated={updated}
    >
      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <Field label="Apmaksas termiņš, dienas" htmlFor="inv-days" error={errors.due_days_default}>
          <input id="inv-days" type="number" min={0} max={120} className={inputCls} value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
        <Field label="Piezīme rēķinā" htmlFor="inv-notes" error={errors.notes}>
          <textarea id="inv-notes" rows={3} className={textareaCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-xl border border-line bg-slate-50/60 px-4 py-3">
        <Switch checked={autoFinal} onChange={setAutoFinal} label="Automātiski izrakstīt rēķinu pēc avansa rēķina apmaksas" />
        <div className="text-[13px]">
          <p className="font-bold text-ink">Automātiski izrakstīt rēķinu pēc avansa rēķina apmaksas</p>
          <p className="text-muted">
            Kad pasūtījums vai tā avansa rēķins (PR-) tiek atzīmēts kā apmaksāts, sistēma izraksta apmaksātu gala rēķinu (ELA-) ar atsauci uz avansa rēķinu un
            nosūta to klientam. Katram pasūtījumam tikai vienu reizi.
          </p>
        </div>
      </div>
    </Section>
  );
}
