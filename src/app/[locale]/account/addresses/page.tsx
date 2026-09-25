import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireAccount } from "@/components/account/server";
import { AddressBook } from "@/components/account/AddressBook";
import { LoadError, PageTitle } from "@/components/account/ui";
import { ADDRESS_COLUMNS, type AddressRow } from "@/components/account/types";

export async function generateMetadata({ params }: PageProps<"/[locale]/account/addresses">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.meta" });
  return { title: t("addresses") };
}

export default async function AddressesPage({ params }: PageProps<"/[locale]/account/addresses">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user, profile } = await requireAccount(locale, "/account/addresses");
  const t = await getTranslations({ locale, namespace: "account" });

  const { data, error } = await supabase
    .from("addresses")
    .select(ADDRESS_COLUMNS)
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  const addresses = (data ?? []) as AddressRow[];

  return (
    <div>
      <PageTitle title={t("addresses.title")} subtitle={t("addresses.subtitle")} />
      {error && (
        <div className="mb-4">
          <LoadError text={t("common.loadError")} />
        </div>
      )}
      <AddressBook
        addresses={addresses}
        defaults={{ name: profile.full_name ?? "", phone: profile.phone ?? "", country: profile.market }}
      />
    </div>
  );
}
