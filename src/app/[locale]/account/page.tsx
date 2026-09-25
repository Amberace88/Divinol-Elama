import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Droplets, FileText, Headset, MapPin, Package, Receipt, Search, UserRound, Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { AnimatedNumber } from "@/components/account/AnimatedNumber";
import { B2BStatusCard } from "@/components/account/B2BStatusCard";
import { OrderList, type OrderListRow } from "@/components/account/OrderList";
import { requireAccount } from "@/components/account/server";
import { invoiceState, num } from "@/components/account/format";
import { EmptyState, LoadError, Panel } from "@/components/account/ui";
import { INVOICE_COLUMNS, type InvoiceRow } from "@/components/account/types";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/account">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.meta" });
  return { title: t("overview") };
}

const QUICK_LINKS = [
  { href: "/catalog", key: "catalog", Icon: Droplets },
  { href: "/oil-finder", key: "finder", Icon: Search },
  { href: "/account/invoices", key: "invoices", Icon: FileText },
  { href: "/account/addresses", key: "addresses", Icon: MapPin },
  { href: "/account/profile", key: "profile", Icon: UserRound },
  { href: "/contact", key: "contact", Icon: Headset },
] as const;

export default async function AccountOverviewPage({ params }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user, profile } = await requireAccount(locale);
  const t = await getTranslations({ locale, namespace: "account" });

  const [ordersRes, invoicesRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, number, created_at, status, payment_status, payment_method, total_gross, order_items(qty)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("invoices").select(INVOICE_COLUMNS).eq("user_id", user.id).eq("status", "issued").neq("type", "credit_note"),
  ]);

  const orders = (ordersRes.data ?? []) as OrderListRow[];
  const openInvoices = (invoicesRes.data ?? []) as InvoiceRow[];
  const failed = Boolean(ordersRes.error || invoicesRes.error);

  const spent = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + num(o.total_gross), 0);
  const unpaidTotal = openInvoices.reduce((s, i) => s + num(i.total_gross), 0);
  const overdue = openInvoices.filter((i) => invoiceState(i) === "overdue").length;
  const firstName = profile.full_name?.trim().split(/\s+/)[0];

  const stats = [
    { key: "orders", Icon: Package, value: orders.length, money: false, href: "/account/orders" as const },
    { key: "spent", Icon: Wallet, value: spent, money: true, href: "/account/orders" as const },
    { key: "unpaid", Icon: Receipt, value: unpaidTotal, money: true, href: "/account/invoices" as const, alert: overdue > 0 },
  ];

  return (
    <div className="grid gap-5 lg:gap-6">
      <Reveal y={12}>
        <h1 className="h-display text-2xl text-navy-800 sm:text-[1.75rem]">
          {firstName ? t("overview.greeting", { name: firstName }) : t("overview.greetingNoName")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("overview.subtitle")}</p>
      </Reveal>

      {failed && <LoadError text={t("common.loadError")} />}

      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {stats.map(({ key, Icon, value, money, href, alert }, i) => (
          <Reveal key={key} delay={i * 0.06} y={16}>
            <Link
              href={href}
              className={cn(
                "card group relative block h-full overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-lift",
                alert && "ring-2 ring-danger/30",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold tracking-wider text-muted uppercase">{t(`overview.stats.${key}`)}</span>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-navy-50 text-navy-700 transition group-hover:bg-brand-400 group-hover:text-navy-900">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
              </div>
              <p className="h-display mt-3 text-[1.7rem] text-navy-800">
                <AnimatedNumber value={value} locale={locale} money={money} />
              </p>
              {key === "unpaid" && (
                <p className={cn("mt-1 text-xs font-semibold", overdue > 0 ? "text-danger" : "text-muted")}>
                  {overdue > 0
                    ? t("overview.stats.overdue", { count: overdue })
                    : t("overview.stats.openInvoices", { count: openInvoices.length })}
                </p>
              )}
            </Link>
          </Reveal>
        ))}
      </div>

      <div className="grid gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          title={t("overview.recentOrders")}
          action={
            orders.length > 0 && (
              <Link href="/account/orders" className="inline-flex items-center gap-1 text-[13px] font-bold text-navy-700 hover:underline">
                {t("overview.viewAll")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )
          }
          bodyClassName="py-2 sm:py-2"
        >
          {orders.length > 0 ? (
            <OrderList orders={orders.slice(0, 3)} locale={locale} />
          ) : (
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title={t("overview.noOrders")}
              text={t("overview.noOrdersText")}
              action={
                <Link href="/catalog" className={buttonClass("primary", "sm")}>
                  {t("overview.startShopping")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
          )}
        </Panel>

        <B2BStatusCard profile={profile} locale={locale} />
      </div>

      <Panel title={t("overview.quickLinks.title")}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {QUICK_LINKS.map(({ href, key, Icon }) => (
            <li key={key}>
              <Link
                href={href}
                className="group flex h-full items-center gap-3 rounded-xl border border-line bg-white p-3.5 text-sm font-semibold text-ink/80 transition hover:border-navy-200 hover:bg-navy-50/50 hover:text-navy-800"
              >
                <span className="grid h-9 w-9 shrink-0 -skew-x-6 place-items-center rounded-lg bg-canvas text-navy-600 transition group-hover:bg-brand-400 group-hover:text-navy-900">
                  <Icon className="h-4 w-4 skew-x-6" />
                </span>
                <span className="min-w-0">{t(`overview.quickLinks.${key}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
