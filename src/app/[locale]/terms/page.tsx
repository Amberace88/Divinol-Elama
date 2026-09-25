import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/components/pages/meta";
import { LegalPage } from "@/components/pages/legal/LegalPage";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale as Locale, "/terms", { title: "legal.termsMetaTitle", description: "legal.termsMetaDescription" });
}

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <LegalPage locale={locale as Locale} doc="terms" />;
}
