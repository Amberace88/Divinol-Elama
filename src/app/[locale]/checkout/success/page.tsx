import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Landmark } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/commerce";
import { getStoreSettings } from "@/lib/settings";
import { CopyValue, SuccessActions, SuccessBadge } from "@/components/checkout/SuccessExtras";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout.success" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.slice(0, 40);
const PAYMENTS = ["bank_transfer", "invoice", "cash_on_pickup", "card"] as const;
type Payment = (typeof PAYMENTS)[number];

export default async function CheckoutSuccessPage({ params, searchParams }: Props) {
  const { locale: l } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const sp = await searchParams;
  const [t, tp, settings] = await Promise.all([
    getTranslations("checkout.success"),
    getTranslations("checkout.payments"),
    getStoreSettings(),
  ]);
  const c = settings.company;
  const number = one(sp.n)?.replace(/[^\w-]/g, "") || null;
  const totalRaw = Number(one(sp.t));
  const total = Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : null;
  const pRaw = one(sp.p);
  const payment: Payment | null = PAYMENTS.includes(pRaw as Payment) ? (pRaw as Payment) : null;
  const invoice = one(sp.inv)?.replace(/[^\w-]/g, "") || null;
  const vars = { number: number ?? "—", invoice: invoice ?? "", warehouse: c.warehouse };
  const steps = payment ? ([1, 2, 3] as const).map((i) => t(`${payment}${i}`, vars)) : [];
  const showBank = payment === "bank_transfer" && Boolean(c.iban);

  return (
    <div className="relative overflow-hidden bg-canvas">
      <div aria-hidden className="absolute inset-x-0 top-0 h-72 bg-navy-700">
        <div className="absolute inset-0 grid-bg" />
      </div>
      <div className="container-x relative pb-20 pt-12 sm:pt-16">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-line bg-surface p-6 text-center shadow-lift sm:p-10">
          <SuccessBadge />
          <h1 className="h-display mt-6 text-3xl text-ink sm:text-4xl">{t("title")}</h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">{t("text")}</p>

          <dl className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-line text-left ring-1 ring-line sm:grid-cols-3">
            <div className="bg-surface p-4">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">{t("orderNumber")}</dt>
              <dd className="mt-1 flex items-center justify-between gap-2 font-mono text-[15px] font-bold text-ink">
                {number ?? "—"}
                {number && <CopyValue value={number} />}
              </dd>
            </div>
            <div className="bg-surface p-4">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">{t("total")}</dt>
              <dd className="mt-1 text-[17px] font-extrabold tabular-nums text-navy-700">{total != null ? formatMoney(total, locale) : "—"}</dd>
            </div>
            <div className="bg-surface p-4">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">{t("payment")}</dt>
              <dd className="mt-1 text-[14px] font-bold text-ink">{payment ? tp(payment) : "—"}</dd>
            </div>
            {invoice && (
              <div className="bg-surface p-4 sm:col-span-3">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">{t("invoice")}</dt>
                <dd className="mt-1 font-mono text-[14px] font-bold text-ink">{invoice}</dd>
              </div>
            )}
          </dl>

          {steps.length > 0 && (
            <div className="mt-8 text-left">
              <h2 className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-muted">{t("nextSteps")}</h2>
              <ol className="mt-4 grid gap-3">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy-700 text-[13px] font-extrabold text-brand-400">{i + 1}</span>
                    <p className="pt-0.5 text-[14.5px] leading-relaxed text-ink/85">{s}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {showBank && (
            <div className="mt-8 rounded-2xl bg-canvas p-5 text-left ring-1 ring-line">
              <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-ink">
                <Landmark className="size-5 text-navy-500" aria-hidden />
                {t("bankDetails")}
              </h2>
              <dl className="mt-4 grid gap-2.5 text-[14px]">
                {[
                  { k: t("recipient"), v: c.name.replace(/"/g, "") },
                  { k: t("regNo"), v: c.reg_no },
                  ...(c.bank_name ? [{ k: t("bank"), v: c.bank_name }] : []),
                  { k: t("iban"), v: c.iban as string, copy: true },
                  ...(c.swift ? [{ k: t("swift"), v: c.swift }] : []),
                  ...(number ? [{ k: t("reference"), v: number, copy: true }] : []),
                  ...(total != null ? [{ k: t("amount"), v: formatMoney(total, locale) }] : []),
                ].map((row) => (
                  <div key={row.k} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5 last:border-0 last:pb-0">
                    <dt className="text-muted">{row.k}</dt>
                    <dd className="flex items-center gap-2 font-mono font-bold text-ink">
                      {row.v}
                      {"copy" in row && row.copy && <CopyValue value={row.v} />}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <p className="mt-8 text-[13px] text-muted">{t("questions", { email: c.email, phone: c.phone })}</p>
          <div className="mt-6">
            <SuccessActions />
          </div>
        </div>
      </div>
    </div>
  );
}
