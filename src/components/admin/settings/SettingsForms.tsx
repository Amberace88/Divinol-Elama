"use client";

import { useState } from "react";
import { Building2, FileText, Percent, Save, Truck } from "lucide-react";
import { saveSettings, type SettingsKey } from "@/lib/admin/actions/settings";
import { fmtMoney } from "@/lib/admin/format";
import { MARKET, MARKETS, SHIPPING_METHOD } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import { Field, Spinner, Switch, useActionRunner } from "../client-ui";
import { btn, inputCls, textareaCls } from "../styles";
import { CarrierLogo } from "@/components/shipping/CarrierLogo";

type Market = (typeof MARKETS)[number];
type Company = { name: string; reg_no: string; vat_no: string; address: string; warehouse: string; phone: string; email: string; bank_name: string; iban: string; swift: string; hours: string };
type Method = {
  enabled: boolean;
  price_net: number | null;
  markets: Market[];
  max_item?: number | null;
  free_over?: boolean;
  surcharge?: Partial<Record<Market, number>>;
  tiers?: { id: string; label: string; max_kg: number; price_net: Partial<Record<Market, number>> }[];
};
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
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
/** Net price (2 decimals) whose gross with `vat` rounds exactly to `gross` when possible (the shop stores net prices). */
function netForGross(gross: number, vat: number) {
  const k = 1 + vat / 100;
  const n0 = r2(gross / k);
  for (const n of [n0, r2(n0 - 0.01), r2(n0 + 0.01)]) if (n >= 0 && r2(n * k) === r2(gross)) return n;
  return n0;
}
/** Methods whose customer price is entered per country, incl. VAT (stored as price_net + per-market surcharge). */
const PER_MARKET = new Set(["parcel_locker", "courier"]);

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

type MethodState = {
  enabled: boolean;
  price: string;
  manual: boolean;
  markets: Market[];
  max_item: string;
  free_over: boolean;
  surcharge: Record<Market, string>;
  /** customer price incl. VAT per country (parcel locker / courier) */
  gross: Record<Market, string>;
  /** prices by size class (Omniva S / M / L …) */
  tiered: boolean;
  tiers: TierState[];
};

type TierState = { key: string; id: string; label: string; max_kg: string; gross: Record<Market, string> };

