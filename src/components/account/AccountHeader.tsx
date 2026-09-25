import { getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { ArrowRight, BadgeCheck, Building2, Clock3, Percent, ShieldCheck, UserRound } from "lucide-react";
import { formatDate } from "./format";
import type { AccountProfile } from "./types";

export async function AccountHeader({ profile, locale }: { profile: AccountProfile; locale: string }) {
  const t = await getTranslations({ locale, namespace: "account.header" });
  const name = profile.full_name?.trim() || profile.email;
  const initials =
    (profile.full_name ?? profile.email)
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "•";
  const business = profile.customer_type === "business" || Boolean(profile.company_name);
  const approved = profile.b2b_status === "approved";
  const isAdmin = profile.role === "admin";

  return (
    <header className="relative isolate overflow-hidden rounded-3xl bg-navy-800 px-5 py-6 text-white shadow-lift sm:px-8 sm:py-8">
      <div className="grid-bg absolute inset-0 -z-10 opacity-60" aria-hidden />
      <div className="absolute -top-20 right-0 -z-10 h-56 w-56 rounded-full bg-brand-400/15 blur-3xl" aria-hidden />

      <div className="flex flex-wrap items-center gap-4 sm:gap-5">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-lg font-extrabold ring-1 ring-white/15 sm:h-16 sm:w-16">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold tracking-[0.18em] text-brand-300 uppercase">{t("eyebrow")}</p>
          <h1 className="h-display mt-1 truncate text-2xl sm:text-3xl">{name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-white/65">
            {isAdmin && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-brand-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t("admin")}
              </span>
            )}
            {business ? (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {profile.company_name || t("customerBusiness")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5" />
                {t("customerPrivate")}
              </span>
            )}
            {profile.created_at && <span>{t("memberSince", { date: formatDate(profile.created_at, locale, { month: "long" }) })}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <NextLink
              href="/admin"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-400 px-4 text-[14px] font-bold text-navy-900 transition hover:bg-brand-300"
            >
              <ShieldCheck className="h-4 w-4" />
              {t("adminPanel")}
              <ArrowRight className="h-4 w-4" />
            </NextLink>
          )}
          {approved && (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-400 px-2.5 py-1 text-[12px] font-extrabold text-navy-900">
                <BadgeCheck className="h-3.5 w-3.5" />
                {t("b2bApproved")}
              </span>
              {profile.discount_percent > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-[12px] font-bold ring-1 ring-white/15">
                  <Percent className="h-3.5 w-3.5 text-brand-300" />
                  {t("discount", { value: profile.discount_percent })}
                </span>
              )}
              {profile.payment_terms_days > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-[12px] font-bold ring-1 ring-white/15">
                  <Clock3 className="h-3.5 w-3.5 text-brand-300" />
                  {t("terms", { days: profile.payment_terms_days })}
                </span>
              )}
            </>
          )}
          {profile.b2b_status === "pending" && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-[12px] font-bold text-brand-200 ring-1 ring-white/15">
              <Clock3 className="h-3.5 w-3.5" />
              {t("b2bPending")}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
