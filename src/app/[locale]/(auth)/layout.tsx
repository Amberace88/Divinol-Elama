import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { AuthBrandPanel } from "@/components/account/auth/AuthBrandPanel";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AuthLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="relative bg-canvas">
      <div className="container-x grid items-start gap-6 py-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10 lg:py-16">
        <section className="card w-full p-6 sm:p-9 lg:p-11">
          <div className="mx-auto w-full max-w-[460px]">{children}</div>
        </section>
        <div className="lg:sticky lg:top-28">
          <AuthBrandPanel locale={locale} />
        </div>
      </div>
    </div>
  );
}
