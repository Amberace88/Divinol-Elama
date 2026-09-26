"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  FileClock,
  FileText,
  Link2Off,
  Mail,
  PenLine,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import {
  searchOrderCustomers,
  searchOrderProducts,
  createManualOrder,
  type OrderCustomerOption,
  type OrderProductOption,
} from "@/lib/admin/actions/manual-order";
import {
  autoReverseCharge,
  calcManualOrder,
  catalogUnitNet,
  ORDER_LOCALE_LABEL,
  ORDER_LOCALES,
  r2,
  type DocumentKind,
  type ManualOrderPayload,
} from "@/lib/admin/manual-order";
import { fmtMoney, fmtNumber, packLabelOf } from "@/lib/admin/format";
import { MARKET, MARKETS, PAYMENT_METHOD, SHIPPING_METHOD } from "@/lib/admin/labels";
import type { ActionResult } from "@/lib/admin/server";
import { cn } from "@/lib/utils";
import { Field, Spinner, Switch, useActionRunner } from "../client-ui";
import { btn, inputCls, selectCls, textareaCls } from "../styles";
import { Panel, Pill } from "../ui";
import { Thumb } from "../Thumb";

type Market = (typeof MARKETS)[number];
type Method = "pickup" | "parcel_locker" | "courier" | "freight";
type Addr = { street: string; city: string; postal_code: string; country: Market };

export type ManualOrderConfig = {
  vat: Record<Market, number>;
  shipping: {
    free_threshold: Record<Market, number>;
    methods: Record<string, { price_net: number | null; markets: Market[]; free_over?: boolean; enabled?: boolean; surcharge?: Partial<Record<Market, number>> }>;
  };
  dueDaysDefault: number;
  autoFinalInvoice: boolean;
};

type Line = {
  key: string;
  kind: "product" | "custom";
  variant_id: string | null;
  product_id: string | null;
  name: string;
  sku: string;
  unit: string;
  qty: string;
  /** typed price (used when priceTouched or for custom lines) */
  price: string;
  /** catalog list net price (product lines) */
  listPrice: number | null;
  priceTouched: boolean;
  image: string | null;
  stock: number | null;
  availability: string | null;
};

const METHODS: Method[] = ["pickup", "parcel_locker", "courier", "freight"];
const DOCS: { id: DocumentKind; title: string; desc: string; icon: typeof FileText }[] = [
  { id: "proforma", title: "Avansa rēķins (PR)", desc: "Priekšapmaksai. Pēc apmaksas gala rēķins tiek izrakstīts automātiski.", icon: FileClock },
  { id: "invoice", title: "Rēķins (ELA)", desc: "Ar apmaksas termiņu — B2B klientiem vai jau apmaksātam pirkumam.", icon: FileText },
  { id: "none", title: "Tikai pasūtījums", desc: "Bez rēķina — rēķinu varēs izrakstīt vēlāk pasūtījuma kartītē.", icon: ShoppingBag },
];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const parseNum = (s: string) => {
  const t = s.replace(/\s/g, "").replace(",", ".");
  if (t === "") return Number.NaN;
  return Number(t);
};
const numOrNull = (s: string) => {
  const n = parseNum(s);
  return Number.isFinite(n) ? n : null;
};
const intOrNull = (s: string) => {
  const n = parseNum(s);
  return Number.isFinite(n) ? n : null;
};
const fmtInput = (n: number, digits = 4) => String(Number(n.toFixed(digits))).replace(".", ",");
const emptyAddr = (country: Market): Addr => ({ street: "", city: "", postal_code: "", country });
const asMarket = (v: string | null | undefined): Market => (MARKETS.includes(v as Market) ? (v as Market) : "LV");
const asLocale = (v: string | null | undefined) => ((ORDER_LOCALES as readonly string[]).includes(v ?? "") ? (v as (typeof ORDER_LOCALES)[number]) : "lv");
let keySeq = 0;
const newKey = () => `l${Date.now().toString(36)}${(keySeq++).toString(36)}`;

// ───────────────────────── debounced server search ─────────────────────────
function useSearch<T>(fn: (q: string) => Promise<ActionResult<T[]>>) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onChange = (v: string) => {
    setQuery(v);
    clearTimeout(timer.current);
    const id = ++seq.current;
    if (v.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fn(v);
        if (id !== seq.current) return;
        setResults(res.ok ? res.data : []);
        setError(res.ok ? null : res.error);
      } catch {
        if (id === seq.current) setError("Meklēšana neizdevās");
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 250);
  };
  const reset = () => {
    seq.current++;
    clearTimeout(timer.current);
    setQuery("");
    setResults([]);
    setLoading(false);
    setError(null);
  };
  return { query, results, loading, error, onChange, reset };
}

function SearchBox({
  id,
  placeholder,
  value,
  onChange,
  loading,
  open,
  onOpenChange,
  children,
  empty,
}: {
  id: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  loading: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
  empty: boolean;
}) {
  const show = open && value.trim().length >= 2;
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        id={id}
        type="search"
        autoComplete="off"
        className={cn(inputCls, "pl-9 pr-9")}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onOpenChange(true);
        }}
        onFocus={() => onOpenChange(true)}
        onBlur={() => onOpenChange(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onOpenChange(false);
          if (e.key === "Enter") e.preventDefault();
        }}
        role="combobox"
        aria-expanded={show}
        aria-controls={`${id}-list`}
      />
      {loading && <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />}
      {show && (
        <div
          id={`${id}-list`}
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-[420px] overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-lift"
        >
          {empty ? <p className="px-3 py-4 text-center text-[13px] text-muted">{loading ? "Meklē…" : "Nekas netika atrasts"}</p> : children}
        </div>
      )}
    </div>
  );
}

