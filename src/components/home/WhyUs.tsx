import { getTranslations } from "next-intl/server";
import { Headset, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "./SectionHeading";

export async function WhyUs() {
  const t = await getTranslations("home");
  const items = [
    { icon: ShieldCheck, title: t("why1Title"), text: t("why1Text") },
    { icon: Truck, title: t("why2Title"), text: t("why2Text") },
    { icon: Headset, title: t("why3Title"), text: t("why3Text") },
    { icon: PackageCheck, title: t("why4Title"), text: t("why4Text") },
  ];
  return (
    <section aria-labelledby="home-why" className="container-x py-20 sm:py-24">
      <SectionHeading id="home-why" eyebrow={t("whyEyebrow")} title={t("whyTitle")} align="center" />
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text }, i) => (
          <Reveal as="li" key={title} delay={i * 0.07} y={18} className="group relative rounded-2xl p-6 text-center transition hover:bg-canvas">
            <span className="relative mx-auto grid size-16 place-items-center">
              <span aria-hidden className="absolute inset-0 -skew-x-12 rounded-2xl bg-brand-400 transition duration-300 group-hover:rotate-6" />
              <Icon className="relative size-7 text-navy-900" aria-hidden />
            </span>
            <h3 className="mt-5 text-[17px] font-extrabold tracking-tight text-ink">{title}</h3>
            <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-muted">{text}</p>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
