import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getStoreSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHero } from "@/components/pages/PageHero";
import { pageBreadcrumbLd } from "@/components/pages/meta";
import { LegalDocument, type LegalSection } from "./LegalDocument";

/** Shared renderer for /terms and /privacy (sections come from `legal.<doc>.sections` messages). */
export async function LegalPage({ locale, doc }: { locale: Locale; doc: "terms" | "privacy" }) {
  const [t, tUi, settings] = await Promise.all([
    getTranslations({ locale, namespace: "legal" }),
    getTranslations({ locale, namespace: "pagesUi" }),
    getStoreSettings(),
  ]);
  const c = settings.company;
  const sections = t.raw(`${doc}.sections`) as LegalSection[];
  const title = t(`${doc}Title`);
  const route = doc === "terms" ? "/terms" : "/privacy";
  const updated = tUi("updated", { date: t("updatedDate") });

  const pageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    url: absoluteUrl(route, locale),
    inLanguage: locale,
    dateModified: "2026-09-25",
  };

  return (
    <>
      <JsonLd data={await pageBreadcrumbLd(locale, route, title)} />
      <JsonLd data={pageLd} />
      <PageHero eyebrow={t("eyebrow")} title={title} text={t(`${doc}Text`)} crumbs={[{ name: title }]} compact />
      <LegalDocument
        sections={sections}
        tocLabel={tUi("toc")}
        updated={updated}
        values={{
          companyName: c.name,
          regNo: c.reg_no,
          vatNo: c.vat_no,
          address: c.address,
          warehouse: c.warehouse,
          email: c.email,
          phone: c.phone,
        }}
        footer={t("questions", { email: c.email })}
      />
    </>
  );
}
