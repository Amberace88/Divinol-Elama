"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowRight, ArrowUpRight, Building2, Calculator, FileText, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import type { HeaderCategory } from "./nav";

export function MegaMenu({
  id,
  categories,
  counts,
  onNavigate,
}: {
  id: string;
  categories: HeaderCategory[];
  counts: Record<string, number> | null;
  onNavigate: () => void;
}) {
  const t = useTranslations("header");
  const nav = useTranslations("nav");
  const tools = [
    { href: "/calculators" as const, icon: Calculator, label: nav("calculators") },
    { href: "/downloads" as const, icon: FileText, label: nav("downloads") },
    { href: "/business" as const, icon: Building2, label: t("b2bCta") },
  ];
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-x-0 top-full border-t border-white/10 bg-white text-ink shadow-[0_30px_60px_-20px_rgb(10_17_34/0.45)]"
    >
      <div className="container-x grid gap-8 py-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="eyebrow">{t("categoriesTitle")}</p>
            <Link
              href="/catalog"
              onClick={onNavigate}
              className="group inline-flex items-center gap-1.5 text-[13px] font-bold text-navy-700 hover:text-navy-500"
            >
              {t("allCategoriesCta")}
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-1.5">
            {categories.map((c, i) => (
              <motion.li
                key={c.slug}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.02 * i, duration: 0.25 }}
              >
                <Link
                  href={{ pathname: "/catalog/[category]", params: { category: c.slug } }}
                  onClick={onNavigate}
                  className="group flex items-center gap-3.5 rounded-xl p-2.5 transition hover:bg-canvas"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy-600 transition group-hover:-rotate-3 group-hover:bg-brand-400 group-hover:text-navy-900">
                    <CategoryIcon name={c.icon} className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-ink group-hover:text-navy-700">{c.name}</span>
                    {counts && (
                      <span className="block text-[12px] text-muted">{t("categoryCount", { count: counts[c.slug] ?? 0 })}</span>
                    )}
                  </span>
                  <ArrowUpRight className="size-4 text-muted opacity-0 transition group-hover:opacity-100" aria-hidden />
                </Link>
              </motion.li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-4">
          <Link
            href="/oil-finder"
            onClick={onNavigate}
            className="group relative overflow-hidden rounded-2xl bg-navy-700 p-6 text-white shadow-lift"
          >
            <span aria-hidden className="absolute inset-0 grid-bg opacity-60" />
            <span
              aria-hidden
              className="absolute -right-10 -top-6 h-40 w-24 -skew-x-[20deg] bg-gradient-to-b from-brand-400 to-brand-500 opacity-90 transition-transform duration-500 group-hover:translate-x-3"
            />
            <span className="relative block">
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-300">
                <Sparkles className="size-3.5" aria-hidden /> {nav("oilFinder")}
              </span>
              <span className="block max-w-[15rem] text-xl font-extrabold leading-tight tracking-tight">{t("finderPromo")}</span>
              <span className="mt-2 block max-w-[17rem] text-[13px] leading-relaxed text-white/70">{t("finderPromoText")}</span>
              <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-400 px-4 py-2.5 text-[13px] font-extrabold text-navy-900 transition group-hover:bg-brand-300">
                {t("finderPromoCta")}
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </span>
          </Link>
          <div className="rounded-2xl border border-line p-2">
            <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">{t("toolsTitle")}</p>
            {tools.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className="group flex items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] font-semibold text-ink/85 transition hover:bg-canvas hover:text-navy-700"
              >
                <Icon className="size-4 text-navy-400 group-hover:text-navy-600" aria-hidden />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
