import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope/wght.css";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "sonner";
import { routing, type Locale } from "@/i18n/routing";
import { PriceProvider } from "@/components/providers/PriceProvider";
import { CartProvider } from "@/components/providers/CartProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { getCategories } from "@/lib/catalog";
import { getStoreSettings } from "@/lib/settings";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import { siteUrl, organizationJsonLd } from "@/lib/seo";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#1e2d51",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(siteUrl(locale as Locale)),
    title: { default: t("defaultTitle"), template: `%s | ${t("siteName")}` },
    description: t("defaultDescription"),
    applicationName: t("siteName"),
    openGraph: { type: "website", siteName: t("siteName"), locale },
    twitter: { card: "summary_large_image" },
    icons: { icon: "/icon.png", apple: "/apple-icon.png" },
    formatDetection: { telephone: true },
    ...(process.env.NEXT_PUBLIC_NOINDEX === "true" ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [messages, categories, settings] = await Promise.all([getMessages(), getCategories(), getStoreSettings()]);
  const cats = categories.map((c) => ({ slug: c.slug, icon: c.icon, name: c.i18n[locale]?.name ?? c.i18n.lv?.name ?? c.slug }));

  return (
    <html lang={locale} className="h-full">
      <body className="flex min-h-full flex-col antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(locale, settings.company)) }}
        />
        <NextIntlClientProvider messages={messages} locale={locale}>
          <SettingsProvider settings={settings}>
            <PriceProvider>
              <CartProvider>
                <Header categories={cats} />
                <main id="main" className="flex-1">
                  {children}
                </main>
                <Footer categories={cats} />
                <CartDrawer />
                <CookieBanner />
                <Toaster position="top-center" richColors closeButton />
              </CartProvider>
            </PriceProvider>
          </SettingsProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
