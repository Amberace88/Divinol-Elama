import { getTranslations } from "next-intl/server";
import { ArrowRight, Download, FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/ui/Reveal";

export async function CatalogsTeaser() {
  const t = await getTranslations("home");
  return (
    <section aria-labelledby="home-catalogs" className="container-x pb-20 sm:pb-24">
      <Reveal>
        <Link
          href="/downloads"
          className="group relative flex flex-col gap-6 overflow-hidden rounded-[2rem] border border-line bg-gradient-to-br from-surface to-canvas p-6 shadow-card transition hover:shadow-lift sm:flex-row sm:items-center sm:p-10"
        >
          <div aria-hidden className="relative h-28 w-24 shrink-0">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="absolute inset-0 rounded-xl border border-line bg-surface shadow-card "
                style={{ transform: `translate(${(i - 1) * 6}px, ${(i - 1) * 6}px)` }}
              >
                <span className="absolute inset-x-2 top-2 h-8 rounded-md bg-navy-700" />
                <span className="absolute left-2 top-12 h-1.5 w-12 rounded bg-brand-400" />
                <span className="absolute left-2 top-16 h-1 w-14 rounded bg-line" />
                <span className="absolute left-2 top-[4.5rem] h-1 w-10 rounded bg-line" />
              </span>
            ))}
            <span className="absolute -bottom-2 -right-3 grid size-9 place-items-center rounded-full bg-brand-400 text-navy-900 shadow-card">
              <Download className="size-4" />
            </span>
          </div>
          <div className="flex-1">
            <p className="eyebrow">{t("catalogsEyebrow")}</p>
            <h2 id="home-catalogs" className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {t("catalogsTitle")}
            </h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{t("catalogsText")}</p>
          </div>
          <span className="inline-flex h-12 shrink-0 items-center gap-2 self-start rounded-xl bg-navy-700 px-5 text-[14px] font-bold text-white transition group-hover:bg-navy-600 sm:self-center">
            <FileText className="size-4 text-brand-400" aria-hidden />
            {t("catalogsCta")}
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>
      </Reveal>
    </section>
  );
}
