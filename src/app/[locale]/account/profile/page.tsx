import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireAccount } from "@/components/account/server";
import { EmailForm, PasswordForm, ProfileForm } from "@/components/account/ProfileForms";
import { PageTitle } from "@/components/account/ui";

export async function generateMetadata({ params }: PageProps<"/[locale]/account/profile">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.meta" });
  return { title: t("profile") };
}

export default async function ProfilePage({ params }: PageProps<"/[locale]/account/profile">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user, profile } = await requireAccount(locale, "/account/profile");
  const t = await getTranslations({ locale, namespace: "account.profile" });

  return (
    <div>
      <PageTitle title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-5 lg:gap-6">
        <ProfileForm profile={profile} />
        <div className="grid gap-5 lg:gap-6 xl:grid-cols-2">
          <EmailForm currentEmail={user.email ?? profile.email} locale={locale} />
          <PasswordForm />
        </div>
      </div>
    </div>
  );
}
