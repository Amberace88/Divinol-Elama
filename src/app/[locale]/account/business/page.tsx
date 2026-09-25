import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BadgeCheck, BadgePercent, Clock3, FileCheck2, Headset, MessageCircle, Receipt } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { requireAccount } from "@/components/account/server";
import { BusinessForm } from "@/components/account/BusinessForm";
import { PageTitle, Panel } from "@/components/account/ui";

export async function generateMetadata({ params }: PageProps<"/[locale]/account/business">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.meta" });
  return { title: t("business") };
}

const BENEFITS = [
  { key: "prices", Icon: BadgePercent },
  { key: "invoice", Icon: Receipt },
  { key: "documents", Icon: FileCheck2 },
  { key: "manager", Icon: Headset },
] as const;

export default async function BusinessPage({ params }: PageProps<"/[locale]/account/business">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { profile } = await requireAccount(locale, "/account/business");
  const t = await getTranslations({ locale, namespace: "account.business" });
  const status = profile.b2b_status;

  const StatusIcon = status === "approved" ? BadgeCheck : status === "pending" ? Clock3 : status === "rejected" ? MessageCircle : BadgePercent;

  return (
    <div>
      <PageTitle title={t("title")} subtitle={t("subtitle")} />

      <div className="grid gap-5 lg:gap-6">
        {/* Status banner */}
        <section
          className={cn(
            "flex flex-wrap items-start gap-4 rounded-2xl p-5 sm:p-6",
            status === "approved" && "bg-emerald-50 ring-1 ring-emerald-100",
            status === "pending" && "bg-brand-50 ring-1 ring-brand-200",
            status === "rejected" && "bg-danger/5 ring-1 ring-danger/15",
            status === "none" && "bg-navy-50 ring-1 ring-navy-100",
          )}
          role="status"
        >
          <span
            className={cn(
              "grid h-11 w-11 shrink-0 -skew-x-6 place-items-center rounded-xl",
              status === "approved" && "bg-emerald-600 text-white",
              status === "pending" && "bg-brand-400 text-navy-900",
              status === "rejected" && "bg-danger text-white",
              status === "none" && "bg-navy-700 text-white",
            )}
          >
            <StatusIcon className="h-5 w-5 skew-x-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold text-navy-800">{t(`status.${status}.title`)}</h2>
            <p className="mt-1 text-sm leading-6 text-ink/75">{t(`status.${status}.text`)}</p>
          </div>
          {status === "rejected" && (
            <Link href="/contact" className={buttonClass("dark", "sm", "shrink-0")}>
              {t("contact")}
            </Link>
          )}
        </section>

        {status === "approved" ? (
          <>
            <Panel title={t("conditionsTitle")}>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-navy-800 p-5 text-white">
                  <dt className="text-[11px] font-bold tracking-wider text-white/60 uppercase">{t("discount")}</dt>
                  <dd className="h-display mt-1 text-4xl text-brand-300 tabular-nums">{profile.discount_percent}%</dd>
                  <p className="mt-1 text-xs text-white/60">{t("discountHint")}</p>
                </div>
                <div className="rounded-xl border border-line p-5">
                  <dt className="text-[11px] font-bold tracking-wider text-muted uppercase">{t("terms")}</dt>
                  <dd className="h-display mt-1 text-4xl text-navy-800 tabular-nums">
                    {profile.payment_terms_days > 0 ? t("termsValue", { days: profile.payment_terms_days }) : t("termsPrepay")}
                  </dd>
                  <p className="mt-1 text-xs text-muted">{profile.payment_terms_days > 0 ? t("termsHint") : t("termsPrepayHint")}</p>
                </div>
              </dl>
            </Panel>
            <Panel title={t("companyData")} description={t("lockedNote")}>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                {(
                  [
                    ["companyName", profile.company_name],
                    ["regNo", profile.reg_no],
                    ["vatNo", profile.vat_no],
                    ["legalAddress", profile.legal_address],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs font-bold tracking-wider text-muted uppercase">{t(k)}</dt>
                    <dd className="mt-0.5 font-semibold break-words text-ink">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
              <Link href="/contact" className={buttonClass("outline", "sm", "mt-5")}>
                {t("contact")}
              </Link>
            </Panel>
          </>
        ) : (
          <div className="grid gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <Panel
              title={status === "pending" ? t("formTitlePending") : t("formTitle")}
              description={status === "pending" ? t("formTextPending") : t("formText")}
            >
              <BusinessForm profile={profile} />
            </Panel>
            <section className="relative isolate h-fit overflow-hidden rounded-2xl bg-navy-800 p-5 text-white shadow-lift sm:p-6">
              <div className="grid-bg absolute inset-0 -z-10 opacity-60" aria-hidden />
              <span className="absolute top-5 -right-4 -z-10 h-8 w-24 -skew-x-12 bg-brand-400/90" aria-hidden />
              <h2 className="text-base font-extrabold">{t("benefitsTitle")}</h2>
              <ul className="mt-4 grid gap-4">
                {BENEFITS.map(({ key, Icon }) => (
                  <li key={key} className="flex gap-3">
                    <span className="grid h-9 w-9 shrink-0 -skew-x-6 place-items-center rounded-lg bg-brand-400 text-navy-900">
                      <Icon className="h-4 w-4 skew-x-6" />
                    </span>
                    <div>
                      <p className="text-sm font-bold">{t(`benefits.${key}.title`)}</p>
                      <p className="mt-0.5 text-[13px] leading-5 text-white/65">{t(`benefits.${key}.text`)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
