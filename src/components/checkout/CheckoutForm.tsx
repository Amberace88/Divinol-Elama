"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  Banknote,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  CreditCard,
  FileText,
  Info,
  Landmark,
  LoaderCircle,
  LockKeyhole,
  Package,
  ShoppingBag,
  Store,
  Truck,
  UserRound,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { gross } from "@/lib/commerce";
import { computeTotals } from "@/lib/shop/totals";
import { quoteShippingFromSettings, type ShipMethodId, type ShipQuote } from "@/lib/shop/shipping";
import { usePricing } from "@/components/providers/PriceProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useCartSummary } from "@/components/cart/useCartSummary";
import { MarketSwitcherInline } from "@/components/cart/MarketSwitcherInline";
import { buttonClass } from "@/components/ui/Button";
import { useMoney } from "@/components/ui/useMoney";
import { cn } from "@/lib/utils";
import { placeOrder, type PlaceOrderPayload } from "@/app/[locale]/checkout/actions";
import { ChoiceCard } from "./ChoiceCard";
import { OrderSummary, type SummaryTotals } from "./OrderSummary";
import { ParcelLockerPicker } from "./ParcelLockerPicker";
import type { ParcelLocker } from "./lockers";

type PaymentId = "card" | "bank_transfer" | "invoice" | "cash_on_pickup";
const PAYMENTS: PaymentId[] = ["card", "bank_transfer", "invoice", "cash_on_pickup"];
const CARD_ENABLED = process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Form = {
  email: string;
  phone: string;
  name: string;
  customerType: "private" | "business";
  company: string;
  regNo: string;
  vatNo: string;
  method: ShipMethodId | null;
  locker: ParcelLocker | null;
  street: string;
  city: string;
  postal: string;
  billingSame: boolean;
  bStreet: string;
  bCity: string;
  bPostal: string;
  payment: PaymentId;
  notes: string;
  terms: boolean;
};

const INITIAL: Form = {
  email: "",
  phone: "",
  name: "",
  customerType: "private",
  company: "",
  regNo: "",
  vatNo: "",
  method: null,
  locker: null,
  street: "",
  city: "",
  postal: "",
  billingSame: true,
  bStreet: "",
  bCity: "",
  bPostal: "",
  payment: "bank_transfer",
  notes: "",
  terms: false,
};

