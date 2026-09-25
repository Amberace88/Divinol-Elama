"use client";

import { useTranslations } from "next-intl";
import { ExternalLink, Headset, Search } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { Field, InquiryForm, PrivacyNote, SubmitButton } from "@/components/pages/FormBits";
import { field } from "@/components/pages/inquiry";
import type { FinderInput } from "@/lib/finder";

const ADVISOR_URL = "https://zellergmelin.lubricantadvisor.com/eng/";

export function ExpertForm({
  selection,
  recommended,
}: {
  selection: (FinderInput & { labels: string[] }) | null;
  recommended: string[];
}) {
  const t = useTranslations("finder");

  return (
    <section id="expert" aria-labelledby="expert-title" className="grid scroll-mt-28 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <div className="card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-400 text-navy-900">
            <Headset className="size-6" aria-hidden />
          </span>
          <div>
            <p className="eyebrow">{t("expertEyebrow")}</p>
            <h2 id="expert-title" className="h-display mt-1 text-2xl text-navy-700 sm:text-[1.75rem]">
              {t("expertTitle")}
            </h2>
            <p className="mt-2 text-[15px] leading-6 text-muted">{t("expertText")}</p>
          </div>
        </div>

        <InquiryForm
          className="mt-6"
          successText={t("sent")}
          build={(fd) => {
            const plate = field(fd, "plate");
            const model = field(fd, "car_model");
            const comment = field(fd, "comment");
            return {
              type: "oil_finder",
              name: field(fd, "name"),
              email: field(fd, "email"),
              phone: field(fd, "phone"),
              message: [`${t("plate")}: ${plate}`, model && `${t("carModel")}: ${model}`, comment].filter(Boolean).join("\n"),
              extra: {
                plate,
                car_model: model,
                selection: selection ?? undefined,
                recommended: recommended.length ? recommended : undefined,
              },
            };
          }}
        >
          {(pending) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("plate")} name="plate" required>
                <input id="f-plate" name="plate" required maxLength={40} className="input uppercase placeholder:normal-case" placeholder={t("platePlaceholder")} autoComplete="off" />
              </Field>
              <Field label={t("carModel")} name="car_model">
                <input id="f-car_model" name="car_model" maxLength={160} className="input" placeholder={t("carModelPlaceholder")} />
              </Field>
              <Field label={t("name")} name="name" required>
                <input id="f-name" name="name" required maxLength={120} className="input" autoComplete="name" />
              </Field>
              <Field label={t("email")} name="email" required>
                <input id="f-email" name="email" type="email" required maxLength={160} className="input" autoComplete="email" />
              </Field>
              <Field label={t("phone")} name="phone" className="sm:col-span-2">
                <input id="f-phone" name="phone" type="tel" maxLength={40} className="input" autoComplete="tel" />
              </Field>
              <Field label={t("comment")} name="comment" className="sm:col-span-2">
                <textarea id="f-comment" name="comment" rows={3} maxLength={2000} className="input h-auto min-h-24 py-2.5" />
              </Field>
              <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <PrivacyNote className="max-w-md" />
                <SubmitButton pending={pending} label={t("expertCta")} />
              </div>
            </div>
          )}
        </InquiryForm>
      </div>

      <aside className="relative isolate flex flex-col overflow-hidden rounded-2xl bg-navy-800 p-6 text-white shadow-lift sm:p-8">
        <div aria-hidden className="grid-bg absolute inset-0 -z-10 opacity-60" />
        <div aria-hidden className="absolute -right-16 -bottom-16 -z-10 size-64 rounded-full bg-brand-400/20 blur-3xl" />
        <span className="grid size-12 place-items-center rounded-xl bg-white/10 text-brand-400 ring-1 ring-white/15">
          <Search className="size-6" aria-hidden />
        </span>
        <p className="eyebrow mt-5 text-brand-300">{t("advisorEyebrow")}</p>
        <h2 className="h-display mt-1 text-2xl">{t("advisorTitle")}</h2>
        <p className="mt-3 text-[15px] leading-6 text-white/70">{t("advisorText")}</p>
        <div className="mt-auto pt-8">
          <a href={ADVISOR_URL} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "md", "w-full sm:w-auto")}>
            {t("advisorCta")}
            <ExternalLink className="size-4" aria-hidden />
          </a>
        </div>
      </aside>
    </section>
  );
}
