import { getTranslations } from "next-intl/server";
import { ArrowRight, BadgeCheck, Car, Fuel, CalendarDays, MessageCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

export async function FinderTeaser() {
  const t = await getTranslations("home");
  const steps = [
    { icon: Car, label: t("finderStep1"), value: t("finderDemoMake") },
    { icon: Fuel, label: t("finderStep2"), value: t("finderDemoFuel") },
    { icon: CalendarDays, label: t("finderStep3"), value: t("finderDemoYear") },
  ];
  return (
    <section aria-labelledby="home-finder" className="container-x py-20 sm:py-24">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-navy-700 px-6 py-12 text-white shadow-lift sm:px-10 lg:px-14 lg:py-16">
          <div aria-hidden className="absolute inset-0 -z-10 grid-bg" />
          <div aria-hidden className="absolute -bottom-32 -left-24 -z-10 size-96 rounded-full bg-navy-400/40 blur-3xl" />
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="eyebrow text-brand-300!">{t("finderEyebrow")}</p>
              <h2 id="home-finder" className="h-display mt-3 text-3xl sm:text-4xl lg:text-5xl">
                {t("finderTitle")}
              </h2>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/70 sm:text-base">{t("finderText")}</p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/oil-finder" className={buttonClass("primary", "lg")}>
                  {t("finderCta")}
                  <ArrowRight className="size-5 transition group-hover/btn:translate-x-0.5" aria-hidden />
                </Link>
                <Link href="/oil-finder" className="inline-flex items-center gap-2 text-[14px] font-semibold text-white/75 hover:text-white">
                  <MessageCircle className="size-4 text-brand-400" aria-hidden />
                  {t("finderPlate")}
                </Link>
              </div>
            </div>
            <div aria-hidden className="relative mx-auto w-full max-w-md">
              <div className="rounded-2xl bg-surface p-5 text-ink shadow-lift sm:p-6">
                <div className="flex gap-1.5">
                  {steps.map((s) => (
                    <span key={s.label} className="h-1.5 flex-1 rounded-full bg-brand-400" />
                  ))}
                </div>
                <ul className="mt-5 grid gap-2.5">
                  {steps.map(({ icon: Icon, label, value }) => (
                    <li
                      key={label}
                      className="flex items-center gap-3 rounded-2xl border border-line bg-canvas px-4 py-3"
                    >
                      <span className="grid size-9 place-items-center rounded-xl bg-navy-700 text-brand-400">
                        <Icon className="size-4" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">{label}</span>
                        <span className="block text-[15px] font-extrabold">{value}</span>
                      </span>
                      <BadgeCheck className="size-5 text-emerald-500" />
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-navy-700 px-4 py-3.5 text-white">
                  <span className="rounded-md bg-brand-400 px-2 py-1 text-[12px] font-extrabold text-navy-900">5W-30</span>
                  <span className="text-[13px] font-bold">{t("finderDemoResult")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