const METHOD_ICON: Record<ShipMethodId, React.ReactNode> = {
  pickup: <Warehouse className="size-5" aria-hidden />,
  parcel_locker: <Package className="size-5" aria-hidden />,
  courier: <Truck className="size-5" aria-hidden />,
  freight: <Truck className="size-5" aria-hidden />,
};
const PAY_ICON: Record<PaymentId, React.ReactNode> = {
  card: <CreditCard className="size-5" aria-hidden />,
  bank_transfer: <Landmark className="size-5" aria-hidden />,
  invoice: <FileText className="size-5" aria-hidden />,
  cash_on_pickup: <Banknote className="size-5" aria-hidden />,
};

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-7" aria-labelledby={`step-${n}`}>
      <h2 id={`step-${n}`} className="mb-5 flex items-center gap-3 text-lg font-extrabold tracking-tight text-ink">
        <span
          className={cn(
            "grid size-8 place-items-center rounded-full text-[14px] font-extrabold transition",
            done ? "bg-emerald-500 text-white" : "bg-navy-700 text-brand-400",
          )}
        >
          {done ? <Check className="size-4" strokeWidth={3.5} aria-hidden /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  hint,
  optional,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  optional?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">
        {label}
        {optional && <span className="ml-1 font-normal text-muted">({optional})</span>}
        {children}
      </label>
      {error ? (
        <p className="-mt-0.5 flex items-center gap-1 text-[12px] font-semibold text-danger">
          <CircleAlert className="size-3.5" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="-mt-0.5 text-[12px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const inputCls = (err?: string) => cn("input mt-1.5 mb-1.5 font-normal", err && "border-danger ring-4 ring-red-100");

export function CheckoutForm() {
  const t = useTranslations("checkout");
  const tm = useTranslations("market");
  const tc = useTranslations("cart");
  const locale = useLocale();
  const router = useRouter();
  const money = useMoney();
  const settings = useSettings();
  const pricing = usePricing();
  const s = useCartSummary();
  const [form, setForm] = useState<Form>(INITIAL);
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);
  const [pending, start] = useTransition();
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Prefill from the signed-in profile once it arrives.
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  if (pricing.profile && prefilledFor !== pricing.profile.id) {
    const p = pricing.profile;
    setPrefilledFor(p.id);
    setForm((f) => ({
      ...f,
      email: f.email || p.email || "",
      name: f.name || p.full_name || "",
      company: f.company || p.company_name || "",
      customerType: p.customer_type === "business" || p.b2b_status === "approved" ? "business" : f.customerType,
      payment: p.b2b_status === "approved" ? "invoice" : f.payment,
    }));
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const market = pricing.market;
  const vatRate = settings.vat?.[market] ?? 21;
  const ctx = { market, b2b: pricing.b2b, discountPercent: pricing.discountPercent };
  const reverse = pricing.b2b && market !== "LV" && form.customerType === "business" && form.vatNo.trim() !== "";

  const base = computeTotals(s.items, ctx, vatRate, 0, reverse);
  const quotes = quoteShippingFromSettings(settings.shipping, market, s.items, base.subtotalGross);
  const quote: ShipQuote | undefined = quotes.find((q) => q.id === form.method && q.available);
  const method = quote?.id ?? null;
  const shipNet = quote?.price_net ?? 0;
  const totals = computeTotals(s.items, ctx, vatRate, shipNet, reverse);
  const needsFreight = quotes.find((q) => q.id === "freight")?.available ?? false;

  const payAvailable = (p: PaymentId) =>
    p === "card" ? CARD_ENABLED : p === "invoice" ? pricing.b2b : p === "cash_on_pickup" ? method === "pickup" : true;
  const payment: PaymentId = payAvailable(form.payment) ? form.payment : "bank_transfer";
  const visiblePayments = PAYMENTS.filter((p) => p !== "invoice" || pricing.b2b).filter((p) => p !== "cash_on_pickup" || method === "pickup");

  const shipText = (q: ShipQuote) => {
    if (q.price_net == null) return t("onRequest");
    if (q.price_net === 0) return t("free");
    return money(pricing.b2b || reverse ? q.price_net : gross(q.price_net, vatRate));
  };

  const needsAddress = method === "courier" || method === "freight";

  // ── validation ──
  const errors: Partial<Record<keyof Form | "method", string>> = {};
  if (!EMAIL_RE.test(form.email.trim())) errors.email = t("errors.invalid_email");
  if (form.phone.replace(/\D/g, "").length < 6) errors.phone = t("errors.phone");
  if (form.name.trim().length < 2) errors.name = t("errors.name");
  if (form.customerType === "business") {
    if (!form.company.trim()) errors.company = t("errors.company");
    if (!form.regNo.trim()) errors.regNo = t("errors.company");
  }
  if (!method) errors.method = t("errors.shippingMethod");
  if (method === "parcel_locker" && !form.locker) errors.locker = t("errors.shipping_point_required");
  if (needsAddress) {
    if (!form.street.trim()) errors.street = t("errors.address_required");
    if (!form.city.trim()) errors.city = t("errors.address_required");
    if (!form.postal.trim()) errors.postal = t("errors.address_required");
  }
  if (form.customerType === "business" && !(needsAddress && form.billingSame) && !form.bStreet.trim()) {
    errors.bStreet = t("errors.address_required");
  }
  if (!form.terms) errors.terms = t("errors.terms");
  const err = (k: keyof typeof errors) => (attempted ? errors[k] : undefined);

  const contactDone = !errors.email && !errors.phone && !errors.name;
  const buyerDone = !errors.company && !errors.regNo && !errors.bStreet;
  const deliveryDone = Boolean(method) && !errors.locker && !errors.street && !errors.city && !errors.postal;

  const summaryTotals: SummaryTotals = {
    b2b: pricing.b2b,
    discount: pricing.discountPercent,
    vatRate,
    reverse,
    subtotalNet: totals.subtotalNet,
    shippingNet: quote ? quote.price_net : null,
    shippingLabel: !quote ? null : quote.price_net == null ? t("shippingTbd") : quote.price_net === 0 ? t("free") : null,
    vat: totals.vat,
    total: totals.total,
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    setServerError(null);
    const first = Object.values(errors)[0];
    if (first) {
      toast.error(first);
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    const shipAddr = needsAddress
      ? { street: form.street.trim(), city: form.city.trim(), postal_code: form.postal.trim(), country: market }
      : null;
    const billAddr =
      form.customerType === "business"
        ? needsAddress && form.billingSame
          ? shipAddr
          : { street: form.bStreet.trim(), city: form.bCity.trim(), postal_code: form.bPostal.trim(), country: market }
        : shipAddr;
    const payload: PlaceOrderPayload = {
      email: form.email.trim(),
      phone: form.phone.trim(),
      market,
      locale,
      customer: {
        name: form.name.trim(),
        company_name: form.customerType === "business" ? form.company.trim() : null,
        reg_no: form.customerType === "business" ? form.regNo.trim() : null,
        vat_no: form.customerType === "business" && form.vatNo.trim() ? form.vatNo.trim() : null,
        customer_type: form.customerType,
      },
      shipping_method: method!,
      shipping_point:
        method === "parcel_locker" && form.locker
          ? { provider: form.locker.provider, id: form.locker.id, name: form.locker.name, city: form.locker.city, address: form.locker.address }
          : method === "pickup"
            ? { provider: "warehouse", id: "riga-ventspils-51", name: settings.company.warehouse }
            : null,
      shipping_address: shipAddr,
      billing_address: billAddr,
      payment_method: payment,
      notes: form.notes.trim() || null,
      items: s.items.map((i) => ({ slug: i.slug, sku: i.sku, size: i.size, unit: i.unit, qty: i.qty })),
    };
    start(async () => {
      const res = await placeOrder(payload);
      if (!res.ok) {
        const msg =
          res.code === "product_not_found"
            ? t("errors.product_not_found", { slug: s.items.find((i) => i.slug === res.slug)?.name ?? res.slug ?? "" })
            : t.has(`errors.${res.code}`)
              ? t(`errors.${res.code}` as "errors.generic")
              : t("errors.generic");
        setServerError(msg);
        toast.error(msg);
        return;
      }
      setPlaced(true);
      s.clear();
      router.push({
        pathname: "/checkout/success",
        query: { n: res.number, t: res.total.toFixed(2), p: res.payment, ...(res.invoice ? { inv: res.invoice } : {}) },
      });
    });
  };

  if (!s.ready || placed) {
    return (
      <div className="grid min-h-[40vh] place-items-center" aria-busy="true">
        <LoaderCircle className="size-8 animate-spin text-navy-400" aria-hidden />
      </div>
    );
  }

  if (s.items.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-dashed border-navy-200 bg-canvas px-6 py-16 text-center">
        <ShoppingBag className="mb-4 size-10 text-navy-300" aria-hidden />
        <p className="text-xl font-extrabold text-ink">{t("emptyTitle")}</p>
        <p className="mt-1.5 text-[14px] text-muted">{t("emptyText")}</p>
        <Link href="/catalog" className={buttonClass("primary", "md", "mt-6")}>
          {tc("browse")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-8 lg:grid-cols-12">
      <div className="grid gap-5 lg:col-span-7 xl:col-span-8">
        {/* mobile summary toggle */}
        <div className="rounded-3xl border border-line bg-surface shadow-card lg:hidden">
          <button
            type="button"
            onClick={() => setSummaryOpen((o) => !o)}
            aria-expanded={summaryOpen}
            className="flex w-full items-center justify-between gap-3 px-5 py-4"
          >
            <span className="flex items-center gap-2 text-[14px] font-bold text-ink">
              <ShoppingBag className="size-4 text-navy-500" aria-hidden />
              {t("summary")} · {tc("items", { count: s.count })}
              <ChevronDown className={cn("size-4 transition-transform", summaryOpen && "rotate-180")} aria-hidden />
            </span>
            <span className="text-lg font-extrabold tabular-nums text-navy-700">{money(totals.total)}</span>
          </button>
          <AnimatePresence initial={false}>
            {summaryOpen && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="border-t border-line px-5 pb-5">
                  <OrderSummary lines={s.lines} totals={summaryTotals} compact />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 1. contact */}
        <Step n={1} title={t("steps.contact")} done={contactDone}>
          {pricing.profile ? (
            <p className="mb-4 flex items-center gap-2 rounded-xl bg-canvas px-3.5 py-2.5 text-[13px] text-ink/75">
              <UserRound className="size-4 text-navy-500" aria-hidden />
              {t("loggedInAs", { email: pricing.profile.email })}
            </p>
          ) : (
            <p className="mb-4 rounded-xl bg-canvas px-3.5 py-2.5 text-[13px] text-ink/75">
              {t.rich("haveAccount", {
                link: (c) => (
                  <Link href="/login" className="font-bold text-navy-600 underline underline-offset-2">
                    {c}
                  </Link>
                ),
              })}
            </p>
          )}
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            <Field label={t("email")} error={err("email")} hint={t("emailHint")} className="sm:col-span-2">
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                aria-invalid={Boolean(err("email")) || undefined}
                className={inputCls(err("email"))}
              />
            </Field>
            <Field label={t("name")} error={err("name")}>
              <input autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(err("name")) || undefined} className={inputCls(err("name"))} />
            </Field>
            <Field label={t("phone")} error={err("phone")} hint={t("phoneHint")}>
              <input
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                aria-invalid={Boolean(err("phone")) || undefined}
                className={inputCls(err("phone"))}
                placeholder={market === "LV" ? "+371" : market === "EE" ? "+372" : "+370"}
              />
            </Field>
          </div>
        </Step>

        {/* 2. buyer */}
        <Step n={2} title={t("steps.customer")} done={buyerDone}>
          <div role="radiogroup" aria-label={t("customerType")} className="grid grid-cols-2 gap-2">
            {(["private", "business"] as const).map((ct) => (
              <button
                key={ct}
                type="button"
                role="radio"
                aria-checked={form.customerType === ct}
                onClick={() => set("customerType", ct)}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 rounded-xl border-2 text-[14px] font-bold transition",
                  form.customerType === ct ? "border-navy-700 bg-navy-50/60 text-navy-700" : "border-line text-ink/70 hover:border-navy-200",
                )}
              >
                {ct === "private" ? <UserRound className="size-4" aria-hidden /> : <Building2 className="size-4" aria-hidden />}
                {t(ct)}
              </button>
            ))}
          </div>
          <AnimatePresence initial={false}>
            {form.customerType === "business" && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid gap-x-4 gap-y-2 pt-5 sm:grid-cols-2">
                  <Field label={t("companyName")} error={err("company")} className="sm:col-span-2">
                    <input autoComplete="organization" value={form.company} onChange={(e) => set("company", e.target.value)} aria-invalid={Boolean(err("company")) || undefined} className={inputCls(err("company"))} />
                  </Field>
                  <Field label={t("regNo")} error={err("regNo")}>
                    <input value={form.regNo} onChange={(e) => set("regNo", e.target.value)} aria-invalid={Boolean(err("regNo")) || undefined} className={inputCls(err("regNo"))} />
                  </Field>
                  <Field label={t("vatNo")} hint={pricing.b2b && market !== "LV" ? t("vatNoHint") : undefined}>
                    <input value={form.vatNo} onChange={(e) => set("vatNo", e.target.value.toUpperCase())} className={inputCls()} placeholder={`${market}…`} />
                  </Field>
                  {!(needsAddress && form.billingSame) && (
                    <fieldset className="grid gap-x-4 gap-y-2 sm:col-span-2 sm:grid-cols-6">
                      <legend className="mb-2 text-[13px] font-extrabold text-ink">{t("billingTitle")}</legend>
                      <Field label={t("address.street")} error={err("bStreet")} className="sm:col-span-6">
                        <input autoComplete="billing street-address" value={form.bStreet} onChange={(e) => set("bStreet", e.target.value)} aria-invalid={Boolean(err("bStreet")) || undefined} className={inputCls(err("bStreet"))} />
                      </Field>
                      <Field label={t("address.city")} className="sm:col-span-4">
                        <input autoComplete="billing address-level2" value={form.bCity} onChange={(e) => set("bCity", e.target.value)} className={inputCls()} />
                      </Field>
                      <Field label={t("address.postal")} className="sm:col-span-2">
                        <input autoComplete="billing postal-code" value={form.bPostal} onChange={(e) => set("bPostal", e.target.value)} className={inputCls()} />
                      </Field>
                    </fieldset>
                  )}
                  {!pricing.b2b && (
                    <p className="text-[12.5px] text-muted sm:col-span-2">
                      {t.rich("b2bApply", {
                        link: (c) => (
                          <Link href="/business" className="font-bold text-navy-600 underline underline-offset-2">
                            {c}
                          </Link>
                        ),
                      })}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Step>

        {/* 3. delivery */}
        <Step n={3} title={t("steps.delivery")} done={deliveryDone}>
          <MarketSwitcherInline />
          {needsFreight && (
            <p className="mt-4 flex gap-2 rounded-xl bg-brand-50 p-3 text-[12.5px] leading-relaxed text-brand-700 ring-1 ring-brand-200">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("freightInfo")}
            </p>
          )}
          <div role="radiogroup" aria-label={t("steps.delivery")} className="mt-4 grid gap-2.5">
            {quotes
              .filter((q) => q.reason !== "disabled" && !(q.id === "freight" && !q.available))
              .map((q) => (
                <ChoiceCard
                  key={q.id}
                  name="shipping"
                  value={q.id}
                  checked={method === q.id}
                  disabled={!q.available}
                  onChange={(v) => set("method", v as ShipMethodId)}
                  icon={METHOD_ICON[q.id]}
                  title={t(`methods.${q.id}`)}
                  text={
                    !q.available
                      ? q.reason === "market"
                        ? t("unavailableMarket")
                        : q.reason === "weight"
                          ? t("unavailableWeight")
                          : t("unavailableSize")
                      : q.id === "pickup"
                        ? `${settings.company.warehouse}${settings.company.hours ? ` · ${settings.company.hours}` : ""}`
                        : t(`methods.${q.id}Text`)
                  }
                  aside={q.available ? shipText(q) : undefined}
                />
              ))}
          </div>
          {attempted && errors.method && (
            <p className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-danger">
              <CircleAlert className="size-3.5" aria-hidden />
              {errors.method}
            </p>
          )}

          <AnimatePresence initial={false} mode="wait">
            {method === "parcel_locker" && (
              <motion.div key="locker" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5">
                <ParcelLockerPicker market={market} value={form.locker} onChange={(v) => set("locker", v)} invalid={Boolean(err("locker"))} />
              </motion.div>
            )}
            {needsAddress && (
              <motion.fieldset key="address" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 grid gap-x-4 gap-y-2 sm:grid-cols-6">
                <legend className="mb-2 text-[13px] font-extrabold text-ink">{t("address.title")}</legend>
                <Field label={t("address.street")} error={err("street")} className="sm:col-span-6">
                  <input autoComplete="shipping street-address" value={form.street} onChange={(e) => set("street", e.target.value)} aria-invalid={Boolean(err("street")) || undefined} className={inputCls(err("street"))} />
                </Field>
                <Field label={t("address.city")} error={err("city")} className="sm:col-span-3">
                  <input autoComplete="shipping address-level2" value={form.city} onChange={(e) => set("city", e.target.value)} aria-invalid={Boolean(err("city")) || undefined} className={inputCls(err("city"))} />
                </Field>
                <Field label={t("address.postal")} error={err("postal")} className="sm:col-span-2">
                  <input autoComplete="shipping postal-code" value={form.postal} onChange={(e) => set("postal", e.target.value)} aria-invalid={Boolean(err("postal")) || undefined} className={inputCls(err("postal"))} placeholder={market === "LV" ? "LV-" : ""} />
                </Field>
                <Field label={t("address.country")} className="sm:col-span-1">
                  <input value={market} readOnly aria-readonly className={cn(inputCls(), "bg-canvas text-center font-bold")} />
                </Field>
                {form.customerType === "business" && (
                  <label className="mt-1 flex items-center gap-2.5 text-[13.5px] font-semibold text-ink/80 sm:col-span-6">
                    <input type="checkbox" checked={form.billingSame} onChange={(e) => set("billingSame", e.target.checked)} className="size-4 accent-navy-700" />
                    {t("billingSame")}
                  </label>
                )}
              </motion.fieldset>
            )}
            {method === "pickup" && (
              <motion.p key="pickup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 flex items-start gap-3 rounded-2xl bg-canvas p-4 text-[13.5px] text-ink/80">
                <Store className="mt-0.5 size-5 shrink-0 text-navy-500" aria-hidden />
                <span>
                  <b className="block text-ink">{settings.company.warehouse}</b>
                  {t("methods.pickupText")}
                </span>
              </motion.p>
            )}
          </AnimatePresence>
        </Step>

        {/* 4. payment */}
        <Step n={4} title={t("steps.payment")} done={Boolean(method)}>
          <div role="radiogroup" aria-label={t("steps.payment")} className="grid gap-2.5 sm:grid-cols-2">
            {visiblePayments.map((p) => (
              <ChoiceCard
                key={p}
                name="payment"
                value={p}
                checked={payment === p}
                disabled={!payAvailable(p)}
                onChange={(v) => set("payment", v as PaymentId)}
                icon={PAY_ICON[p]}
                title={t(`payments.${p}`)}
                text={t(`payments.${p}Text`)}
                badge={
                  p === "card" && !CARD_ENABLED ? (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-brand-700">{t("payments.cardSoon")}</span>
                  ) : undefined
                }
              />
            ))}
          </div>
        </Step>

        {/* 5. confirm */}
        <Step n={5} title={t("steps.confirm")} done={false}>
          <Field label={t("notes")} optional={t("optional")}>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder={t("notesPlaceholder")}
              maxLength={2000}
              className={cn(inputCls(), "h-auto min-h-24 py-2.5")}
            />
          </Field>
          <label className={cn("mt-3 flex cursor-pointer items-start gap-3 rounded-xl p-3 text-[14px] text-ink/85 ring-1", err("terms") ? "bg-red-50 ring-red-200" : "bg-canvas ring-line")}>
            <input
              type="checkbox"
              checked={form.terms}
              onChange={(e) => set("terms", e.target.checked)}
              aria-invalid={Boolean(err("terms")) || undefined}
              className="mt-0.5 size-4 shrink-0 accent-navy-700"
            />
            <span>
              {t.rich("terms", {
                link: (c) => (
                  <Link href="/terms" target="_blank" className="font-bold text-navy-600 underline underline-offset-2">
                    {c}
                  </Link>
                ),
              })}
            </span>
          </label>

          {serverError && (
            <p role="alert" className="mt-4 flex gap-2 rounded-xl bg-red-50 p-3.5 text-[13.5px] font-semibold text-danger ring-1 ring-red-200">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {serverError}
            </p>
          )}

          <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "mt-5 w-full text-[16px]")}>
            {pending ? (
              <>
                <LoaderCircle className="size-5 animate-spin" aria-hidden />
                {t("placing")}
              </>
            ) : (
              <>
                <LockKeyhole className="size-5" aria-hidden />
                {t("placeWithTotal", { total: money(totals.total) })}
              </>
            )}
          </button>
          <p className="mt-3 text-center text-[12px] text-muted">{t("placeHint")}</p>
        </Step>

        <Link href="/cart" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-navy-600 hover:text-navy-800">
          <ArrowLeft className="size-4" aria-hidden />
          {t("backToCart")}
        </Link>
      </div>

      <aside className="hidden lg:sticky lg:top-24 lg:col-span-5 lg:block xl:col-span-4">
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-card">
          <OrderSummary lines={s.lines} totals={summaryTotals} />
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-muted">
          <LockKeyhole className="size-3.5" aria-hidden />
          {tc("secure")}
        </p>
        <p className="mt-1 text-center text-[12px] text-muted">
          {tm(market)} · {pricing.b2b ? tm("vatExcl") : tm("vatIncl")}
        </p>
      </aside>
    </form>
  );
}
