import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Container, CreditCard, Gift, Landmark, PackageCheck, Receipt, Truck, Undo2, Warehouse, type LucideIcon } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { formatMoney, gross, MARKETS } from "@/lib/commerce";
import { getStoreSettings } from "@/lib/settings";
import type { Market } from "@/lib/types";
import { JsonLd } from "@/components/ui/JsonLd";
import { Reveal } from "@/components/ui/Reveal";
import { PageHero, SectionHeading } from "@/components/pages/PageHero";
import { Faq } from "@/components/pages/Faq";
import { faqJsonLd, pageBreadcrumbLd, pageMetadata } from "@/components/pages/meta";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/delivery">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale as Locale, "/delivery", { title: "delivery.metaTitle", description: "delivery.metaDescription" });
}

const METHOD_ICON: Record<string, LucideIcon> = { pickup: Warehouse, parcel_locker: PackageCheck, courier: Truck, freight: Container };
const METHOD_ORDER = ["pickup", "parcel_locker", "courier", "freight"];

export default async function DeliveryPage({ params }: PageProps<"/[locale]/delivery">) {
  const { locale: l } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const [t, tNav, tMarket, tUi, settings] = await Promise.all([
    getTranslations({ locale, namespace: "delivery" }),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "market" }),
    getTranslations({ locale, namespace: "pagesUi" }),
    getStoreSettings(),
  ]);
  const { shipping, vat } = settings;
  const money = (n: number) => formatMoney(n, locale);
  const faq = t.raw("faq") as { q: string; a: string }[];

  const methods = Object.entries(shipping.methods)
    .filter(([, m]) => m.enabled !== false)
    .sort(([a], [b]) => (METHOD_ORDER.indexOf(a) + 1 || 99) - (METHOD_ORDER.indexOf(b) + 1 || 99))
    .map(([id, m]) => ({
      id,
      maxItem: m.max_item,
      rows: MARKETS.map((mk: Market) => {
        if (!m.markets.includes(mk)) return { market: mk, label: t("notAvailable"), muted: true, free: null as string | null };
        if (m.price_net == null) return { market: mk, label: t("onRequest"), muted: false, free: null };
        const net = m.price_net + (m.surcharge?.[mk] ?? 0);
        if (net === 0) return { market: mk, label: t("freeShort"), muted: false, free: null };
        const threshold = shipping.free_threshold?.[mk];
        return {
          market: mk,
          label: money(gross(net, vat[mk])),
          muted: false,
          free: m.free_over && threshold ? t("free", { amount: money(threshold) }) : null,
        };
      }),
    }))
    .filter((m) => t.has(m.id));

  const payments: { key: string; icon: LucideIcon }[] = [
    { key: "card", icon: CreditCard },
    { key: "transfer", icon: Landmark },
    { key: "invoice", icon: Receipt },
  ];
  const rates = MARKETS.map((m) => `${m} ${vat[m]}%`).join(", ");

  return (
    <>
      <JsonLd data={await pageBreadcrumbLd(locale, "/delivery", tNav("delivery"))} />
      <JsonLd data={faqJsonLd(faq)} />
      <PageHero eyebrow={t("eyebrow")} title={t("title")} text={t("text")} crumbs={[{ name: tNav("delivery") }]}>
        {shipping.free_threshold?.LV ? (
          <p className="inline-flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15">
            <Gift className="size-5 text-brand-400" aria-hidden />
            {t("freeBanner", { amount: money(shipping.free_threshold.LV) })}
          </p>
        ) : null}
      </PageHero>

      {/* methods */}
      <section aria-labelledby="methods" className="bg-canvas py-16 sm:py-20">
        <div className="container-x">
          <SectionHeading id="methods" eyebrow={t("methodsEyebrow")} title={t("methods")} />
          <ul className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {methods.map((m, i) => {
              const Icon = METHOD_ICON[m.id] ?? Truck;
              return (
                <Reveal as="li" key={m.id} delay={i * 0.06}>
                  <article className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-card transition duration-300 hover:shadow-lift">
                    <span className="grid size-12 place-items-center rounded-xl bg-navy-700 text-brand-400 transition-transform duration-300">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <h3 className="mt-5 text-lg font-extrabold text-navy-700">{t(m.id)}</h3>
                    <p className="mt-2 text-[14px] leading-6 text-muted">{t(`${m.id}Text`)}</p>
                    {m.maxItem ? <p className="mt-2 text-[12.5px] font-semibold text-navy-500">{t("maxItem", { size: m.maxItem })}</p> : null}
                    <table className="mt-auto w-full border-separate border-spacing-0 pt-5 text-[13.5px]">
                      <caption className="sr-only">
                        {t(m.id)} — {t("price")}
                      </caption>
                      <thead className="sr-only">
                        <tr>
                          <th scope="col">{t("market")}</th>
                          <th scope="col">{t("price")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.rows.map((r) => (
                          <tr key={r.market}>
                            <th scope="row" className="border-t border-line py-2 pr-2 text-left font-semibold text-ink/70">
                              <span className="mr-1.5 inline-block rounded bg-navy-50 px-1.5 py-0.5 text-[11px] font-extrabold text-navy-600">{r.market}</span>
                              <span className="hidden sm:inline">{tMarket(r.market)}</span>
                            </th>
                            <td className={cn("border-t border-line py-2 text-right font-extrabold", r.muted ? "text-muted/60" : "text-navy-700")}>
                              {r.label}
                              {r.free && <span className="block text-[11.5px] font-semibold text-success">{r.free}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </article>
                </Reveal>
              );
            })}
          </ul>
          <p className="mt-6 text-[13px] text-muted">{t("pricesNote", { rates })}</p>
        </div>
      </section>

      {/* payments + returns */}
      <section aria-labelledby="payments" className="py-16 sm:py-20">
        <div className="container-x grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-16">
          <div>
            <SectionHeading id="payments" eyebrow={t("paymentsEyebrow")} title={t("payments")} />
            <ul className="mt-8 grid gap-4 sm:grid-cols-3">
              {payments.map(({ key, icon: Icon }, i) => (
                <Reveal as="li" key={key} delay={i * 0.06}>
                  <div className="h-full rounded-2xl border border-line bg-surface p-5 shadow-card">
                    <Icon className="size-7 text-navy-600" aria-hidden />
                    <h3 className="mt-4 font-extrabold text-navy-700">{t(key)}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-6 text-muted">{t(`${key}Text`)}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
          <Reveal>
            <div className="relative isolate h-full overflow-hidden rounded-3xl bg-navy-800 p-7 text-white shadow-lift sm:p-8">
              <div aria-hidden className="grid-bg absolute inset-0 -z-10 opacity-60" />
              <span className="grid size-12 place-items-center rounded-xl bg-brand-400 text-navy-900">
                <Undo2 className="size-6" aria-hidden />
              </span>
              <p className="eyebrow mt-5 text-brand-300">{t("returnsEyebrow")}</p>
              <h2 className="h-display mt-1 text-2xl">{t("returns")}</h2>
              <p className="mt-3 text-[15px] leading-7 text-white/75">{t("returnsText")}</p>
              <Link href="/terms" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-300 hover:text-brand-200">
                {t("returnsLink")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="delivery-faq" className="bg-canvas py-16 sm:py-24">
        <div className="container-x grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <SectionHeading id="delivery-faq" eyebrow={tUi("faqEyebrow")} title={tUi("faqTitle")} className="lg:sticky lg:top-28 lg:self-start" />
          <Faq items={faq} />
        </div>
      </section>
    </>
  );
}
