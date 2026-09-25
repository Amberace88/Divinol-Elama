import type { Metadata } from "next";
import { redirect as nextRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { locales } from "@/i18n/routing";
import { LoginForm } from "@/components/account/auth/LoginForm";
import { getAccount } from "@/components/account/server";
import { safeNextPath } from "@/components/account/format";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.meta" });
  return { title: t("login"), robots: { index: false, follow: false } };
}

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const rawNext = first(sp.next);
  const next = rawNext ? safeNextPath(rawNext) : undefined;

  if (await getAccount()) {
    const seg = next?.split(/[/?#]/)[1] ?? "";
    if (next && (seg === "admin" || (locales as readonly string[]).includes(seg))) nextRedirect(next);
    return redirect({ href: "/account", locale });
  }

  return <LoginForm next={next} initialError={first(sp.error)} />;
}
