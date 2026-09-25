"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, KeyRound, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";
import { authErrorKey, callbackUrl, resolveNext } from "./authClient";
import { AuthHeading, CheckEmail, Field, FormError, NotConfigured, PasswordInput } from "./fields";

type Mode = "password" | "magic";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ? t("errors.callback") : null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured || busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const target = resolveNext(next, locale);
    try {
      if (mode === "password") {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) {
          setError(t(`errors.${authErrorKey(err)}`));
          return;
        }
        toast.success(t("login.success"));
        router.replace(target);
        router.refresh();
      } else {
        const { error: err } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: false, emailRedirectTo: callbackUrl(target) },
        });
        if (err) {
          setError(t(`errors.${authErrorKey(err)}`));
          return;
        }
        setSent(true);
      }
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <CheckEmail title={t("login.magicSentTitle")} text={t("login.magicSentText")} email={email.trim()}>
        <button type="button" onClick={() => setSent(false)} className="text-sm font-bold text-navy-600 underline-offset-4 hover:underline">
          {t("login.useAnotherMethod")}
        </button>
      </CheckEmail>
    );
  }

  return (
    <div>
      <AuthHeading eyebrow={t("login.eyebrow")} title={t("login.title")} subtitle={t("login.subtitle")} />

      {!isSupabaseConfigured && (
        <div className="mb-6">
          <NotConfigured />
        </div>
      )}

      <div role="tablist" aria-label={t("login.modeLabel")} className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1 ring-1 ring-line">
        {(["password", "magic"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cn(
              "relative flex h-10 items-center justify-center gap-2 rounded-lg text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-300",
              mode === m ? "text-navy-800" : "text-muted hover:text-navy-700",
            )}
          >
            {mode === m && (
              <motion.span
                layoutId="login-mode"
                className="absolute inset-0 rounded-lg bg-white shadow-card"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              {m === "password" ? <KeyRound className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
              {m === "password" ? t("login.modePassword") : t("login.modeMagic")}
            </span>
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="grid gap-4">
        <Field label={t("fields.email")} htmlFor="email">
          <input
            id="email"
            name="email"
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

        <AnimatePresence initial={false} mode="popLayout">
          {mode === "password" ? (
            <motion.div
              key="pw"
              initial={reduce ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <label htmlFor="password" className="text-[13px] font-semibold text-ink/80">
                  {t("fields.password")}
                </label>
                <Link href="/forgot-password" className="text-xs font-bold text-navy-600 underline-offset-4 hover:underline">
                  {t("login.forgot")}
                </Link>
              </div>
              <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
            </motion.div>
          ) : (
            <motion.p
              key="magic"
              initial={reduce ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="rounded-xl bg-navy-50/70 px-3.5 py-3 text-[13px] leading-6 text-navy-700"
            >
              {t("login.magicHint")}
            </motion.p>
          )}
        </AnimatePresence>

        <FormError message={error} />

        <Button type="submit" size="lg" className="mt-1 w-full" disabled={busy || !isSupabaseConfigured}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("login.submitting")}
            </>
          ) : (
            <>
              {mode === "password" ? t("login.submit") : t("login.magicSubmit")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-7 border-t border-line pt-6 text-center text-sm text-muted">
        {t("login.noAccount")}{" "}
        <Link
          href={next ? { pathname: "/register", query: { next } } : "/register"}
          className="font-bold text-navy-700 underline-offset-4 hover:underline"
        >
          {t("login.register")}
        </Link>
      </p>
    </div>
  );
}
