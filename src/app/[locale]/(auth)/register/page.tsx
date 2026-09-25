import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { RegisterForm } from "@/components/account/auth/RegisterForm";
import { getAccount } from "@/components/account/server";
import { safeNextPath } from "@/components/account/format";

export async function generateMetadata({ params }: PageProps<"/[locale]/register">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.meta" });
  return { title: t("register"), robots: { index: false, follow: false } };
}

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function RegisterPage({ params, searchParams }: PageProps<"/[locale]/register">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  if (await getAccount()) return redirect({ href: "/account", locale });
  const rawNext = first(sp.next);
  return (
    <RegisterForm
      initialType={first(sp.type) === "business" ? "business" : "private"}
      next={rawNext ? safeNextPath(rawNext) : undefined}
    />
  );
}
