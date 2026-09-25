"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { MIN_PASSWORD, authErrorKey } from "./authClient";
import { AuthHeading, FormError, NotConfigured, PasswordInput, PasswordStrength } from "./fields";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    let active = true;
    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      if (active) setHasSession(Boolean(data.user));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e: AuthChangeEvent, session: Session | null) => {
      if (active && session) setHasSession(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured || busy) return;
    if (password.length < MIN_PASSWORD) return setError(t("errors.tooShort", { min: MIN_PASSWORD }));
    if (password !== confirm) return setError(t("errors.mismatch"));
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await createClient().auth.updateUser({ password });
      if (err) {
        setError(t(`errors.${authErrorKey(err)}`));
        return;
      }
      toast.success(t("reset.success"));
      router.replace("/account");
      router.refresh();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <AuthHeading eyebrow={t("reset.eyebrow")} title={t("reset.title")} subtitle={t("reset.subtitle")} />
      {!isSupabaseConfigured && (
        <div className="mb-6">
          <NotConfigured />
        </div>
      )}
      {hasSession === false ? (
        <div className="rounded-2xl border border-line bg-canvas p-5 text-sm leading-6 text-ink/80">
          <p>{t("reset.noSession")}</p>
          <Link href="/forgot-password" className="mt-3 inline-flex items-center gap-2 font-bold text-navy-700 underline-offset-4 hover:underline">
            {t("reset.requestNew")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4">
          <div>
            <label htmlFor="new_password" className="label">
              {t("fields.passwordNew")}
            </label>
            <PasswordInput id="new_password" value={password} onChange={setPassword} autoComplete="new-password" minLength={MIN_PASSWORD} />
            <PasswordStrength password={password} />
          </div>
          <div>
            <label htmlFor="confirm_password" className="label">
              {t("fields.passwordConfirm")}
            </label>
            <PasswordInput id="confirm_password" value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={MIN_PASSWORD} />
          </div>
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={busy || !isSupabaseConfigured || hasSession === null}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("reset.submitting")}
              </>
            ) : (
              <>
                {t("reset.submit")}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