const DEFAULT_TIERS: Record<string, { id: string; label: string; max_kg: number }[]> = {
  parcel_locker: [
    { id: "S", label: "S — mazā šūna (9 × 38 × 64 cm)", max_kg: 2 },
    { id: "M", label: "M — vidējā šūna (19 × 38 × 64 cm)", max_kg: 6 },
    { id: "L", label: "L — lielā šūna (39 × 38 × 64 cm)", max_kg: 30 },
  ],
  courier: [
    { id: "S", label: "Maza paka", max_kg: 5 },
    { id: "M", label: "Vidēja paka", max_kg: 15 },
    { id: "L", label: "Liela paka", max_kg: 30 },
  ],
};

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
            gross: Object.fromEntries(
              MARKETS.map((mk) => [mk, m?.price_net == null ? "" : str(r2(r2(m.price_net + (m.surcharge?.[mk] ?? 0)) * (1 + (vat[mk] ?? 21) / 100)))]),
            ) as Record<Market, string>,
            tiered: Boolean(m?.tiers?.length),
            tiers: (m?.tiers ?? []).map((t, i) => ({
              key: `t${i}-${t.id}`,
              id: t.id,
              label: t.label,
              max_kg: str(t.max_kg),
              gross: Object.fromEntries(
                MARKETS.map((mk) => {
                  const net = t.price_net?.[mk] ?? (m?.price_net == null ? null : m.price_net + (m.surcharge?.[mk] ?? 0));
                  return [mk, net == null ? "" : str(r2(net * (1 + (vat[mk] ?? 21) / 100)))];
                }),
              ) as Record<Market, string>,
            })),
          },
        ];
      }),
    ),
  );
  const { save, pending, errors: serverErrors } = useSave("shipping");
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const errors = { ...serverErrors, ...localErrors };
  const upd = (id: string, patch: Partial<MethodState>) => setMethods((ms) => ({ ...ms, [id]: { ...ms[id], ...patch } }));

  /** gross per country → { price_net: lowest net, surcharge: difference per country } (all ≥ 0, so place_order is unchanged) */
  function perMarketPrices(m: MethodState) {
    const nets = Object.fromEntries(
      MARKETS.map((mk) => {
        const g = num(m.gross[mk]);
        return [mk, Number.isFinite(g) && g >= 0 ? netForGross(g, vat[mk] ?? 21) : Number.NaN];
      }),
    ) as Record<Market, number>;
    const used = MARKETS.filter((mk) => Number.isFinite(nets[mk]));
    const base = used.length ? Math.min(...used.map((mk) => nets[mk])) : 0;
    const surcharge = Object.fromEntries(MARKETS.map((mk) => [mk, Number.isFinite(nets[mk]) ? r2(nets[mk] - base) : 0])) as Record<Market, number>;
    return { base, surcharge, nets };
  }

  function submit() {
    const errs: Record<string, string> = {};
    for (const id of METHOD_IDS) {
      const m = methods[id];
      if (!PER_MARKET.has(id) || !m.enabled) continue;
      if (m.tiered) {
        if (!m.tiers.length) errs[`methods.${id}.tiers`] = "Pievienojiet vismaz vienu izmēru";
        m.tiers.forEach((t, i) => {
          if (!t.label.trim()) errs[`methods.${id}.tiers.${i}.label`] = "Nosaukums";
          const kg = num(t.max_kg);
          if (!Number.isFinite(kg) || kg <= 0) errs[`methods.${id}.tiers.${i}.max_kg`] = "Svars";
          for (const mk of m.markets) {
            const g = num(t.gross[mk]);
            if (!Number.isFinite(g) || g < 0) errs[`methods.${id}.tiers.${i}.${mk}`] = "Cena";
          }
        });
        continue;
      }
      for (const mk of m.markets) {
        const g = num(m.gross[mk]);
        if (!Number.isFinite(g) || g < 0) errs[`methods.${id}.gross.${mk}`] = "Ievadiet cenu";
      }
    }
    setLocalErrors(errs);
    if (Object.keys(errs).length) return;
    save({
      free_threshold: { LV: num(thr.LV), EE: num(thr.EE), LT: num(thr.LT) },
      methods: Object.fromEntries(
        METHOD_IDS.map((id) => {
          const m = methods[id];
          const out: Record<string, unknown> = { enabled: m.enabled, markets: m.markets, price_net: m.manual ? null : num(m.price) };
          if (m.max_item.trim()) out.max_item = num(m.max_item);
          if (id !== "pickup" && id !== "freight") out.free_over = m.free_over;
          if (PER_MARKET.has(id)) {
            if (m.tiered && m.tiers.length) {
              const tiers = [...m.tiers]
                .map((t) => ({
                  id: t.id.trim() || t.label.trim().slice(0, 20),
                  label: t.label.trim(),
                  max_kg: num(t.max_kg),
                  price_net: Object.fromEntries(
                    MARKETS.flatMap((mk) => {
                      const g = num(t.gross[mk]);
                      return Number.isFinite(g) && g >= 0 ? [[mk, netForGross(g, vat[mk] ?? 21)]] : [];
                    }),
                  ),
                }))
                .sort((a, b) => a.max_kg - b.max_kg);
              // fallback / "from" price = the smallest size
              const first = tiers[0].price_net as Partial<Record<Market, number>>;
              const nets = MARKETS.map((mk) => first[mk]).filter((n): n is number => n != null);
              const base = nets.length ? Math.min(...nets) : 0;
              out.price_net = base;
              out.surcharge = Object.fromEntries(MARKETS.map((mk) => [mk, first[mk] == null ? 0 : r2(first[mk]! - base)]));
              out.tiers = tiers;
            } else {
              const { base, surcharge } = perMarketPrices(m);
              out.price_net = base;
              out.surcharge = surcharge;
            }
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
                <p className="flex-1 text-[14px] font-bold text-ink">{id === "parcel_locker" ? "Pakomāts — Omniva" : SHIPPING_METHOD[id]}</p>
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
              {m.enabled && PER_MARKET.has(id) && (
                <PerMarketPrices
                  id={id}
                  m={m}
                  vat={vat}
                  errors={errors}
                  onChange={(patch) => upd(id, patch)}
                />
              )}
              {m.enabled && !PER_MARKET.has(id) && (
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

/** Customer prices per country incl. VAT — one price, or by size class (Omniva S / M / L …). */
function PerMarketPrices({
  id,
  m,
  vat,
  errors,
  onChange,
}: {
  id: string;
  m: MethodState;
  vat: Record<Market, number>;
  errors: Record<string, string>;
  onChange: (patch: Partial<MethodState>) => void;
}) {
  const omniva = id === "parcel_locker";
  const priceCell = (value: string, mk: Market, set: (v: string) => void, inputId: string, error?: string) => {
    const g = num(value);
    const vatMk = vat[mk] ?? 21;
    const net = Number.isFinite(g) ? netForGross(g, vatMk) : Number.NaN;
    const shown = Number.isFinite(net) ? r2(net * (1 + vatMk / 100)) : Number.NaN;
    const on = m.markets.includes(mk);
    return (
      <div>
        <div className="relative">
          <input
            id={inputId}
            inputMode="decimal"
            aria-label={`${MARKET[mk]} cena ar PVN`}
            aria-invalid={Boolean(error)}
            className={cn(inputCls, "pr-8 font-semibold tabular-nums", !on && "opacity-50", error && "border-red-400")}
            value={value}
            onChange={(e) => set(e.target.value)}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">€</span>
        </div>
        <span className="mt-1 block text-[11px] text-muted tabular-nums">
          {Number.isFinite(net) ? (
            <>
              bez PVN {fmtMoney(net)}
              {Math.abs(shown - g) > 0.001 && <span className="font-semibold text-orange-700"> · klients redzēs {fmtMoney(shown)}</span>}
            </>
          ) : (
            error ?? "—"
          )}
        </span>
      </div>
    );
  };

  const startTiers = () => {
    const defs = DEFAULT_TIERS[id] ?? DEFAULT_TIERS.courier;
    onChange({
      tiered: true,
      tiers: m.tiers.length ? m.tiers : defs.map((d, i) => ({ key: `n${i}-${d.id}`, id: d.id, label: d.label, max_kg: str(d.max_kg), gross: { ...m.gross } })),
    });
  };
  const setTier = (i: number, patch: Partial<TierState>) => onChange({ tiers: m.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  return (
    <div className="mt-4">
      {omniva && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-[linear-gradient(110deg,#fff4ed,#ffffff)] px-4 py-3 ring-1 ring-inset ring-orange-200">
          <CarrierLogo code="omniva" name="Omniva" size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-extrabold text-ink">Omniva pakomāti</p>
            <p className="text-[12px] text-muted">Klients kasē izvēlas Omniva pakomātu. Šeit ievadītā cena ir tieši tā, ko viņš maksā (ar PVN).</p>
          </div>
        </div>
      )}

      <div className="mb-3 inline-flex rounded-xl bg-slate-100 p-1 text-[12.5px] font-bold">
        <button type="button" onClick={() => onChange({ tiered: false })} className={cn("rounded-lg px-3 py-1.5 transition", !m.tiered ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink")}>
          Viena cena visām pakām
        </button>
        <button type="button" onClick={startTiers} className={cn("rounded-lg px-3 py-1.5 transition", m.tiered ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink")}>
          Cena pēc izmēra {omniva ? "(S / M / L)" : ""}
        </button>
      </div>

      {!m.tiered ? (
        <>
          <p className="mb-2 text-[13px] font-semibold text-ink/80">
            Cena klientam <span className="font-normal text-muted">(ar PVN — tieši tā summa, ko klients redz grozā)</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {MARKETS.map((mk) => (
              <Field key={mk} label={`${MARKET[mk]}${m.markets.includes(mk) ? "" : " (izslēgts)"}`} htmlFor={`gr-${id}-${mk}`} error={errors[`methods.${id}.gross.${mk}`]}>
                {priceCell(m.gross[mk], mk, (v) => onChange({ gross: { ...m.gross, [mk]: v } }), `gr-${id}-${mk}`)}
              </Field>
            ))}
          </div>
        </>
      ) : (
        <div>
          <p className="mb-2 text-[12.5px] text-muted">
            Izmēru nosaka automātiski pēc groza svara (1 L eļļas ≈ 0,95 kg, 1 kg ≈ 1,08 kg ar iepakojumu): tiek izmantots pirmais izmērs, kurā sūtījums ietilpst. Cenas ar PVN.
          </p>
          {errors[`methods.${id}.tiers`] && <p className="mb-2 text-[12px] font-semibold text-red-600">{errors[`methods.${id}.tiers`]}</p>}
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Izmērs</th>
                  <th className="w-28 px-3 py-2 text-left">Līdz, kg</th>
                  {MARKETS.map((mk) => (
                    <th key={mk} className="w-36 px-3 py-2 text-left">
                      {MARKET[mk]}
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {m.tiers.map((t, i) => {
                  const kg = num(t.max_kg);
                  return (
                    <tr key={t.key} className="border-t border-line align-top">
                      <td className="px-3 py-2">
                        <input
                          className={cn(inputCls, "font-semibold", errors[`methods.${id}.tiers.${i}.label`] && "border-red-400")}
                          value={t.label}
                          onChange={(e) => setTier(i, { label: e.target.value })}
                          aria-label="Izmēra nosaukums"
                        />
                        {Number.isFinite(kg) && kg > 0 && <span className="mt-1 block text-[11px] text-muted">≈ līdz {Math.floor((kg / 0.95) * 10) / 10} L eļļas sūtījumā</span>}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          inputMode="decimal"
                          className={cn(inputCls, "tabular-nums", errors[`methods.${id}.tiers.${i}.max_kg`] && "border-red-400")}
                          value={t.max_kg}
                          onChange={(e) => setTier(i, { max_kg: e.target.value })}
                          aria-label="Maksimālais svars kg"
                        />
                      </td>
                      {MARKETS.map((mk) => (
                        <td key={mk} className="px-3 py-2">
                          {priceCell(t.gross[mk], mk, (v) => setTier(i, { gross: { ...t.gross, [mk]: v } }), `tr-${id}-${i}-${mk}`, errors[`methods.${id}.tiers.${i}.${mk}`])}
                        </td>
                      ))}
                      <td className="px-1 py-2">
                        <button
                          type="button"
                          className="mt-1 grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
                          aria-label="Dzēst izmēru"
                          onClick={() => onChange({ tiers: m.tiers.filter((_, j) => j !== i) })}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={btn("outline", "sm")}
              onClick={() =>
                onChange({
                  tiers: [
                    ...m.tiers,
                    { key: `n${Date.now()}`, id: `T${m.tiers.length + 1}`, label: "Jauns izmērs", max_kg: "", gross: { ...(m.tiers.at(-1)?.gross ?? m.gross) } },
                  ],
                })
              }
            >
              + Pievienot izmēru
            </button>
            {omniva && (
              <button
                type="button"
                className={btn("ghost", "sm")}
                onClick={() =>
                  onChange({
                    tiers: DEFAULT_TIERS.parcel_locker.map((d, i) => ({
                      key: `d${Date.now()}-${i}`,
                      id: d.id,
                      label: d.label,
                      max_kg: str(d.max_kg),
                      gross: { ...(m.tiers[i]?.gross ?? m.gross) },
                    })),
                  })
                }
              >
                Atjaunot Omniva S / M / L
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Maks. vienības izmērs (L/kg)" htmlFor={`mx-${id}`} error={errors[`methods.${id}.max_item`]} hint="Tukšs = bez ierobežojuma">
          <input id={`mx-${id}`} inputMode="decimal" className={inputCls} value={m.max_item} onChange={(e) => onChange({ max_item: e.target.value })} />
        </Field>
        <div className="flex items-center gap-2.5 pt-6">
          <Switch size="sm" checked={m.free_over} onChange={(x) => onChange({ free_over: x })} label="Bezmaksas virs sliekšņa" />
          <span className="text-[13px] font-semibold text-ink/80">Bezmaksas virs sliekšņa</span>
        </div>
      </div>
    </div>
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
