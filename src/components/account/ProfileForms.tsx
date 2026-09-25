"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Mail, KeyRound, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { usePricing } from "@/components/providers/PriceProvider";
import { createClient } from "@/lib/supabase/client";
import { localeNames, locales } from "@/i18n/routing";
import type { Market } from "@/lib/types";
import { updateProfile } from "@/app/[locale]/account/actions";
import { MIN_PASSWORD, authErrorKey, callbackUrl, resolveNext } from "./auth/authClient";
import { PasswordInput, PasswordStrength } from "./auth/fields";
import { Panel } from "./ui";
import type { AccountProfile } from "./types";

export function ProfileForm({ profile }: { profile: AccountProfile }) {
  const t = useTranslations("account.profile");
  const te = useTranslations("account.errors");
  const tm = useTranslations("market");
  const { refresh, setMarket } = usePricing();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "",
    phone: profile.phone ?? "",
    preferred_locale: (locales as readonly string[]).includes(profile.preferred_locale) ? profile.preferred_locale : "lv",
    market: profile.market,
    marketing_consent: profile.marketing_consent,
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateProfile({ ...form, preferred_locale: form.preferred_locale as (typeof locales)[number] });
      if (res.ok) {
        toast.success(t("saved"));
        setMarket(form.market);
        refresh();
      } else toast.error(te(res.error));
    });
  }

  return (
    <Panel title={t("personal")} description={t("personalText")}>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="full_name" className="label">
            {t("fullName")}
          </label>
          <input
            id="full_name"
            className="input"
            autoComplete="name"
            required
            maxLength={120}
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="phone" className="label">
            {t("phone")}
          </label>
          <input
            id="phone"
            type="tel"
            className="input"
            autoComplete="tel"
            maxLength={40}
            placeholder="+371"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="preferred_locale" className="label">
            {t("language")}
          </label>
          <select
            id="preferred_locale"
            className="input"
            value={form.preferred_locale}
            onChange={(e) => setForm({ ...form, preferred_locale: e.target.value })}
          >
            {locales.map((l) => (
              <option key={l} value={l}>
                {localeNames[l]}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted">{t("languageHint")}</p>
        </div>
        <div>
          <label htmlFor="market" className="label">
            {t("market")}
          </label>
          <select
            id="market"
            className="input"
            value={form.market}
            onChange={(e) => setForm({ ...form, market: e.target.value as Market })}
          >
            {(["LV", "EE", "LT"] as const).map((m) => (
              <option key={m} value={m}>
                {tm(m)}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted">{t("marketHint")}</p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-canvas/50 p-4 text-sm leading-6 sm:col-span-2">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-navy-700"
            checked={form.marketing_consent}
            onChange={(e) => setForm({ ...form, marketing_consent: e.target.checked })}
          />
          <span>
            <span className="font-semibold text-ink">{t("marketing")}</span>
            <span className="block text-[13px] text-muted">{t("marketingHint")}</span>
          </span>
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {pending ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function EmailForm({ currentEmail, locale }: { currentEmail: string; locale: string }) {
  const t = useTranslations("account.profile");
  const ta = useTranslations("auth.errors");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = email.trim().toLowerCase();
    if (!next || next === currentEmail.toLowerCase()) {
      toast.error(t("emailSame"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await createClient().auth.updateUser(
        { email: next },
        { emailRedirectTo: callbackUrl(resolveNext("/account/profile", locale)) },
      );
      if (error) toast.error(ta(authErrorKey(error)));
      else {
        toast.success(t("emailSent"), { description: t("emailSentText"), duration: 8000 });
        setEmail("");
      }
    } catch {
      toast.error(ta("generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={<span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-navy-500" />{t("emailSection")}</span>} description={t("emailText")}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="rounded-xl bg-canvas px-3.5 py-2.5 text-sm">
          <span className="text-muted">{t("emailCurrent")}: </span>
          <strong className="break-all text-ink">{currentEmail}</strong>
        </div>
        <div>
          <label htmlFor="new_email" className="label">
            {t("emailNew")}
          </label>
          <input
            id="new_email"
            type="email"
            className="input"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Button type="submit" variant="outline" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("emailSubmit")}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function PasswordForm() {
  const t = useTranslations("account.profile");
  const ta = useTranslations("auth.errors");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return void toast.error(ta("tooShort", { min: MIN_PASSWORD }));
    if (password !== confirm) return void toast.error(ta("mismatch"));
    setBusy(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) toast.error(ta(authErrorKey(error)));
      else {
        toast.success(t("passwordChanged"));
        setPassword("");
        setConfirm("");
      }
    } catch {
      toast.error(ta("generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={<span className="inline-flex items-center gap-2"><KeyRound className="h-4 w-4 text-navy-500" />{t("passwordSection")}</span>} description={t("passwordText")}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <div>
          <label htmlFor="pw_new" className="label">
            {t("passwordNew")}
          </label>
          <PasswordInput id="pw_new" value={password} onChange={setPassword} autoComplete="new-password" minLength={MIN_PASSWORD} />
          <PasswordStrength password={password} />
        </div>
        <div>
          <label htmlFor="pw_confirm" className="label">
            {t("passwordConfirm")}
          </label>
          <PasswordInput id="pw_confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={MIN_PASSWORD} />
        </div>
        <div>
          <Button type="submit" variant="outline" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("passwordSubmit")}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