function Seg<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[]; label: string }) {
  return (
    <div className="inline-flex w-full rounded-lg border border-line bg-slate-50 p-0.5" role="radiogroup" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="radio"
          aria-checked={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            "flex-1 rounded-md px-2.5 py-1.5 text-[13px] font-bold transition",
            value === it.value ? "bg-white text-navy-700 shadow-sm ring-1 ring-line" : "text-muted hover:text-navy-700",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────── form ─────────────────────────
export function ManualOrderForm({
  config,
  initialCustomer,
  defaultDocument = null,
}: {
  config: ManualOrderConfig;
  initialCustomer: OrderCustomerOption | null;
  defaultDocument?: DocumentKind | null;
}) {
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const [errors, setErrors] = useState<Record<string, string>>({});

  // customer
  const init = initialCustomer;
  const initMarket = asMarket(init?.market);
  const [selected, setSelected] = useState<OrderCustomerOption | null>(init);
  const [ctype, setCtype] = useState<"private" | "business">(init?.customer_type === "business" ? "business" : "private");
  const [name, setName] = useState(init?.full_name ?? "");
  const [company, setCompany] = useState(init?.company_name ?? "");
  const [regNo, setRegNo] = useState(init?.reg_no ?? "");
  const [vatNo, setVatNo] = useState(init?.vat_no ?? "");
  const [email, setEmail] = useState(init?.email ?? "");
  const [phone, setPhone] = useState(init?.phone ?? "");
  const [market, setMarket] = useState<Market>(initMarket);
  const [locale, setLocale] = useState(asLocale(init?.preferred_locale));
  const [billing, setBilling] = useState<Addr>(
    init?.address
      ? { ...init.address, country: asMarket(init.address.country) }
      : { ...emptyAddr(initMarket), street: init?.legal_address ?? "" },
  );

  // lines
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("0");

  // shipping
  const [method, setMethod] = useState<Method>("pickup");
  const [shipNet, setShipNet] = useState("");
  const [shipTouched, setShipTouched] = useState(false);
  const [sameAddr, setSameAddr] = useState(true);
  const [shipAddr, setShipAddr] = useState<Addr>(emptyAddr(initMarket));
  const [locker, setLocker] = useState("");

  // document & options
  const [doc, setDoc] = useState<DocumentKind>(defaultDocument ?? (init?.b2b_status === "approved" && init.payment_terms_days > 0 ? "invoice" : "proforma"));
  const [dueDays, setDueDays] = useState("");
  const [dueTouched, setDueTouched] = useState(false);
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [pmTouched, setPmTouched] = useState(false);
  const [payStatus, setPayStatus] = useState<"unpaid" | "paid">("unpaid");
  const [status, setStatus] = useState<"new" | "confirmed">("confirmed");
  const [rcMode, setRcMode] = useState<"auto" | "on" | "off">("auto");
  const [notes, setNotes] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendTouched, setSendTouched] = useState(false);

  const customers = useSearch<OrderCustomerOption>(searchOrderCustomers);
  const products = useSearch<OrderProductOption>(searchOrderProducts);
  const [custOpen, setCustOpen] = useState(false);
  const [prodOpen, setProdOpen] = useState(false);

  // ── derived ──
  const b2b = selected?.b2b_status === "approved";
  const b2bDiscount = b2b ? Number(selected?.discount_percent) || 0 : 0;
  const autoRc = autoReverseCharge(ctype, market, vatNo);
  const reverse = rcMode === "auto" ? autoRc : rcMode === "on";
  const vatRate = reverse ? 0 : Number(config.vat[market] ?? 21);
  const discountNum = numOrNull(discount) ?? 0;

  const linePrice = (l: Line) =>
    l.kind === "product" && !l.priceTouched && l.listPrice != null ? catalogUnitNet(l.listPrice, b2bDiscount) : (numOrNull(l.price) ?? Number.NaN);
  const calcLines = lines.map((l) => ({ qty: intOrNull(l.qty) ?? 0, unit_price_net: linePrice(l) }));
  const preShip = calcManualOrder(calcLines, { discountPercent: discountNum, shippingNet: 0, vatRate });

  // "no delivery / pickup" is always possible for a manual order (services, EE/LT customers collecting goods)
  function methodAvailableFor(m: Market, id: Method) {
    if (id === "pickup") return true;
    const c = config.shipping.methods[id];
    return !c || (c.enabled !== false && (c.markets ?? MARKETS).includes(m));
  }
  const methodCfg = config.shipping.methods[method];
  const methodAvailable = (m: Method) => methodAvailableFor(market, m);
  const threshold = Number(config.shipping.free_threshold?.[market] ?? 99999);
  const suggestedShip =
    !methodCfg || methodCfg.price_net == null
      ? 0
      : methodCfg.free_over && lines.length > 0 && r2(preShip.subtotal * (1 + vatRate / 100)) >= threshold
        ? 0
        : r2(Number(methodCfg.price_net) + Number(methodCfg.surcharge?.[market] ?? 0));
  const shipValue = shipTouched ? (numOrNull(shipNet) ?? Number.NaN) : suggestedShip;
  const calc = calcManualOrder(calcLines, { discountPercent: discountNum, shippingNet: Number.isFinite(shipValue) ? shipValue : 0, vatRate });

  const dueDefault = b2b && (selected?.payment_terms_days ?? 0) > 0 ? selected!.payment_terms_days : config.dueDaysDefault;
  const dueValue = dueTouched ? dueDays : String(dueDefault);
  const pmValue = pmTouched ? payMethod : doc === "invoice" ? "invoice" : "bank_transfer";
  const emailValid = EMAIL_RE.test(email.trim());
  const sendValue = sendTouched ? sendEmail : emailValid;

  // ── actions ──
  function pickCustomer(c: OrderCustomerOption) {
    setSelected(c);
    setCtype(c.customer_type === "business" || c.company_name ? "business" : "private");
    setName(c.full_name ?? "");
    setCompany(c.company_name ?? "");
    setRegNo(c.reg_no ?? "");
    setVatNo(c.vat_no ?? "");
    setEmail(c.email ?? "");
    setPhone(c.phone ?? "");
    const m = asMarket(c.market);
    setMarket(m);
    setLocale(asLocale(c.preferred_locale));
    setBilling(c.address ? { ...c.address, country: asMarket(c.address.country) } : { ...emptyAddr(m), street: c.legal_address ?? "" });
    setShipAddr(emptyAddr(m));
    setRcMode("auto");
    setDueTouched(false);
    if (c.b2b_status === "approved" && c.payment_terms_days > 0) setDoc("invoice");
    customers.reset();
    setCustOpen(false);
    setErrors({});
  }

  function unlinkCustomer() {
    setSelected(null);
  }

  function addVariant(p: OrderProductOption, v: OrderProductOption["variants"][number]) {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.variant_id === v.id);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: String((intOrNull(l.qty) ?? 0) + 1) } : l));
      return [
        ...ls,
        {
          key: newKey(),
          kind: "product",
          variant_id: v.id,
          product_id: p.product_id,
          name: p.name,
          sku: v.sku ?? "",
          unit: packLabelOf(v.size, v.unit),
          qty: "1",
          price: fmtInput(catalogUnitNet(v.price_net, b2bDiscount)),
          listPrice: v.price_net,
          priceTouched: false,
          image: v.image ?? p.image,
          stock: v.stock,
          availability: v.availability,
        },
      ];
    });
  }

  function addCustom() {
    setLines((ls) => [
      ...ls,
      { key: newKey(), kind: "custom", variant_id: null, product_id: null, name: "", sku: "", unit: "gab.", qty: "1", price: "", listPrice: null, priceTouched: true, image: null, stock: null, availability: null },
    ]);
  }

  const updLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const delLine = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));

  function changeMarket(m: Market) {
    setMarket(m);
    setBilling((b) => (b.country === market ? { ...b, country: m } : b));
    setShipAddr((b) => (b.country === market ? { ...b, country: m } : b));
    if (!methodAvailableFor(m, method)) setMethod("courier");
  }

  function submit() {
    const legal = [billing.street, [billing.postal_code, billing.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const payload: ManualOrderPayload = {
      user_id: selected?.id ?? null,
      email: email.trim(),
      phone: phone.trim(),
      market,
      locale,
      customer: {
        customer_type: ctype,
        name: name.trim(),
        company_name: ctype === "business" ? company.trim() : "",
        reg_no: ctype === "business" ? regNo.trim() : "",
        vat_no: ctype === "business" ? vatNo.trim() : "",
        legal_address: ctype === "business" ? legal : "",
      },
      billing_address: billing,
      shipping_address: method === "courier" || method === "freight" ? (sameAddr ? billing : shipAddr) : null,
      shipping_point: method === "parcel_locker" ? { name: locker.trim() } : null,
      shipping_method: method,
      shipping_net: (Number.isFinite(shipValue) ? shipValue : null) as number,
      payment_method: pmValue as ManualOrderPayload["payment_method"],
      payment_status: payStatus,
      status,
      document: doc,
      due_days: (intOrNull(dueValue) ?? null) as number,
      discount_percent: (numOrNull(discount) ?? null) as number,
      reverse_charge: rcMode === "auto" ? null : rcMode === "on",
      notes,
      admin_notes: adminNotes,
      send_email: sendValue,
      items: lines.map((l) => {
        const price = linePrice(l);
        return {
          kind: l.kind,
          variant_id: l.variant_id,
          name: l.name.trim(),
          sku: l.sku.trim(),
          unit: l.unit.trim(),
          qty: (intOrNull(l.qty) ?? null) as number,
          unit_price_net: (Number.isFinite(price) ? price : null) as number,
        };
      }),
    };
    setErrors({});
    run(() => createManualOrder(payload), {
      loading: "Izveido pasūtījumu…",
      onSuccess: (d) => router.push(`/admin/orders/${d.id}`),
      onError: (_e, fe) => setErrors(fe ?? {}),
    });
  }

  const err = (k: string) => errors[k];
  const docTitle = DOCS.find((d) => d.id === doc)!;
  const submitLabel = doc === "proforma" ? "Izveidot pasūtījumu + avansa rēķinu" : doc === "invoice" ? "Izveidot pasūtījumu + rēķinu" : "Izveidot pasūtījumu";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        {/* ───────── customer ───────── */}
        <Panel
          title="Klients"
          description="Meklējiet esošu klientu vai ievadiet jauna pircēja datus."
          actions={
            selected ? (
              <button type="button" className={btn("ghost", "sm")} onClick={unlinkCustomer} title="Pasūtījums netiks piesaistīts klienta kontam">
                <Link2Off className="h-3.5 w-3.5" /> Atsaistīt
              </button>
            ) : null
          }
        >
          <SearchBox
            id="cust-search"
            placeholder="Vārds, uzņēmums, e-pasts, reģ. nr., PVN nr., tālrunis…"
            value={customers.query}
            onChange={customers.onChange}
            loading={customers.loading}
            open={custOpen}
            onOpenChange={setCustOpen}
            empty={customers.results.length === 0}
          >
            {customers.results.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={selected?.id === c.id}
                onClick={() => pickCustomer(c)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-navy-50"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-50 text-navy-600">
                  {c.company_name ? <Building2 className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-ink">{c.company_name || c.full_name || c.email}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {[c.company_name && c.full_name, c.email, c.reg_no && `reģ. ${c.reg_no}`, c.market].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {c.b2b_status === "approved" && (
                  <Pill tone="navy" dot={false}>
                    B2B{c.discount_percent ? ` −${fmtNumber(c.discount_percent, 2)}%` : ""}
                  </Pill>
                )}
              </button>
            ))}
          </SearchBox>
          {customers.error && <p className="mt-1 text-[12px] text-red-600">{customers.error}</p>}

          {selected ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-navy-100 bg-navy-50/50 px-4 py-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-navy-700 text-[14px] font-extrabold text-brand-400">
                {(selected.company_name || selected.full_name || selected.email)[0]?.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink">{selected.company_name || selected.full_name || selected.email}</p>
                <p className="truncate text-[12px] text-muted">Pasūtījums būs redzams klienta kontā · {selected.email}</p>
              </div>
              {b2b ? (
                <div className="flex flex-wrap gap-1.5">
                  <Pill tone="navy">B2B apstiprināts</Pill>
                  {b2bDiscount > 0 && <Pill tone="green" dot={false}>Atlaide {fmtNumber(b2bDiscount, 2)}%</Pill>}
                  {selected.payment_terms_days > 0 && <Pill tone="blue" dot={false}>Termiņš {selected.payment_terms_days} d.</Pill>}
                </div>
              ) : (
                <Pill tone="gray" dot={false}>
                  {selected.b2b_status === "pending" ? "B2B gaida apstiprinājumu" : "Bez B2B atlaides"}
                </Pill>
              )}
            </div>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-[12px] text-muted">
              <PenLine className="h-3.5 w-3.5" /> Jauns pircējs — pasūtījums netiks piesaistīts kontam.
            </p>
          )}

          <div className="mt-5 space-y-4">
            <Seg
              label="Pircēja veids"
              value={ctype}
              onChange={setCtype}
              items={[
                { value: "private", label: "Privātpersona" },
                { value: "business", label: "Uzņēmums" },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {ctype === "business" && (
                <Field label="Uzņēmuma nosaukums" htmlFor="mo-company" error={err("customer.company_name")} className="sm:col-span-2">
                  <input id="mo-company" className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)} aria-invalid={Boolean(err("customer.company_name"))} />
                </Field>
              )}
              <Field label={ctype === "business" ? "Kontaktpersona" : "Vārds, uzvārds"} htmlFor="mo-name" error={err("customer.name")}>
                <input id="mo-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(err("customer.name"))} />
              </Field>
              <Field label="E-pasts" htmlFor="mo-email" error={err("email")}>
                <input id="mo-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(err("email"))} />
              </Field>
              <Field label="Tālrunis" htmlFor="mo-phone" error={err("phone")}>
                <input id="mo-phone" type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field label="Tirgus / PVN valsts" htmlFor="mo-market" hint={`PVN ${fmtNumber(config.vat[market], 2)}%`}>
                <select id="mo-market" className={selectCls} value={market} onChange={(e) => changeMarket(e.target.value as Market)}>
                  {MARKETS.map((m) => (
                    <option key={m} value={m}>
                      {MARKET[m]} ({m})
                    </option>
                  ))}
                </select>
              </Field>
              {ctype === "business" && (
                <>
                  <Field label="Reģistrācijas nr." htmlFor="mo-reg" error={err("customer.reg_no")}>
                    <input id="mo-reg" className={inputCls} value={regNo} onChange={(e) => setRegNo(e.target.value)} />
                  </Field>
                  <Field label="PVN maksātāja nr." htmlFor="mo-vat" error={err("customer.vat_no")} hint={autoRc ? "ES PVN nr. ārpus LV → reverse charge" : undefined}>
                    <input id="mo-vat" className={cn(inputCls, "uppercase")} value={vatNo} onChange={(e) => setVatNo(e.target.value)} placeholder="piem. EE101234567" />
                  </Field>
                </>
              )}
            </div>

            <fieldset>
              <legend className="mb-1.5 text-[13px] font-semibold text-ink/80">{ctype === "business" ? "Juridiskā adrese (rēķinam)" : "Adrese rēķinam"}</legend>
              <AddressFields value={billing} onChange={setBilling} idPrefix="mo-bill" />
            </fieldset>
          </div>
        </Panel>

        {/* ───────── lines ───────── */}
        <Panel
          title="Preces un pakalpojumi"
          description={b2bDiscount > 0 ? `Kataloga cenām automātiski piemērota klienta B2B atlaide ${fmtNumber(b2bDiscount, 2)}%. Cenas var labot.` : "Cenas bez PVN; tās var labot katrā rindā."}
          bodyClassName="p-0"
        >
          <div className="flex flex-col gap-2 border-b border-line/80 p-4 sm:flex-row">
            <div className="flex-1">
              <label htmlFor="prod-search" className="sr-only">
                Meklēt preci
              </label>
              <SearchBox
                id="prod-search"
                placeholder="Meklēt katalogā: nosaukums, SKU, SAE (piem. 5W-30)…"
                value={products.query}
                onChange={products.onChange}
                loading={products.loading}
                open={prodOpen}
                onOpenChange={setProdOpen}
                empty={products.results.length === 0}
              >
                {products.results.map((p) => (
                  <div key={p.product_id} className="flex gap-3 rounded-lg px-2.5 py-2 hover:bg-slate-50">
                    <Thumb src={p.image} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-ink">
                        {p.name}
                        {!p.is_active && <span className="ml-1.5 text-[11px] font-semibold text-orange-600">(neaktīvs)</span>}
                      </p>
                      <p className="mb-1.5 truncate text-[11px] text-muted">{[p.sae, p.base_sku].filter(Boolean).join(" · ") || "—"}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {p.variants.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            role="option"
                            aria-selected={false}
                            onClick={() => addVariant(p, v)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px] font-semibold transition hover:border-navy-400 hover:bg-navy-50",
                              v.is_active ? "border-line bg-white text-ink" : "border-dashed border-line bg-slate-50 text-muted",
                            )}
                            title={v.sku ? `SKU ${v.sku}` : undefined}
                          >
                            <Plus className="h-3 w-3 text-navy-500" />
                            {packLabelOf(v.size, v.unit) || "—"}
                            <span className="tabular-nums text-muted">{fmtMoney(catalogUnitNet(v.price_net, b2bDiscount))}</span>
                            {v.stock != null && (
                              <span className={cn("rounded px-1 text-[10px] font-bold", v.stock > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600")}>{v.stock} gab.</span>
                            )}
                            {v.availability === "on_order" && <span className="rounded bg-brand-50 px-1 text-[10px] font-bold text-brand-700">pasūtāms</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </SearchBox>
            </div>
            <button type="button" className={btn("outline")} onClick={addCustom}>
              <PenLine className="h-4 w-4" /> Brīva rinda
            </button>
          </div>

          {lines.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[14px] font-bold text-ink">Rindu vēl nav</p>
              <p className="mt-1 text-[13px] text-muted">Atrodiet preci katalogā vai pievienojiet brīvu rindu (pakalpojums, piegāde, cita prece).</p>
              {err("items") && <p className="mt-2 text-[12px] font-medium text-red-600">{err("items")}</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[13px]">
                <thead>
                  <tr className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                    <th className="border-b border-line bg-slate-50/95 px-4 py-2.5 pl-5 text-left">Nosaukums</th>
                    <th className="w-[84px] border-b border-line bg-slate-50/95 px-2 py-2.5 text-right">Daudz.</th>
                    <th className="w-[84px] border-b border-line bg-slate-50/95 px-2 py-2.5 text-left">Mērv.</th>
                    <th className="w-[124px] border-b border-line bg-slate-50/95 px-2 py-2.5 text-right">Cena bez PVN</th>
                    <th className="w-[64px] border-b border-line bg-slate-50/95 px-2 py-2.5 text-right">PVN</th>
                    <th className="w-[110px] border-b border-line bg-slate-50/95 px-2 py-2.5 text-right">Summa</th>
                    <th className="w-[44px] border-b border-line bg-slate-50/95 px-2 py-2.5 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const c = calc.lines[i];
                    const unitShown = l.kind === "product" && !l.priceTouched && l.listPrice != null ? fmtInput(catalogUnitNet(l.listPrice, b2bDiscount)) : l.price;
                    const qty = intOrNull(l.qty) ?? 0;
                    const low = l.stock != null && qty > l.stock;
                    return (
                      <tr key={l.key} className="align-top">
                        <td className="border-b border-line/70 px-4 py-2.5 pl-5">
                          {l.kind === "product" ? (
                            <div className="flex items-center gap-3">
                              <Thumb src={l.image} size={36} />
                              <div className="min-w-0">
                                <p className="font-semibold text-ink">{l.name}</p>
                                <p className="text-[11px] text-muted">
                                  {[l.sku && `SKU ${l.sku}`, l.stock != null ? `noliktavā ${l.stock}` : "atlikums netiek uzskaitīts"].filter(Boolean).join(" · ")}
                                  {low && <span className="ml-1 font-bold text-orange-600">· nepietiek atlikuma</span>}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              <input
                                className={cn(inputCls, "h-9 text-[13px]")}
                                placeholder="Apraksts (piem. Eļļas maiņa, transports…)"
                                value={l.name}
                                onChange={(e) => updLine(l.key, { name: e.target.value })}
                                aria-label={`${i + 1}. rindas nosaukums`}
                                aria-invalid={Boolean(err(`items.${i}.name`))}
                              />
                              <input
                                className={cn(inputCls, "h-8 w-40 text-[12px]")}
                                placeholder="Kods / SKU (nav obligāts)"
                                value={l.sku}
                                onChange={(e) => updLine(l.key, { sku: e.target.value })}
                                aria-label={`${i + 1}. rindas kods`}
                              />
                            </div>
                          )}
                          {err(`items.${i}.name`) && <p className="mt-1 text-[12px] font-medium text-red-600">{err(`items.${i}.name`)}</p>}
                        </td>
                        <td className="border-b border-line/70 px-2 py-2.5">
                          <input
                            inputMode="numeric"
                            className={cn(inputCls, "h-9 text-right text-[13px] tabular-nums")}
                            value={l.qty}
                            onChange={(e) => updLine(l.key, { qty: e.target.value.replace(/[^\d]/g, "") })}
                            aria-label={`${i + 1}. rindas daudzums`}
                            aria-invalid={Boolean(err(`items.${i}.qty`))}
                          />
                          {err(`items.${i}.qty`) && <p className="mt-1 text-[11px] text-red-600">{err(`items.${i}.qty`)}</p>}
                        </td>
                        <td className="border-b border-line/70 px-2 py-2.5">
                          {l.kind === "product" ? (
                            <p className="pt-2 text-muted">{l.unit || "gab."}</p>
                          ) : (
                            <input
                              className={cn(inputCls, "h-9 text-[13px]")}
                              value={l.unit}
                              onChange={(e) => updLine(l.key, { unit: e.target.value })}
                              aria-label={`${i + 1}. rindas mērvienība`}
                              maxLength={20}
                            />
                          )}
                        </td>
                        <td className="border-b border-line/70 px-2 py-2.5">
                          <input
                            inputMode="decimal"
                            className={cn(inputCls, "h-9 text-right text-[13px] tabular-nums")}
                            value={unitShown}
                            onChange={(e) => updLine(l.key, { price: e.target.value, priceTouched: true })}
                            aria-label={`${i + 1}. rindas cena bez PVN`}
                            aria-invalid={Boolean(err(`items.${i}.unit_price_net`))}
                          />
                          {l.kind === "product" && l.priceTouched && l.listPrice != null && (
                            <button type="button" className="mt-1 text-[11px] font-semibold text-navy-600 hover:underline" onClick={() => updLine(l.key, { priceTouched: false })}>
                              ↺ kataloga cena
                            </button>
                          )}
                          {err(`items.${i}.unit_price_net`) && <p className="mt-1 text-[11px] text-red-600">{err(`items.${i}.unit_price_net`)}</p>}
                        </td>
                        <td className="border-b border-line/70 px-2 py-2.5 pt-4 text-right tabular-nums text-muted" title="PVN likme visam dokumentam">
                          {fmtNumber(vatRate, 2)}%
                        </td>
                        <td className="border-b border-line/70 px-2 py-2.5 pt-4 text-right font-bold tabular-nums text-ink">
                          {Number.isFinite(c?.line) ? fmtMoney(c.line) : "—"}
                          {discountNum > 0 && Number.isFinite(c?.unit) && <p className="text-[11px] font-normal text-muted">á {fmtMoney(c.unit)}</p>}
                        </td>
                        <td className="border-b border-line/70 px-2 py-2.5 pr-4 text-right">
                          <button type="button" className={btn("ghost", "sm", "text-red-600 hover:bg-red-50")} onClick={() => delLine(l.key)} aria-label={`Dzēst ${i + 1}. rindu`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid gap-4 border-t border-line/80 bg-slate-50/50 px-5 py-4 sm:grid-cols-[200px_1fr] sm:items-start">
            <Field label="Atlaide visam pasūtījumam, %" htmlFor="mo-discount" error={err("discount_percent")} hint="Tiek iestrādāta katras rindas cenā">
              <input id="mo-discount" inputMode="decimal" className={inputCls} value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </Field>
            <p className="text-[12px] text-muted sm:pt-7">
              PVN likme visam dokumentam: <strong className="text-ink">{fmtNumber(vatRate, 2)}%</strong>
              {reverse ? " (reverse charge)" : ` (${MARKET[market]})`}. Rēķinā vienā dokumentā var būt tikai viena PVN likme.
            </p>
          </div>
        </Panel>

        {/* ───────── shipping ───────── */}
        <Panel title="Piegāde" actions={<Truck className="h-4 w-4 text-muted" />}>
          <div className="grid gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Piegādes veids">
            {METHODS.map((m) => {
              const available = methodAvailable(m);
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={method === m}
                  disabled={!available}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40",
                    method === m ? "border-navy-700 bg-navy-700 text-white shadow-card" : "border-line bg-white text-ink hover:border-navy-300",
                  )}
                >
                  {m === "pickup" ? "Bez piegādes / saņemšana" : SHIPPING_METHOD[m]}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
            <Field
              label="Piegādes cena bez PVN"
              htmlFor="mo-ship"
              error={err("shipping_net")}
              hint={shipTouched ? undefined : method === "freight" ? "Kravas cenu ievadiet manuāli" : suggestedShip === 0 && methodCfg?.price_net ? "Bezmaksas (virs sliekšņa)" : "Pēc piegādes iestatījumiem"}
              aside={
                shipTouched ? (
                  <button type="button" className="text-[11px] font-semibold text-navy-600 hover:underline" onClick={() => setShipTouched(false)}>
                    ↺ automātiski
                  </button>
                ) : null
              }
            >
              <input
                id="mo-ship"
                inputMode="decimal"
                className={inputCls}
                value={shipTouched ? shipNet : fmtInput(suggestedShip, 2)}
                onChange={(e) => {
                  setShipTouched(true);
                  setShipNet(e.target.value);
                }}
              />
            </Field>
            <div>
              {method === "parcel_locker" && (
                <Field label="Pakomāts (nosaukums / adrese)" htmlFor="mo-locker">
                  <input id="mo-locker" className={inputCls} value={locker} onChange={(e) => setLocker(e.target.value)} placeholder="piem. Omniva, Rīga Origo" />
                </Field>
              )}
              {(method === "courier" || method === "freight") && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-ink/80">
                    <Switch checked={sameAddr} onChange={setSameAddr} label="Piegādes adrese sakrīt ar rēķina adresi" size="sm" />
                    Piegādes adrese sakrīt ar rēķina adresi
                  </label>
                  {!sameAddr && <AddressFields value={shipAddr} onChange={setShipAddr} idPrefix="mo-ship-addr" />}
                </div>
              )}
              {method === "pickup" && <p className="pt-1 text-[13px] text-muted sm:pt-7">Klients preci saņem noliktavā vai piegāde nav nepieciešama (pakalpojumi). Pasūtījums neparādīsies sarakstā „Jānosūta”.</p>}
            </div>
          </div>
        </Panel>

        <Panel title="Piezīmes">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Komentārs pasūtījumā" htmlFor="mo-notes" hint="Redzams klientam (e-pastā un kontā)">
              <textarea id="mo-notes" rows={3} className={textareaCls} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
            </Field>
            <Field label="Iekšējā piezīme" htmlFor="mo-admin-notes" hint="Redzama tikai administratoriem">
              <textarea id="mo-admin-notes" rows={3} className={textareaCls} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} maxLength={5000} />
            </Field>
          </div>
        </Panel>
      </div>

      {/* ───────── right column ───────── */}
      <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
        <Panel title="Dokuments">
          <div className="space-y-2" role="radiogroup" aria-label="Izveidojamais dokuments">
            {DOCS.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={doc === d.id}
                onClick={() => setDoc(d.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                  doc === d.id ? "border-navy-700 bg-navy-50/70 ring-1 ring-navy-700" : "border-line hover:border-navy-300",
                )}
              >
                <d.icon className={cn("mt-0.5 h-4 w-4 shrink-0", doc === d.id ? "text-navy-700" : "text-muted")} />
                <span>
                  <span className="block text-[13px] font-bold text-ink">{d.title}</span>
                  <span className="block text-[12px] text-muted">{d.desc}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {doc !== "none" && (
              <Field label="Apmaksas termiņš, d." htmlFor="mo-due" error={err("due_days")}>
                <input
                  id="mo-due"
                  inputMode="numeric"
                  className={inputCls}
                  value={dueValue}
                  onChange={(e) => {
                    setDueTouched(true);
                    setDueDays(e.target.value.replace(/[^\d]/g, ""));
                  }}
                />
              </Field>
            )}
            <Field label="Apmaksas veids" htmlFor="mo-pm" className={doc === "none" ? "col-span-2" : undefined}>
              <select
                id="mo-pm"
                className={selectCls}
                value={pmValue}
                onChange={(e) => {
                  setPmTouched(true);
                  setPayMethod(e.target.value);
                }}
              >
                {Object.entries(PAYMENT_METHOD).filter(([k]) => !k.startsWith("montonio")).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-ink/80">Apmaksa</p>
              <Seg
                label="Apmaksas statuss"
                value={payStatus}
                onChange={setPayStatus}
                items={[
                  { value: "unpaid", label: "Neapmaksāts" },
                  { value: "paid", label: "Apmaksāts" },
                ]}
              />
              {payStatus === "paid" && doc === "proforma" && (
                <p className="mt-1.5 text-[12px] text-emerald-700">
                  {config.autoFinalInvoice ? "Uzreiz tiks izrakstīts arī apmaksāts gala rēķins (ELA)." : "Automātiskais gala rēķins ir izslēgts iestatījumos."}
                </p>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-ink/80">Pasūtījuma statuss</p>
              <Seg
                label="Pasūtījuma statuss"
                value={status}
                onChange={setStatus}
                items={[
                  { value: "new", label: "Jauns" },
                  { value: "confirmed", label: "Apstiprināts" },
                ]}
              />
            </div>
            <Field label="Reverse charge (PVN 0%)" htmlFor="mo-rc" error={err("reverse_charge")}>
              <select id="mo-rc" className={selectCls} value={rcMode} onChange={(e) => setRcMode(e.target.value as typeof rcMode)}>
                <option value="auto">Automātiski — {autoRc ? "piemērot" : "nepiemērot"}</option>
                <option value="on">Piemērot (ES B2B, PVN 0%)</option>
                <option value="off">Nepiemērot</option>
              </select>
            </Field>
            <Field label="Klienta valoda (e-pasti)" htmlFor="mo-locale" hint="Rēķina PDF vienmēr latviešu valodā">
              <select id="mo-locale" className={selectCls} value={locale} onChange={(e) => setLocale(asLocale(e.target.value))}>
                {ORDER_LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {ORDER_LOCALE_LABEL[l]}
                  </option>
                ))}
              </select>
            </Field>
            <label className={cn("flex items-start gap-2.5 rounded-xl border px-3 py-2.5", sendValue ? "border-navy-200 bg-navy-50/50" : "border-line")}>
              <Switch
                checked={sendValue}
                onChange={(v) => {
                  setSendTouched(true);
                  setSendEmail(v);
                }}
                label="Nosūtīt klientam e-pastu"
                size="sm"
                disabled={!emailValid}
              />
              <span className="text-[13px]">
                <span className="flex items-center gap-1.5 font-bold text-ink">
                  <Mail className="h-3.5 w-3.5 text-navy-500" /> Nosūtīt klientam e-pastu
                </span>
                <span className="block text-[12px] text-muted">
                  {emailValid ? `Pasūtījuma apstiprinājums${doc !== "none" ? ` ar ${doc === "proforma" ? "avansa rēķinu" : "rēķinu"} PDF` : ""} uz ${email.trim()}` : "Norādiet klienta e-pastu"}
                </span>
              </span>
            </label>
            {err("send_email") && <p className="text-[12px] text-red-600">{err("send_email")}</p>}
          </div>
        </Panel>

        <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="h-1 bg-[repeating-linear-gradient(-45deg,var(--color-brand-400)_0_10px,var(--color-navy-700)_10px_20px)]" aria-hidden />
          <div className="p-5">
            <dl className="space-y-1.5 text-[13px]">
              <Row label={`Preces bez PVN (${lines.length} rindas)`} value={fmtMoney(r2(calc.subtotal + calc.discount))} />
              {calc.discount > 0 && <Row label={`Atlaide ${fmtNumber(discountNum, 2)}%`} value={`−${fmtMoney(calc.discount)}`} />}
              <Row label={`Piegāde (${method === "pickup" ? "nav" : SHIPPING_METHOD[method]})`} value={fmtMoney(calc.shipping)} />
              <Row label="Kopā bez PVN" value={fmtMoney(calc.net)} strong />
              <Row label={`PVN ${fmtNumber(vatRate, 2)}%`} value={fmtMoney(calc.vat)} />
              <div className="!mt-3 flex items-baseline justify-between border-t border-line pt-3">
                <dt className="text-[14px] font-bold text-ink">Kopā apmaksai</dt>
                <dd className="text-[24px] font-extrabold tabular-nums text-ink">{fmtMoney(calc.total)}</dd>
              </div>
              {reverse && (
                <p className="!mt-3 rounded-lg bg-navy-50 px-3 py-2 text-[12px] font-semibold text-navy-700">Reverse charge — PVN 0% (ES B2B piegāde, PVN maksā pircējs)</p>
              )}
            </dl>
            {Object.keys(errors).length > 0 && (
              <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
                Pārbaudiet iezīmētos laukus.
              </p>
            )}
            <button type="button" className={btn("primary", "md", "mt-4 h-11 w-full text-[14px]")} disabled={pending || lines.length === 0} onClick={submit}>
              {pending ? <Spinner /> : <CheckCircle2 className="h-4 w-4" />} {submitLabel}
            </button>
            <p className="mt-2 text-center text-[12px] text-muted">
              {docTitle.id === "none" ? "Rēķins netiks izrakstīts." : `Numurs tiks piešķirts automātiski (${doc === "proforma" ? "PR-" : "ELA-"}…).`} Atlikumi tiks norakstīti uzreiz.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={strong ? "font-bold tabular-nums text-ink" : "tabular-nums text-ink"}>{value}</dd>
    </div>
  );
}

function AddressFields({ value, onChange, idPrefix }: { value: Addr; onChange: (a: Addr) => void; idPrefix: string }) {
  const set = (patch: Partial<Addr>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_140px_110px_110px]">
      <input id={`${idPrefix}-street`} className={inputCls} placeholder="Iela, māja" value={value.street} onChange={(e) => set({ street: e.target.value })} aria-label="Iela, māja" />
      <input id={`${idPrefix}-city`} className={inputCls} placeholder="Pilsēta" value={value.city} onChange={(e) => set({ city: e.target.value })} aria-label="Pilsēta" />
      <input id={`${idPrefix}-zip`} className={inputCls} placeholder="Pasta indekss" value={value.postal_code} onChange={(e) => set({ postal_code: e.target.value })} aria-label="Pasta indekss" />
      <select id={`${idPrefix}-country`} className={selectCls} value={value.country} onChange={(e) => set({ country: asMarket(e.target.value) })} aria-label="Valsts">
        {MARKETS.map((m) => (
          <option key={m} value={m}>
            {MARKET[m]}
          </option>
        ))}
      </select>
    </div>
  );
}
