"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowRight, Info, ShoppingBag, Sparkles, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";
import { FreeShippingBar } from "./FreeShippingBar";
import { CartLine } from "./CartLine";
import { CartTotals } from "./CartTotals";
import { useCartSummary } from "./useCartSummary";

export function CartDrawer() {
  const s = useCartSummary();
  const { open, setOpen } = s;
  const t = useTranslations("cart");
  const ta = useTranslations("a11y");
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Close when the route changes (e.g. after clicking a product in the drawer).
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      setOpen(false);
    }
  }, [pathname, setOpen]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const id = window.setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(id);
    };
  }, [open, setOpen]);

  const close = () => setOpen(false);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90]" key="cart-drawer">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col bg-white shadow-[-30px_0_60px_-20px_rgb(10_17_34/0.4)]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <header className="flex items-center gap-3 border-b border-line px-5 py-4">
              <span className="grid size-10 place-items-center rounded-xl bg-navy-700 text-brand-400">
                <ShoppingBag className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="cart-drawer-title" className="text-lg font-extrabold tracking-tight text-ink">
                  {t("title")}
                </h2>
                <p className="text-[12px] text-muted">{t("items", { count: s.count })}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label={ta("close")}
                className="grid size-10 place-items-center rounded-xl text-muted transition hover:bg-canvas hover:text-ink"
              >
                <X className="size-5" aria-hidden />
              </button>
            </header>

            {s.items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring" }}
                  className="relative mb-5 grid size-24 place-items-center rounded-3xl bg-canvas"
                >
                  <ShoppingBag className="size-10 text-navy-300" aria-hidden />
                  <span aria-hidden className="absolute -right-2 -top-2 h-6 w-3 -skew-x-[20deg] rounded-sm bg-brand-400" />
                </motion.div>
                <p className="text-lg font-extrabold text-ink">{t("empty")}</p>
                <p className="mt-1.5 text-[14px] text-muted">{t("emptyText")}</p>
                <div className="mt-6 grid w-full gap-2">
                  <Link href="/catalog" onClick={close} className={buttonClass("primary", "md", "w-full")}>
                    {t("browse")}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <Link href="/oil-finder" onClick={close} className={buttonClass("outline", "md", "w-full")}>
                    <Sparkles className="size-4" aria-hidden />
                    {t("finder")}
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="px-5 pt-4">
                  <FreeShippingBar left={s.left} progress={s.progress} />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
                  <motion.ul layout className="divide-y divide-line">
                    <AnimatePresence initial={false}>
                      {s.lines.map((l) => (
                        <motion.li
                          key={`${l.item.slug}:${l.item.key}`}
                          layout
                          initial={{ opacity: 0, x: 24 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -24, height: 0 }}
                          transition={{ duration: 0.25 }}
                        >
                          <CartLine item={l.item} unit={l.unit} total={l.total} onNavigate={close} compact />
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </motion.ul>
                  {s.hasFreight && (
                    <p className="mb-4 flex gap-2 rounded-xl bg-brand-50 p-3 text-[12.5px] leading-relaxed text-brand-700 ring-1 ring-brand-200">
                      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {t("freightNote")}
                    </p>
                  )}
                </div>
                <footer className="border-t border-line bg-canvas/60 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <CartTotals s={s} />
                  <p className="mt-2 text-[12px] text-muted">
                    {s.b2b ? t("b2bNote", { percent: s.discount }) : t("pricesNote")} {t("shippingCalc")}.
                  </p>
                  <div className="mt-4 grid gap-2">
                    <Link href="/checkout" onClick={close} className={buttonClass("primary", "lg", "w-full")}>
                      {t("checkout")}
                      <ArrowRight className="size-5 transition group-hover/btn:translate-x-0.5" aria-hidden />
                    </Link>
                    <div className="grid grid-cols-2 gap-2">
                      <Link href="/cart" onClick={close} className={buttonClass("outline", "md", "w-full")}>
                        {t("viewCart")}
                      </Link>
                      <button type="button" onClick={close} className={buttonClass("ghost", "md", "w-full")}>
                        {t("continue")}
                      </button>
                    </div>
                  </div>
                </footer>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
