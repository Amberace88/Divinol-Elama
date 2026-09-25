import { getTranslations } from "next-intl/server";
import { ArrowRight, Droplets, Fuel, Snowflake, Truck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "./SectionHeading";

export async function ToolsTeaser() {
  const t = await getTranslations("home");
  const tools = [
    { icon: Droplets, title: t("tool1Title"), text: t("tool1Text") },
    { icon: Truck, title: t("tool2Title"), text: t("tool2Text") },
    { icon: Fuel, title: t("tool3Title"), text: t("tool3Text") },
    { icon: Snowflake, title: t("tool4Title"), text: t("tool4Text") },
  ];
  return (
    <section aria-labelledby="home-tools" className="container-x pb-20 sm:pb-24">
      <SectionHeading
        id="home-tools"
        eyebrow={t("toolsEyebrow")}
        title={t("toolsTitle")}
        text={t("toolsText")}
        action={
          <Link href="/calculators" className="group inline-flex items-center gap-1.5 text-[14px] font-bold text-navy-600 hover:text-navy-800">
            {t("toolsCta")}
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
          </Link>
        }
      />
      <ul className="mt-10 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {tools.map(({ icon: Icon, title, text }, i) => (
          <Reveal as="li" key={title} delay={i * 0.06} y={18}>
            <Link
              href="/calculators"
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-card transition duration-200 hover:border-navy-200 hover:shadow-lift"
            >
              <span className="absolute right-4 top-4 text-[40px] font-extrabold leading-none tracking-tighter text-navy-50 transition group-hover:text-brand-100">
                0{i + 1}
              </span>
              <span className="relative grid size-12 place-items-center rounded-2xl bg-navy-700 text-brand-400 transition-colors duration-200 group-hover:bg-brand-400 group-hover:text-navy-900">
                <Icon className="size-6" aria-hidden />
              </span>
              <h3 className="relative mt-5 text-[17px] font-extrabold tracking-tight text-ink">{title}</h3>
              <p className="relative mt-1.5 text-[13.5px] leading-relaxed text-muted">{text}</p>
              <ArrowRight className="relative mt-5 size-5 text-navy-400 transition group-hover:translate-x-1 group-hover:text-navy-700" aria-hidden />
            </Link>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
