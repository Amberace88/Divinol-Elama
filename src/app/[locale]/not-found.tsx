import { getTranslations } from "next-intl/server";
import { ArrowRight, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <section className="relative isolate overflow-hidden bg-navy-700 text-white">
      <div aria-hidden className="absolute inset-0 -z-10 grid-bg" />
      <div aria-hidden className="absolute -right-10 top-0 -z-10 h-full w-40 -skew-x-[20deg] bg-brand-400/20" />
      <div className="container-x flex min-h-[62vh] flex-col items-center justify-center py-20 text-center">
        <p className="text-[8rem] font-extrabold leading-none tracking-[-0.06em] text-transparent [-webkit-text-stroke:2px_#ffc10e] sm:text-[11rem]">
          404
        </p>
        <h1 className="h-display mt-2 text-3xl sm:text-4xl">{t("notFoundTitle")}</h1>
        <p className="mt-3 max-w-md text-[15px] text-white/70">{t("notFoundText")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonClass("primary", "lg")}>
            {t("backHome")}
            <ArrowRight className="size-5" aria-hidden />
          </Link>
          <Link href="/catalog" className={buttonClass("light", "lg")}>
            <Search className="size-5" aria-hidden />
            {t("notFoundCatalog")}
          </Link>
        </div>
      </div>
    </section>
  );
}
