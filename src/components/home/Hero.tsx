import { getTranslations } from "next-intl/server";
import { ArrowRight, BadgeCheck, Building2, Sparkles, Truck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";
import { AnimatedNumber } from "./AnimatedNumber";
import { HeroBottles, type HeroBottle } from "./HeroBottles";
import { HeroIntro, HeroItem } from "./HeroIntro";

export async function Hero({ bottles, productCount, packCount }: { bottles: HeroBottle[]; productCount: number; packCount: number }) {
  const t = await getTranslations("home");
  const stats = [
    { value: 150, suffix: "+", label: t("statsYears") },
    { value: productCount, suffix: "", label: t("statsProducts") },
    { value: 80, suffix: "+", label: t("statsCountries") },
    { value: packCount, suffix: "", label: t("statsPacks") },
  ];
  const badges = [
    { icon: BadgeCheck, label: t("heroBadge1") },
    { icon: Truck, label: t("heroBadge2") },
    { icon: Building2, label: t("heroBadge3") },
  ];

  return (
    <section className="relative isolate overflow-hidden bg-navy-700 text-white">
      {/* background: grid + slow oil-flow gradient + skewed brand beams */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(90%_70%_at_60%_40%,black,transparent)]" />
        <div className="absolute inset-0 animate-flow bg-[linear-gradient(115deg,transparent_20%,rgb(255_193_14/0.10)_35%,transparent_50%,rgb(82_104_159/0.35)_65%,transparent_80%)] bg-[length:200%_100%]" />
        <div className="absolute -left-40 top-1/3 size-[520px] rounded-full bg-navy-400/30 blur-[120px]" />
        <div className="absolute -right-20 -top-40 size-[560px] rounded-full bg-brand-400/15 blur-[130px]" />
        <div className="absolute right-[38%] top-0 hidden h-full w-16 -skew-x-[20deg] bg-gradient-to-b from-brand-400/0 via-brand-400/15 to-brand-400/0 lg:block" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-navy-900/60 to-transparent" />
      </div>

      <div className="container-x grid items-center gap-10 pb-14 pt-12 sm:pt-16 lg:grid-cols-12 lg:gap-6 lg:pb-20 lg:pt-20">
        <HeroIntro className="lg:col-span-7">
          <HeroItem>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] py-1.5 pl-1.5 pr-3.5 text-[12px] font-bold text-white/85 ring-1 ring-white/15 backdrop-blur">
              <span className="inline-flex -skew-x-12 items-center rounded-full bg-brand-400 px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-navy-900">
                <span className="skew-x-12">{t("heroSince")}</span>
              </span>
              {t("heroEyebrow")}
            </span>
          </HeroItem>
          <HeroItem as="h1" className="h-display mt-6 text-[2.6rem] leading-[1.02] sm:text-6xl xl:text-[4.6rem]">
            <span className="block">{t("heroTitle1")}</span>
            <span className="relative mt-1 inline-block text-brand-400">
              {t("heroTitle2")}
              <span aria-hidden className="absolute -bottom-2 left-1 h-2 w-[92%] -skew-x-[20deg] rounded-sm bg-brand-400/25" />
            </span>
          </HeroItem>
          <HeroItem as="p" className="mt-7 max-w-xl text-[16px] leading-relaxed text-white/70 sm:text-lg">
            {t("heroText")}
          </HeroItem>
          <HeroItem className="mt-8 flex flex-wrap gap-3">
            <Link href="/catalog" className={buttonClass("primary", "lg")}>
              {t("heroCtaShop")}
              <ArrowRight className="size-5 transition group-hover/btn:translate-x-0.5" aria-hidden />
            </Link>
            <Link href="/oil-finder" className={buttonClass("light", "lg")}>
              <Sparkles className="size-5 text-brand-300" aria-hidden />
              {t("heroCtaFinder")}
            </Link>
          </HeroItem>
          <HeroItem>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2.5">
              {badges.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-[13px] font-semibold text-white/75">
                  <Icon className="size-4 text-brand-400" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </HeroItem>
        </HeroIntro>

        <div className="relative lg:col-span-5">
          <div aria-hidden className="absolute inset-[8%] rounded-full bg-brand-400/20 blur-3xl" />
          <HeroBottles bottles={bottles} className="mx-auto aspect-[1/1] w-full max-w-[520px]" />
          <span className="absolute bottom-[6%] left-[36%] z-40 hidden -skew-x-12 items-center gap-2 rounded-lg bg-brand-400 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-navy-900 shadow-glow sm:inline-flex">
            <span className="skew-x-12">{t("heroMadeIn")} · DE</span>
          </span>
        </div>
      </div>

      <div className="container-x relative pb-10 lg:pb-14">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="relative flex flex-col bg-navy-700/95 p-5 sm:p-6">
              <dt className="order-2 mt-1 text-[12.5px] font-semibold leading-snug text-white/60">{s.label}</dt>
              <dd className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                <AnimatedNumber value={s.value} suffix={s.suffix} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
