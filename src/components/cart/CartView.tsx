"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowRight, Info, LockKeyhole, ShoppingBag, Sparkles, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";
import { MarketSwitcherInline } from "./MarketSwitcherInline";
import { CartLine } from "./CartLine";
import { CartTotals } from "./CartTotals";
import { FreeShippingBar } from "./FreeShippingBar";
import { useCartSummary } from "./useCartSummary";

export function CartView() {
  const s = useCartSummary();
  const t = useTranslations("cart");

  if (!s.ready) {
    return (
      <div className="grid gap-4 lg:grid-cols-12" aria-busy="true">
        <div className="h-64 animate-pulse rounded-3xl bg-canvas dark:bg-surface lg:col-span-8" />
        <div className="h-64 animate-pulse rounded-3xl bg-canvas dark:bg-surface lg:col-span-4" />
      </div>
    );
  }

  if (s.items.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-dashed border-navy-200 bg-canvas px-6 py-16 text-center">
        <span className="relative mb-5 grid size-20 place-items-center rounded-3xl bg-surface shadow-card">
          <ShoppingBag className="size-9 text-navy-300" aria-hidden />
          <span aria-hidden className="absolute -right-2 -top-2 h-6 w-3 -skew-x-[20deg] rounded-sm bg-brand-400" />
        </span>
        <p className="text-xl font-extrabold text-ink">{t("empty")}</p>
        <p className="mt-1.5 text-[14px] text-muted">{t("emptyText")}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Link href="/catalog" className={buttonClass("primary", "md")}>
            {t("browse")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/oil-finder" className={buttonClass("outline", "md")}>
            <Sparkles className="size-4" aria-hidden />
            {t("finder")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-12">
      <div className="lg:col-span-7 xl:col-span-8">
        <div className="rounded-3xl border border-line bg-surface px-4 shadow-card sm:px-6">
          <div className="flex items-center justify-between border-b border-line py-4">
            <p className="text-[14px] font-bold text-ink">{t("items", { count: s.count })}</p>
            <button
              type="button"
              onClick={s.clear}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted transition hover:text-danger"
            >
              <Trash2 className="size-4" aria-hidden />
              {t("clear")}
            </button>
          </div>
          <ul className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {s.lines.map((l) => (
                <motion.li
                  key={`${l.item.slug}:${l.item.key}`}
                  layout
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <CartLine item={l.item} unit={l.unit} total={l.total} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
        {s.hasFreight && (
          <p className="mt-4 flex gap-2 rounded-2xl bg-brand-50 p-4 text-[13px] leading-relaxed text-brand-700 ring-1 ring-brand-200">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("freightNote")}
          </p>
        )}
        <Link href="/catalog" className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-bold text-navy-600 hover:text-navy-800">
          ← {t("continue")}
        </Link>
      </div>

      <aside className="lg:sticky lg:top-24 lg:col-span-5 xl:col-span-4">
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">{t("summary")}</h2>
          <MarketSwitcherInline className="mt-4" />
          <FreeShippingBar left={s.left} progress={s.progress} className="mt-4" />
          <div className="mt-5 border-t border-line pt-4">
            <CartTotals s={s} />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            {s.b2b ? t("b2bNote", { percent: s.discount }) : t("pricesNote")} {t("shippingCalc")}.
          </p>
          <Link href="/checkout" className={buttonClass("primary", "lg", "mt-5 w-full")}>
            {t("checkout")}
            <ArrowRight className="size-5 transition group-hover/btn:translate-x-0.5" aria-hidden />
          </Link>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] font-semibold text-muted">
            <LockKeyhole className="size-3.5" aria-hidden />
            {t("secure")}
          </p>
        </div>
      </aside>
    </div>
  );
}
