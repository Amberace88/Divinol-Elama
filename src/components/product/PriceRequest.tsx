"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, LoaderCircle, MessageSquareQuote, X } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { submitInquiryAction } from "@/lib/email/actions";
import { cn } from "@/lib/utils";

export type PriceRequestPack = { key: string; label: string; sku: string | null };

/** "Request price" button + modal form for products sold without a public price. The request lands in admin → inquiries and is e-mailed to the shop. */
export function PriceRequestButton({
  productName,
  slug,
  packs,
  initialPack,
  size = "full",
  className,
}: {
  productName: string;
  slug: string;
  packs: PriceRequestPack[];
  initialPack?: string | null;
  size?: "full" | "card";
  className?: string;
}) {
  const t = useTranslations("priceRequest");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "relative z-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-navy-700 font-extrabold text-white shadow-[0_10px_24px_-14px_rgb(16_32_74/0.9)] transition hover:bg-navy-600 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
          size === "card" ? "h-11 px-3.5 text-[13px]" : "h-12 w-full px-5 text-[15px]",
          className,
        )}
      >
        <MessageSquareQuote className={size === "card" ? "size-4" : "size-5"} aria-hidden />
        {t("button")}
      </button>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && <PriceRequestModal key="pr" onClose={() => setOpen(false)} productName={productName} slug={slug} packs={packs} initialPack={initialPack ?? null} />}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function PriceRequestModal({
  onClose,
  productName,
  slug,
  packs,
  initialPack,
}: {
  onClose: () => void;
  productName: string;
  slug: string;
  packs: PriceRequestPack[];
  initialPack: string | null;
}) {
  const t = useTranslations("priceRequest");
  const locale = useLocale() as Locale;
  const titleId = useId();
  const shownAt = useRef(0);
  const firstRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", company: "", email: "", phone: "", pack: initialPack ?? (packs.length === 1 ? packs[0].key : ""), qty: "", message: "", hp: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  useEffect(() => {
    shownAt.current = Date.now();
    firstRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || !f.company.trim() || !f.email.trim() || !f.phone.trim()) return setError(t("required"));
    setError(null);
    setState("sending");
    const pack = packs.find((p) => p.key === f.pack);
    const res = await submitInquiryAction({
      type: "quote",
      name: f.name,
      company: f.company,
      email: f.email,
      phone: f.phone,
      message: f.message || undefined,
      locale,
      extra: {
        source: "price_request",
        product_name: productName,
        product: slug,
        pack: pack?.label ?? "",
        sku: pack?.sku ?? "",
        qty: f.qty,
        page: typeof window !== "undefined" ? window.location.href.slice(0, 300) : "",
      },
      trap: { hp: f.hp, ms: Date.now() - shownAt.current },
    });
    if (res.ok) return setState("done");
    setState("idle");
    setError(res.code === "invalid_email" ? t("invalidEmail") : t("error"));
  };

  const input =
    "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink outline-none transition placeholder:text-muted/70 focus:border-navy-400 focus:ring-2 focus:ring-navy-200 dark:focus:ring-navy-700";

  return (
    <motion.div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button type="button" aria-label={t("close")} onClick={onClose} className="absolute inset-0 bg-navy-950/55 backdrop-blur-sm" />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 shadow-lift sm:max-w-lg sm:rounded-3xl sm:p-7"
      >
        <button type="button" onClick={onClose} aria-label={t("close")} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-muted transition hover:bg-canvas hover:text-ink">
          <X className="size-5" aria-hidden />
        </button>

        {state === "done" ? (
          <div className="py-8 text-center">
            <motion.div initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
              <CheckCircle2 className="size-9" aria-hidden />
            </motion.div>
            <p id={titleId} className="text-lg font-extrabold text-ink">{t("done")}</p>
            <button type="button" onClick={onClose} className="mt-6 h-11 rounded-xl bg-navy-700 px-6 font-bold text-white hover:bg-navy-600">
              {t("close")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-300">{t("label")}</p>
            <h2 id={titleId} className="mt-1 pr-8 text-xl font-extrabold tracking-tight text-ink">{t("title")}</h2>
            <p className="mt-1 text-[15px] font-bold text-navy-700 dark:text-navy-200">{productName}</p>
            <p className="mt-2 text-sm text-muted">{t("intro")}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-[13px] font-semibold text-ink sm:col-span-2">
                {t("name")} *
                <input ref={firstRef} className={input} value={f.name} onChange={set("name")} autoComplete="name" maxLength={200} required />
              </label>
              <label className="grid gap-1 text-[13px] font-semibold text-ink sm:col-span-2">
                {t("company")} *
                <input className={input} value={f.company} onChange={set("company")} autoComplete="organization" maxLength={200} required />
              </label>
              <label className="grid gap-1 text-[13px] font-semibold text-ink">
                {t("email")} *
                <input className={input} type="email" value={f.email} onChange={set("email")} autoComplete="email" maxLength={200} required />
              </label>
              <label className="grid gap-1 text-[13px] font-semibold text-ink">
                {t("phone")} *
                <input className={input} type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" maxLength={50} required />
              </label>
              {packs.length > 0 && (
                <label className="grid gap-1 text-[13px] font-semibold text-ink">
                  {t("pack")}
                  <select className={input} value={f.pack} onChange={set("pack")}>
                    {packs.length > 1 && <option value="">{t("any")}</option>}
                    {packs.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className={cn("grid gap-1 text-[13px] font-semibold text-ink", packs.length === 0 && "sm:col-span-2")}>
                {t("qty")}
                <input className={input} value={f.qty} onChange={set("qty")} inputMode="numeric" maxLength={40} />
              </label>
              <label className="grid gap-1 text-[13px] font-semibold text-ink sm:col-span-2">
                {t("message")}
                <textarea className={cn(input, "h-24 resize-none py-2.5")} value={f.message} onChange={set("message")} maxLength={2000} />
              </label>
              {/* honeypot */}
              <input tabIndex={-1} aria-hidden autoComplete="off" value={f.hp} onChange={set("hp")} className="absolute left-[-9999px] h-0 w-0 opacity-0" name="website" />
            </div>

            {error && <p role="alert" className="mt-3 text-sm font-semibold text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={state === "sending"}
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-400 font-extrabold text-navy-900 shadow-[0_10px_24px_-12px_rgb(255_193_14/0.9)] transition hover:bg-brand-300 disabled:opacity-70"
            >
              {state === "sending" && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
              {state === "sending" ? t("sending") : t("send")}
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
