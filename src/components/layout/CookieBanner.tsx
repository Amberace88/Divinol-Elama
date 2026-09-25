"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Cookie } from "lucide-react";
import { Link } from "@/i18n/navigation";

const KEY = "divinol-cookie-consent";
export type CookieConsent = "all" | "necessary";

/** Read the stored choice (other code can use this before loading analytics). */
export function getCookieConsent(): CookieConsent | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "all" || v === "necessary" ? v : null;
  } catch {
    return null;
  }
}

export function CookieBanner() {
  const t = useTranslations("cookies");
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Delay so the banner never competes with the first paint (LCP).
    const id = window.setTimeout(() => setShow(getCookieConsent() === null), 1200);
    return () => window.clearTimeout(id);
  }, []);

  const choose = (v: CookieConsent) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent("cookie-consent", { detail: v }));
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="region"
          aria-label={t("title")}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-3 bottom-3 z-[65] rounded-2xl border border-line bg-surface p-4 shadow-lift sm:inset-x-auto sm:left-5 sm:bottom-5 sm:max-w-sm"
        >
          <div className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <Cookie className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] leading-relaxed text-ink/80">
                {t("text")}{" "}
                <Link href="/privacy" className="font-semibold text-navy-600 underline underline-offset-2">
                  {t("more")}
                </Link>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => choose("all")}
                  className="h-9 rounded-lg bg-navy-700 px-4 text-[13px] font-bold text-white transition hover:bg-navy-600"
                >
                  {t("accept")}
                </button>
                <button
                  type="button"
                  onClick={() => choose("necessary")}
                  className="h-9 rounded-lg px-3 text-[13px] font-bold text-navy-700 ring-1 ring-line transition hover:bg-canvas"
                >
                  {t("decline")}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
