import { getTranslations } from "next-intl/server";
import { BadgePercent, FileDown, History, RotateCcw, ShieldCheck } from "lucide-react";

const BENEFITS = [
  { key: "b2b", Icon: BadgePercent },
  { key: "history", Icon: History },
  { key: "invoices", Icon: FileDown },
  { key: "reorder", Icon: RotateCcw },
] as const;

export async function AuthBrandPanel({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "auth.panel" });
  return (
    <aside className="relative isolate overflow-hidden rounded-3xl bg-navy-800 p-7 text-white shadow-lift sm:p-10 lg:p-12">
      <div className="grid-bg absolute inset-0 -z-10 opacity-70" aria-hidden />
      <div
        className="absolute -top-24 -right-24 -z-10 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl"
        aria-hidden
      />
      <div className="absolute -bottom-32 -left-16 -z-10 h-80 w-80 rounded-full bg-navy-400/30 blur-3xl" aria-hidden />
      <span className="absolute top-10 right-0 -z-10 h-24 w-40 -skew-x-12 bg-brand-400/90 max-sm:hidden" aria-hidden />
      <span className="absolute top-40 right-10 -z-10 h-6 w-24 -skew-x-12 bg-white/10 max-sm:hidden" aria-hidden />

      <span className="inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[0.18em] text-brand-300 uppercase">
        <span className="inline-block h-[3px] w-5 -skew-x-[20deg] rounded-sm bg-brand-400" />
        {t("eyebrow")}
      </span>
      <h2 className="h-display mt-4 max-w-md text-3xl leading-tight sm:text-4xl">{t("title")}</h2>
      <p className="mt-4 max-w-md text-[15px] leading-7 text-white/70">{t("text")}</p>

      <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {BENEFITS.map(({ key, Icon }) => (
          <li key={key} className="group rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.09]">
            <span className="grid h-10 w-10 -skew-x-6 place-items-center rounded-xl bg-brand-400 text-navy-900 transition-transform group-hover:-translate-y-0.5">
              <Icon className="h-5 w-5 skew-x-6" />
            </span>
            <p className="mt-3 font-bold">{t(`benefits.${key}.title`)}</p>
            <p className="mt-1 text-[13px] leading-6 text-white/65">{t(`benefits.${key}.text`)}</p>
          </li>
        ))}
      </ul>

      <p className="mt-8 flex items-start gap-2.5 border-t border-white/10 pt-6 text-[13px] leading-6 text-white/60">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
        {t("note")}
      </p>
    </aside>
  );
}
