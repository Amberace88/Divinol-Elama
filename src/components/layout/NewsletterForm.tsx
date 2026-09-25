"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function NewsletterForm() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      toast.error(t("newsletterInvalid"));
      return;
    }
    setState("busy");
    try {
      if (!isSupabaseConfigured) throw new Error("not_configured");
      const { error } = await createClient().rpc("subscribe_newsletter", { p_email: value, p_locale: locale });
      if (error) throw error;
      setState("done");
      setEmail("");
      toast.success(t("newsletterOk"));
    } catch (err) {
      setState("idle");
      const msg = err instanceof Error ? err.message : "";
      toast.error(msg.includes("invalid_email") ? t("newsletterInvalid") : t("newsletterError"));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-2.5">
      <label htmlFor="newsletter-email" className="sr-only">
        {t("newsletterPlaceholder")}
      </label>
      <div className="flex rounded-xl bg-white/[0.07] p-1 ring-1 ring-white/10 transition focus-within:ring-brand-400/70">
        <input
          id="newsletter-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "done") setState("idle");
          }}
          placeholder={t("newsletterPlaceholder")}
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[14px] text-white outline-none placeholder:text-white/40"
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-brand-400 px-4 text-[13px] font-extrabold text-navy-900 transition hover:bg-brand-300 disabled:opacity-70"
        >
          {state === "busy" ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : state === "done" ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <ArrowRight className="size-4" aria-hidden />
          )}
          <span className="hidden sm:inline">{t("newsletterCta")}</span>
          <span className="sr-only sm:hidden">{t("newsletterCta")}</span>
        </button>
      </div>
      <p className="text-[11.5px] leading-relaxed text-white/40">{t("newsletterConsent")}</p>
    </form>
  );
}
