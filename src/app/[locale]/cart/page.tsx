import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { alternates } from "@/lib/seo";
import { CartView } from "@/components/cart/CartView";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cart" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: true },
    alternates: { canonical: alternates("/cart", locale as Locale).canonical },
  };
}

export default async function CartPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const [t, tc, a11y] = await Promise.all([getTranslations("cart"), getTranslations("catalog"), getTranslations("a11y")]);
  return (
    <div className="bg-gradient-to-b from-canvas to-page">
      <div className="container-x pb-20 pt-6 sm:pt-8">
        <Breadcrumbs label={a11y("breadcrumbs")} items={[{ name: tc("breadcrumbHome"), href: "/" }, { name: t("title") }]} />
        <h1 className="h-display mb-8 mt-4 text-3xl text-ink sm:text-4xl">{t("title")}</h1>
        <CartView />
      </div>
    </div>
  );
}
