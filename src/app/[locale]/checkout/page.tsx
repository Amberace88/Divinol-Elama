import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LockKeyhole } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { isMontonioConfigured } from "@/lib/payments/montonio";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function CheckoutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("checkout");
  return (
    <div className="bg-canvas">
      <div className="container-x pb-20 pt-8 sm:pt-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <h1 className="h-display text-3xl text-ink sm:text-4xl">{t("title")}</h1>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[12.5px] font-bold text-emerald-700 ring-1 ring-emerald-200">
            <LockKeyhole className="size-3.5" aria-hidden />
            {t("secure")}
          </p>
        </div>
        <CheckoutForm onlinePayments={isMontonioConfigured()} />
      </div>
    </div>
  );
}
