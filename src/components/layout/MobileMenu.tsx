"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown, LayoutDashboard, Mail, Phone, Search, UserRound, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useSettings } from "@/components/providers/SettingsProvider";
import { usePricing } from "@/components/providers/PriceProvider";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import { LocaleSwitcher, MarketSwitcher } from "./switchers";
import { NAV_LINKS, telHref, type HeaderCategory } from "./nav";

const list = { hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } } };
const item = {
  hidden: { opacity: 0, x: 24 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
};

export function MobileMenu({
  open,
  onClose,
  onSearch,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  onSearch: () => void;
  categories: HeaderCategory[];
}) {
  const t = useTranslations("nav");
  const th = useTranslations("header");
  const ta = useTranslations("a11y");
  const tm = useTranslations("market");
  const { company } = useSettings();
  const { profile } = usePricing();
  const [catsOpen, setCatsOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label={t("menu")}
          className="fixed inset-0 z-[75] flex flex-col overflow-hidden bg-navy-950 text-white lg:hidden"
          initial={{ clipPath: "circle(0% at 100% 0%)" }}
          animate={{ clipPath: "circle(150% at 100% 0%)" }}
          exit={{ clipPath: "circle(0% at 100% 0%)" }}
          transition={{ duration: 0.5, ease: [0.65, 0, 0.35, 1] }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 grid-bg opacity-50" />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 top-24 h-72 w-32 -skew-x-[20deg] bg-brand-400/15 blur-2xl"
          />
          <div className="relative flex h-16 items-center justify-between px-4">
            <Link href="/" onClick={onClose} aria-label={t("home")}>
              <Logo />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label={ta("closeMenu")}
              className="grid size-11 place-items-center rounded-xl bg-white/10 transition hover:bg-white/20"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <motion.nav
            aria-label={ta("mainNav")}
            className="relative flex-1 overflow-y-auto px-4 pb-8"
            variants={list}
            initial="hidden"
            animate="show"
          >
            <motion.button
              variants={item}
              type="button"
              onClick={onSearch}
              className="mb-5 flex h-12 w-full items-center gap-3 rounded-xl bg-white/10 px-4 text-left text-[15px] text-white/60 ring-1 ring-white/10"
            >
              <Search className="size-5" aria-hidden />
              {t("search")}…
            </motion.button>

            <motion.div variants={item} className="border-b border-white/10">
              <button
                type="button"
                onClick={() => setCatsOpen((o) => !o)}
                aria-expanded={catsOpen}
                className="flex w-full items-center justify-between py-4 text-2xl font-extrabold tracking-tight"
              >
                {t("catalog")}
                <ChevronDown className={cn("size-6 text-brand-400 transition-transform", catsOpen && "rotate-180")} aria-hidden />
              </button>
              <AnimatePresence initial={false}>
                {catsOpen && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <li>
                      <Link
                        href="/catalog"
                        onClick={onClose}
                        className="mb-1 flex items-center gap-3 rounded-lg px-2 py-2.5 text-[15px] font-bold text-brand-300"
                      >
                        {t("allProducts")}
                      </Link>
                    </li>
                    {categories.map((c) => (
                      <li key={c.slug}>
                        <Link
                          href={{ pathname: "/catalog/[category]", params: { category: c.slug } }}
                          onClick={onClose}
                          className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-[15px] font-semibold text-white/80 active:bg-white/10"
                        >
                          <CategoryIcon name={c.icon} className="size-5 text-brand-400" aria-hidden />
                          {c.name}
                        </Link>
                      </li>
                    ))}
                    <li className="h-3" />
                  </motion.ul>
                )}
              </AnimatePresence>
            </motion.div>

            {NAV_LINKS.map((l) => (
              <motion.div key={l.href} variants={item} className="border-b border-white/10">
                <Link href={l.href} onClick={onClose} className="block py-4 text-2xl font-extrabold tracking-tight">
                  {t(l.key)}
                </Link>
              </motion.div>
            ))}

            <motion.div variants={item} className="mt-6 grid grid-cols-2 gap-2">
              <Link
                href={profile ? "/account" : "/login"}
                onClick={onClose}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-400 font-bold text-navy-900"
              >
                <UserRound className="size-5" aria-hidden />
                {profile ? t("account") : t("login")}
              </Link>
              {profile?.role === "admin" ? (
                <NextLink
                  href="/admin"
                  className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white/10 font-bold ring-1 ring-white/15"
                >
                  <LayoutDashboard className="size-5" aria-hidden />
                  {t("admin")}
                </NextLink>
              ) : (
                <Link
                  href="/downloads"
                  onClick={onClose}
                  className="flex h-12 items-center justify-center rounded-xl bg-white/10 font-bold ring-1 ring-white/15"
                >
                  {t("downloads")}
                </Link>
              )}
            </motion.div>

            <motion.div variants={item} className="mt-8 grid gap-5">
              <div>
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/45">{tm("label")}</p>
                <MarketSwitcher variant="list" />
              </div>
              <div>
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/45">{th("language")}</p>
                <LocaleSwitcher variant="list" />
              </div>
              <div>
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/45">{th("needHelp")}</p>
                <div className="grid gap-2">
                  <a href={telHref(company.phone)} className="flex items-center gap-3 text-[15px] font-semibold text-white/85">
                    <Phone className="size-4 text-brand-400" aria-hidden />
                    {company.phone}
                  </a>
                  <a href={`mailto:${company.email}`} className="flex items-center gap-3 text-[15px] font-semibold text-white/85">
                    <Mail className="size-4 text-brand-400" aria-hidden />
                    {company.email}
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
