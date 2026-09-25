"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { authErrorKey, callbackUrl, resolveNext } from "./authClient";
import { AuthHeading, CheckEmail, Field, FormError, NotConfigured } from "./fields";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: callbackUrl(resolveNext("/reset-password", locale)),
      });
      if (err) {
        const key = authErrorKey(err);
        // Never reveal whether an account exists: only surface rate limits / malformed addresses.
        if (key === "rateLimit" || key === "invalidEmail") {
          setError(t(`errors.${key}`));
          return;
        }
      }
      setSent(true);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <CheckEmail title={t("forgot.sentTitle")} text={t("forgot.sentText")} email={email.trim()}>
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-navy-700 underline-offset-4 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          {t("forgot.backToLogin")}
        </Link>
      </CheckEmail>
    );
  }

  return (
    <div>
      <AuthHeading eyebrow={t("forgot.eyebrow")} title={t("forgot.title")} subtitle={t("forgot.subtitle")} />
      {!isSupabaseConfigured && (
        <div className="mb-6">
          <NotConfigured />
        </div>
      )}
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field label={t("fields.email")} htmlFor="email">
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            inputMode="email"
            placeholder={t("fields.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={busy || !isSupabaseConfigured}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("forgot.submitting")}
            </>
          ) : (
            <>
              {t("forgot.submit")}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
      <p className="mt-7 border-t border-line pt-6 text-center text-sm">
        <Link href="/login" className="inline-flex items-center gap-2 font-bold text-navy-700 underline-offset-4 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          {t("forgot.backToLogin")}
        </Link>
      </p>
    </div>
  );
}
