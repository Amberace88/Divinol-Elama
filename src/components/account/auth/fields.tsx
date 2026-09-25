"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Eye, EyeOff, MailCheck, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";
import { passwordStrength } from "./authClient";

export function Field({
  label,
  hint,
  optional,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
  htmlFor: string;
  className?: string;
}) {
  const t = useTranslations("auth.fields");
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label flex items-baseline justify-between gap-2">
        <span>{label}</span>
        {optional && <span className="text-[11px] font-medium text-muted">{t("optional")}</span>}
      </label>
      {children}
      {hint && <div className="mt-1.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  required = true,
  minLength,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  required?: boolean;
  minLength?: number;
}) {
  const t = useTranslations("auth");
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={id}
        type={show ? "text" : "password"}
        className="input pr-11"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-muted transition hover:text-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-300"
        aria-label={show ? t("hidePassword") : t("showPassword")}
        aria-pressed={show}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const STRENGTH_TONE = ["bg-line", "bg-danger", "bg-brand-500", "bg-navy-400", "bg-success"];

export function PasswordStrength({ password }: { password: string }) {
  const t = useTranslations("auth.strength");
  const s = passwordStrength(password);
  const labels = ["", t("weak"), t("fair"), t("good"), t("strong")];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn("h-1.5 flex-1 -skew-x-12 rounded-sm transition-colors duration-300", i <= s ? STRENGTH_TONE[s] : "bg-line")}
          />
        ))}
      </div>
      <p className="mt-1.5 flex justify-between gap-3 text-xs text-muted">
        <span>{t("hint")}</span>
        {s > 0 && (
          <span className="shrink-0 font-semibold text-ink/80">
            {t("label")}: {labels[s]}
          </span>
        )}
      </p>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-3 text-sm text-danger">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function NotConfigured() {
  const t = useTranslations("auth.notConfigured");
  return (
    <div className="rounded-2xl border border-brand-300/60 bg-brand-50 p-5 text-sm text-ink/80">
      <div className="flex items-center gap-2 font-bold text-navy-700">
        <PlugZap className="h-4 w-4 text-brand-600" />
        {t("title")}
      </div>
      <p className="mt-1.5 leading-6">{t("text")}</p>
    </div>
  );
}

export function CheckEmail({ title, text, email, children }: { title: string; text: string; email?: string; children?: React.ReactNode }) {
  const id = useId();
  return (
    <div className="text-center" role="status" aria-labelledby={id}>
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-navy-50 text-navy-700 ring-8 ring-navy-50/50">
        <MailCheck className="h-7 w-7" />
      </span>
      <h2 id={id} className="h-display mt-5 text-2xl text-navy-800">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-[15px] leading-7 text-muted">
        {text}
        {email && (
          <>
            {" "}
            <strong className="font-bold text-ink">{email}</strong>
          </>
        )}
      </p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

export function AuthHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-7">
      <span className="eyebrow">{eyebrow}</span>
      <h1 className="h-display mt-3 text-3xl text-navy-800 sm:text-[2.1rem]">{title}</h1>
      {subtitle && <p className="mt-2 text-[15px] leading-7 text-muted">{subtitle}</p>}
    </div>
  );
}
