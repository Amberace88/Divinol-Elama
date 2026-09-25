import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/components/pages/meta";
import { LegalPage } from "@/components/pages/legal/LegalPage";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale as Locale, "/privacy", { title: "legal.privacyMetaTitle", description: "legal.privacyMetaDescription" });
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <LegalPage locale={locale as Locale} doc="privacy" />;
}
