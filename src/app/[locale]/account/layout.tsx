import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { AccountHeader } from "@/components/account/AccountHeader";
import { AccountNav } from "@/components/account/AccountNav";
import { requireAccount } from "@/components/account/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AccountLayout({ children, params }: LayoutProps<"/[locale]/account">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { profile } = await requireAccount(locale);

  return (
    <div className="bg-canvas">
      <div className="container-x py-6 sm:py-10 lg:py-12">
        <AccountHeader profile={profile} locale={locale} />
        <div className="mt-5 grid gap-5 lg:mt-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-8">
          <aside>
            <AccountNav b2bStatus={profile.b2b_status} />
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
