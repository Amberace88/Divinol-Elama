"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { InquiryError, submitInquiry, type InquiryPayload } from "./inquiry";

export function Field({
  label,
  name,
  required,
  className,
  hint,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  className?: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={`f-${name}`} className="label">
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-danger">
            *
          </span>
        )}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Invisible honeypot — bots fill it, people don't. */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

export function PrivacyNote({ className }: { className?: string }) {
  const t = useTranslations("pagesUi");
  return (
    <p className={cn("text-xs leading-5 text-muted", className)}>
      {t.rich("privacyNote", {
        link: (chunks) => (
          <Link href="/privacy" className="font-semibold text-navy-600 underline decoration-navy-200 underline-offset-2 hover:decoration-navy-500">
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}

export function SubmitButton({ pending, label, className }: { pending: boolean; label: string; className?: string }) {
  const t = useTranslations("actions");
  return (
    <Button type="submit" size="lg" disabled={pending} className={cn("w-full sm:w-auto", className)}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
      {pending ? t("sending") : label}
    </Button>
  );
}

/**
 * Wraps an inquiry form: handles submit → RPC, pending state, toasts and an animated success panel.
 * `build` turns the FormData into the RPC payload (return null to abort, e.g. failed custom validation).
 */
export function InquiryForm({
  build,
  successText,
  children,
  className,
}: {
  build: (fd: FormData, locale: string) => Omit<InquiryPayload, "locale"> | null;
  successText: string;
  children: (pending: boolean) => React.ReactNode;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (fd.get("website")) {
      setDone(true); // honeypot hit: pretend success
      return;
    }
    const payload = build(fd, locale);
    if (!payload) return;
    setPending(true);
    try {
      await submitInquiry({ ...payload, locale });
      form.reset();
      setDone(true);
      toast.success(successText);
    } catch (err) {
      const code = err instanceof InquiryError ? err.code : "failed";
      toast.error(code === "invalid_email" ? t("errors.email") : code === "unavailable" ? t("errors.unavailable") : t("errors.generic"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center gap-4 py-10 text-center"
            role="status"
          >
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
              className="grid size-16 place-items-center rounded-full bg-success/10 text-success"
            >
              <CheckCircle2 className="size-9" aria-hidden />
            </motion.span>
            <p className="text-xl font-extrabold text-navy-700">{t("pagesUi.sentTitle")}</p>
            <p className="max-w-sm text-[15px] leading-6 text-muted">{successText}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setDone(false)}>
              {t("pagesUi.sendAnother")}
            </Button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={onSubmit}
            className="relative"
          >
            <Honeypot />
            {children(pending)}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
