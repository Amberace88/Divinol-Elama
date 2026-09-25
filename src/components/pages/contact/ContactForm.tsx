"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Field, InquiryForm, SubmitButton } from "@/components/pages/FormBits";
import { field } from "@/components/pages/inquiry";
import { cn } from "@/lib/utils";

export function ContactForm() {
  const t = useTranslations("contact");
  const [consentError, setConsentError] = useState(false);

  return (
    <InquiryForm
      successText={t("sent")}
      build={(fd) => {
        if (!fd.get("consent")) {
          setConsentError(true);
          return null;
        }
        return {
          type: "contact",
          name: field(fd, "name"),
          email: field(fd, "email"),
          phone: field(fd, "phone"),
          message: field(fd, "message"),
          extra: { consent: true, consent_at: new Date().toISOString() },
        };
      }}
    >
      {(pending) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("name")} name="name" required>
            <input id="f-name" name="name" required maxLength={120} className="input" autoComplete="name" />
          </Field>
          <Field label={t("phone")} name="phone">
            <input id="f-phone" name="phone" type="tel" maxLength={40} className="input" autoComplete="tel" />
          </Field>
          <Field label={t("email")} name="email" required className="sm:col-span-2">
            <input id="f-email" name="email" type="email" required maxLength={160} className="input" autoComplete="email" />
          </Field>
          <Field label={t("message")} name="message" required className="sm:col-span-2">
            <textarea
              id="f-message"
              name="message"
              required
              rows={5}
              maxLength={4000}
              className="input h-auto min-h-32 py-2.5"
              placeholder={t("messagePlaceholder")}
            />
          </Field>
          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-start gap-3 text-[13.5px] leading-5 text-ink/80">
              <input
                type="checkbox"
                name="consent"
                value="1"
                required
                aria-invalid={consentError || undefined}
                aria-describedby={consentError ? "consent-error" : undefined}
                onChange={(e) => e.target.checked && setConsentError(false)}
                className={cn("mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-navy-700", consentError && "outline-2 outline-danger")}
              />
              <span>
                {t.rich("consent", {
                  link: (chunks) => (
                    <Link href="/privacy" className="font-semibold text-navy-600 underline decoration-navy-200 underline-offset-2 hover:decoration-navy-500">
                      {chunks}
                    </Link>
                  ),
                })}
              </span>
            </label>
            {consentError && (
              <p id="consent-error" role="alert" className="mt-2 text-[13px] font-semibold text-danger">
                {t("consentRequired")}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <SubmitButton pending={pending} label={t("submit")} />
          </div>
        </div>
      )}
    </InquiryForm>
  );
}
