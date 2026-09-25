"use client";

import { AnimatePresence, motion } from "motion/react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { LayoutDashboard, ShoppingBag, UserRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/components/providers/CartProvider";
import { usePricing } from "@/components/providers/PriceProvider";
import { cn } from "@/lib/utils";

const iconBtn =
  "relative grid size-11 place-items-center rounded-xl text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

export function AccountButton() {
  const t = useTranslations("nav");
  const { profile } = usePricing();
  return (
    <>
      {profile?.role === "admin" && (
        <NextLink href="/admin" className={cn(iconBtn, "hidden sm:grid")} title={t("admin")} aria-label={t("admin")}>
          <LayoutDashboard className="size-[21px]" aria-hidden />
        </NextLink>
      )}
      <Link
        href={profile ? "/account" : "/login"}
        className={cn(iconBtn, "hidden sm:grid")}
        title={profile ? t("account") : t("login")}
        aria-label={profile ? t("account") : t("login")}
      >
        <UserRound className="size-[21px]" aria-hidden />
        {profile && (
          <span aria-hidden className="absolute right-2 top-2 size-2 rounded-full bg-emerald-400 ring-2 ring-navy-700" />
        )}
      </Link>
    </>
  );
}

export function CartButton() {
  const t = useTranslations("a11y");
  const { count, setOpen } = useCart();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={t("openCart", { count })}
      className={cn(iconBtn, "sm:w-auto sm:gap-2 sm:bg-brand-400 sm:px-3.5 sm:text-navy-900 sm:hover:bg-brand-300 sm:hover:text-navy-900")}
    >
      <ShoppingBag className="size-[21px]" aria-hidden />
      <AnimatePresence mode="popLayout" initial={false}>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0.4, y: -6, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.4, y: 6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 22 }}
            aria-hidden
            className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-400 px-1 text-[11px] font-extrabold tabular-nums text-navy-900 ring-2 ring-navy-700 sm:static sm:h-auto sm:min-w-0 sm:bg-transparent sm:px-0 sm:text-[14px] sm:ring-0"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
