import { getTranslations } from "next-intl/server";
import { ArrowRight, Building2, Check, FileText, Percent, Receipt } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

export async function B2BBlock() {
  const t = await getTranslations("home");
  const points = [t("b2bPoint1"), t("b2bPoint2"), t("b2bPoint3"), t("b2bPoint4")];
  return (
    <section aria-labelledby="home-b2b" className="relative overflow-hidden bg-canvas py-20 sm:py-24">
      <div className="container-x relative grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <p className="eyebrow">{t("b2bEyebrow")}</p>
          <h2 id="home-b2b" className="h-display mt-3 text-3xl text-ink sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
            {t("b2bTitle")}
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">{t("b2bText")}</p>
          <ul className="mt-7 grid gap-3 sm:grid-cols-2">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3 rounded-2xl bg-white p-4 text-[14px] font-semibold text-ink shadow-card ring-1 ring-line">
                <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-brand-400 text-navy-900">
                  <Check className="size-4" strokeWidth={3} aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/business" className={buttonClass("dark", "lg")}>
              <Building2 className="size-5 text-brand-400" aria-hidden />
              {t("b2bCta")}
            </Link>
            <Link href="/business" className={buttonClass("outline", "lg")}>
              {t("b2bCtaSecondary")}
              <ArrowRight className="size-5" aria-hidden />
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="relative">
          <div aria-hidden className="relative mx-auto max-w-md">
            <div className="relative rounded-3xl bg-navy-700 p-6 text-white shadow-lift sm:p-8">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[13px] font-bold text-white/70">
                  <Building2 className="size-4 text-brand-400" />
                  {t("b2bCardTitle")}
                </span>
                <span className="rounded-md bg-brand-400 px-2 py-0.5 text-[11px] font-extrabold text-navy-900">B2B</span>
              </div>
              <div className="mt-8 grid gap-3">
                {[
                  { icon: Receipt, label: t("b2bCardPrice"), value: <Check className="size-5 text-emerald-400" strokeWidth={3} /> },
                  { icon: Percent, label: t("b2bCardDiscount"), value: <Check className="size-5 text-emerald-400" strokeWidth={3} /> },
                  { icon: FileText, label: t("b2bCardTerms"), value: t("b2bCardTermsValue") },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl bg-white/[0.07] px-4 py-3.5 ring-1 ring-white/10">
                    <Icon className="size-5 text-brand-400" />
                    <span className="flex-1 text-[14px] font-semibold text-white/80">{label}</span>
                    <span className="text-[14px] font-extrabold text-white">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-3/4 rounded-full bg-brand-400" />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
