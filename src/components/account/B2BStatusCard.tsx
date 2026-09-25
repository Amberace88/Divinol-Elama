import { getTranslations } from "next-intl/server";
import { ArrowRight, BadgeCheck, Building2, Clock3, MessageCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { AccountProfile } from "./types";

export async function B2BStatusCard({ profile, locale }: { profile: AccountProfile; locale: string }) {
  const t = await getTranslations({ locale, namespace: "account.overview.b2b" });
  const status = profile.b2b_status;

  const Icon = status === "approved" ? BadgeCheck : status === "pending" ? Clock3 : status === "rejected" ? MessageCircle : Building2;

  return (
    <section
      className={cn(
        "relative isolate h-full overflow-hidden rounded-2xl p-5 sm:p-6",
        status === "approved" ? "bg-navy-800 text-white shadow-lift" : "card",
      )}
    >
      {status === "approved" && <div className="grid-bg absolute inset-0 -z-10 opacity-60" aria-hidden />}
      <span className="absolute top-5 -right-4 -z-10 h-8 w-24 -skew-x-12 bg-brand-400/80" aria-hidden />
      <span
        className={cn(
          "grid h-11 w-11 -skew-x-6 place-items-center rounded-xl",
          status === "approved" ? "bg-brand-400 text-navy-900" : status === "pending" ? "bg-brand-100 text-brand-700" : "bg-navy-50 text-navy-700",
        )}
      >
        <Icon className="h-5 w-5 skew-x-6" />
      </span>
      <h2 className={cn("mt-4 text-lg font-extrabold tracking-[-0.01em]", status === "approved" ? "text-white" : "text-navy-800")}>
        {t(`${status}Title`)}
      </h2>
      <p className={cn("mt-1.5 text-sm leading-6", status === "approved" ? "text-white/70" : "text-muted")}>{t(`${status}Text`)}</p>

      {status === "approved" && (
        <dl className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/[0.07] p-3 ring-1 ring-white/10">
            <dt className="text-[11px] font-bold tracking-wider text-white/55 uppercase">{t("discountLabel")}</dt>
            <dd className="mt-1 text-2xl font-extrabold text-brand-300 tabular-nums">{profile.discount_percent}%</dd>
          </div>
          <div className="rounded-xl bg-white/[0.07] p-3 ring-1 ring-white/10">
            <dt className="text-[11px] font-bold tracking-wider text-white/55 uppercase">{t("termsLabel")}</dt>
            <dd className="mt-1 text-2xl font-extrabold tabular-nums">
              {profile.payment_terms_days > 0 ? t("termsValue", { days: profile.payment_terms_days }) : t("termsPrepay")}
            </dd>
          </div>
        </dl>
      )}

      {status === "none" && (
        <Link href="/account/business" className={buttonClass("primary", "sm", "mt-5")}>
          {t("noneCta")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
      {status === "pending" && (
        <Link href="/account/business" className={buttonClass("outline", "sm", "mt-5")}>
          {t("pendingCta")}
        </Link>
      )}
      {status === "rejected" && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/contact" className={buttonClass("dark", "sm")}>
            {t("rejectedCta")}
          </Link>
          <Link href="/account/business" className={buttonClass("ghost", "sm")}>
            {t("rejectedRetry")}
          </Link>
        </div>
      )}
    </section>
  );
}
