"use client";

import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Field, InquiryForm, PrivacyNote, SubmitButton } from "@/components/pages/FormBits";
import { field } from "@/components/pages/inquiry";
import { SEGMENTS, VOLUMES } from "./segments";


export function QuoteForm() {
  const t = useTranslations("business");
  return (
    <InquiryForm
      successText={t("sent")}
      build={(fd) => {
        const segment = field(fd, "segment");
        const volume = field(fd, "volume");
        return {
          type: "b2b",
          name: field(fd, "name"),
          email: field(fd, "email"),
          phone: field(fd, "phone"),
          company: field(fd, "company"),
          message: field(fd, "message"),
          extra: {
            reg_no: field(fd, "reg_no") || undefined,
            segment: segment || undefined,
            segment_label: segment ? (segment === "other" ? t("segmentOther") : t(`segments.${segment}`)) : undefined,
            monthly_volume: volume || undefined,
            monthly_volume_label: volume ? t(`volumes.${volume}`) : undefined,
          },
        };
      }}
    >
      {(pending) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("company")} name="company" required>
            <input id="f-company" name="company" required maxLength={200} className="input" autoComplete="organization" />
          </Field>
          <Field label={t("regNo")} name="reg_no">
            <input id="f-reg_no" name="reg_no" maxLength={40} className="input" inputMode="numeric" />
          </Field>
          <Field label={t("name")} name="name" required>
            <input id="f-name" name="name" required maxLength={120} className="input" autoComplete="name" />
          </Field>
          <Field label={t("email")} name="email" required>
            <input id="f-email" name="email" type="email" required maxLength={160} className="input" autoComplete="email" />
          </Field>
          <Field label={t("phone")} name="phone" required>
            <input id="f-phone" name="phone" type="tel" required maxLength={40} className="input" autoComplete="tel" />
          </Field>
          <Field label={t("segment")} name="segment">
            <div className="relative">
              <select id="f-segment" name="segment" defaultValue="" className="input appearance-none pr-10">
                <option value="">{t("choose")}</option>
                {SEGMENTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`segments.${s}`)}
                  </option>
                ))}
                <option value="other">{t("segmentOther")}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-navy-400" aria-hidden />
            </div>
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="label">{t("volume")}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {VOLUMES.map((v) => (
                <label key={v} className="relative cursor-pointer">
                  <input type="radio" name="volume" value={v} className="peer sr-only" />
                  <span className="flex h-11 items-center justify-center rounded-xl border border-line bg-surface px-3 text-sm font-bold text-navy-700 transition peer-checked:border-navy-700 peer-checked:bg-navy-700 peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-navy-100 hover:border-navy-300">
                    {t(`volumes.${v}`)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={t("message")} name="message" className="sm:col-span-2">
            <textarea id="f-message" name="message" rows={4} maxLength={4000} className="input h-auto min-h-28 py-2.5" placeholder={t("messagePlaceholder")} />
          </Field>
          <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <PrivacyNote className="max-w-md" />
            <SubmitButton pending={pending} label={t("submit")} />
          </div>
        </div>
      )}
    </InquiryForm>
  );
}
