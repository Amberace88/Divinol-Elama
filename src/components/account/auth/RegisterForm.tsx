"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Building2, Loader2, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { usePricing } from "@/components/providers/PriceProvider";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";
import { MIN_PASSWORD, authErrorKey, callbackUrl, resolveNext } from "./authClient";
import { AuthHeading, CheckEmail, Field, FormError, NotConfigured, PasswordInput, PasswordStrength } from "./fields";

type CustomerType = "private" | "business";

const EMPTY = {
  full_name: "",
  phone: "",
  email: "",
  password: "",
  company_name: "",
  reg_no: "",
  vat_no: "",
  legal_address: "",
};

export function RegisterForm({ initialType = "private", next }: { initialType?: CustomerType; next?: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { market } = usePricing();
  const [type, setType] = useState<CustomerType>(initialType);
  const [form, setForm] = useState(EMPTY);
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured || busy) return;
    if (form.password.length < MIN_PASSWORD) return setError(t("errors.tooShort", { min: MIN_PASSWORD }));
    if (!terms) return setError(t("errors.terms"));
    const business = type === "business";
    if (business && (!form.company_name.trim() || !form.reg_no.trim())) return setError(t("errors.companyRequired"));

    setBusy(true);
    setError(null);
    const target = resolveNext(next, locale);
    const clean = (v: string) => v.trim() || null;
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: callbackUrl(target),
          data: {
            full_name: form.full_name.trim(),
            phone: clean(form.phone),
            locale,
            market,
            customer_type: type,
            company_name: business ? clean(form.company_name) : null,
            reg_no: business ? clean(form.reg_no) : null,
            vat_no: business ? clean(form.vat_no) : null,
            legal_address: business ? clean(form.legal_address) : null,
            marketing_consent: marketing,
            terms_accepted_at: new Date().toISOString(),
          },
        },
      });
      if (err) {
        setError(t(`errors.${authErrorKey(err)}`));
        return;
      }
      if (data.session) {
        // E-mail confirmation disabled → already signed in.
        router.replace(target);
        router.refresh();
        return;
      }
      setSentTo(form.email.trim());
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <CheckEmail title={t("register.checkEmailTitle")} text={t("register.checkEmailText")} email={sentTo}>
        <p className="mx-auto max-w-sm text-sm leading-6 text-muted">
          {type === "business" ? t("register.checkEmailBusiness") : t("register.checkEmailHint")}
        </p>
        <Link href="/login" className="mt-5 inline-block text-sm font-bold text-navy-700 underline-offset-4 hover:underline">
          {t("register.backToLogin")}
        </Link>
      </CheckEmail>
    );
  }

  return (
    <div>
      <AuthHeading eyebrow={t("register.eyebrow")} title={t("register.title")} subtitle={t("register.subtitle")} />

      {!isSupabaseConfigured && (
        <div className="mb-6">
          <NotConfigured />
        </div>
      )}

      <div role="tablist" aria-label={t("register.typeLabel")} className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1 ring-1 ring-line">
        {(["private", "business"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={type === k}
            onClick={() => setType(k)}
            className={cn(
              "relative flex h-10 items-center justify-center rounded-lg text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-300",
              type === k ? "text-navy-800" : "text-muted hover:text-navy-700",
            )}
          >
            {type === k && (
              <motion.span
                layoutId="register-type"
                className="absolute inset-0 rounded-lg bg-surface shadow-card"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              {k === "private" ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
              {k === "private" ? t("register.typePrivate") : t("register.typeBusiness")}
            </span>
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="grid gap-4">
        <AnimatePresence initial={false}>
          {type === "business" && (
            <motion.fieldset
              key="company"
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <legend className="sr-only">{t("register.companySection")}</legend>
              <div className="grid gap-4 rounded-2xl border border-navy-100 bg-navy-50/50 p-4 sm:grid-cols-2">
                <p className="text-[13px] leading-6 text-navy-700 sm:col-span-2">{t("register.businessNote")}</p>
                <Field label={t("fields.companyName")} htmlFor="company_name" className="sm:col-span-2">
                  <input
                    id="company_name"
                    className="input"
                    autoComplete="organization"
                    value={form.company_name}
                    onChange={set("company_name")}
                    required
                  />
                </Field>
                <Field label={t("fields.regNo")} htmlFor="reg_no">
                  <input id="reg_no" className="input" value={form.reg_no} onChange={set("reg_no")} required />
                </Field>
                <Field label={t("fields.vatNo")} htmlFor="vat_no" optional>
                  <input id="vat_no" className="input" placeholder="LV40000000000" value={form.vat_no} onChange={set("vat_no")} />
                </Field>
                <Field label={t("fields.legalAddress")} htmlFor="legal_address" className="sm:col-span-2" optional>
                  <input
                    id="legal_address"
                    className="input"
                    autoComplete="street-address"
                    value={form.legal_address}
                    onChange={set("legal_address")}
                  />
                </Field>
              </div>
            </motion.fieldset>
          )}
        </AnimatePresence>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={type === "business" ? t("fields.contactPerson") : t("fields.fullName")} htmlFor="full_name">
            <input id="full_name" className="input" autoComplete="name" value={form.full_name} onChange={set("full_name")} required />
          </Field>
          <Field label={t("fields.phone")} htmlFor="phone" optional={type === "private"}>
            <input
              id="phone"
              type="tel"
              className="input"
              autoComplete="tel"
              placeholder="+371"
              value={form.phone}
              onChange={set("phone")}
              required={type === "business"}
            />
          </Field>
        </div>

        <Field label={t("fields.email")} htmlFor="reg_email">
          <input
            id="reg_email"
            type="email"
            className="input"
            autoComplete="email"
            inputMode="email"
            placeholder={t("fields.emailPlaceholder")}
            value={form.email}
            onChange={set("email")}
            required
          />
        </Field>

        <div>
          <label htmlFor="reg_password" className="label">
            {t("fields.password")}
          </label>
          <PasswordInput
            id="reg_password"
            value={form.password}
            onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
          />
          <PasswordStrength password={form.password} />
        </div>

        <div className="grid gap-3 pt-1">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-ink/80">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-navy-700"
              required
            />
            <span>
              {t.rich("register.terms", {
                link: (chunks) => (
                  <Link href="/terms" target="_blank" className="font-bold text-navy-700 underline underline-offset-4">
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link href="/privacy" target="_blank" className="font-bold text-navy-700 underline underline-offset-4">
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-ink/80">
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-navy-700"
            />
            <span>{t("register.marketing")}</span>
          </label>
        </div>

        <FormError message={error} />

        <Button type="submit" size="lg" className="mt-1 w-full" disabled={busy || !isSupabaseConfigured}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("register.submitting")}
            </>
          ) : (
            <>
              {type === "business" ? t("register.submitBusiness") : t("register.submit")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-7 border-t border-line pt-6 text-center text-sm text-muted">
        {t("register.haveAccount")}{" "}
        <Link href={next ? { pathname: "/login", query: { next } } : "/login"} className="font-bold text-navy-700 underline-offset-4 hover:underline">
          {t("register.login")}
        </Link>
      </p>
    </div>
  );
}
