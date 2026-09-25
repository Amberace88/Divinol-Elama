import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Package } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";
import { OrderList, type OrderListRow } from "@/components/account/OrderList";
import { requireAccount } from "@/components/account/server";
import { ORDER_STATUSES, isOrderStatus } from "@/components/account/format";
import { EmptyState, LoadError, PageTitle, Panel } from "@/components/account/ui";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/account/orders">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.meta" });
  return { title: t("orders") };
}

export default async function OrdersPage({ params, searchParams }: PageProps<"/[locale]/account/orders">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireAccount(locale, "/account/orders");
  const t = await getTranslations({ locale, namespace: "account" });
  const sp = await searchParams;
  const rawStatus = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const status = isOrderStatus(rawStatus) ? rawStatus : null;

  const { data, error } = await supabase
    .from("orders")
    .select("id, number, created_at, status, payment_status, payment_method, total_gross, order_items(qty)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);
  const all = (data ?? []) as OrderListRow[];
  const orders = status ? all.filter((o) => o.status === status) : all;

  const counts = all.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});
  const filters = [null, ...ORDER_STATUSES.filter((s) => counts[s])];

  return (
    <div>
      <PageTitle title={t("orders.title")} subtitle={t("orders.subtitle")} />

      {error && (
        <div className="mb-4">
          <LoadError text={t("common.loadError")} />
        </div>
      )}

      {all.length > 0 && (
        <nav aria-label={t("orders.filterLabel")} className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {filters.map((s) => {
            const active = s === status;
            return (
              <Link
                key={s ?? "all"}
                href={s ? { pathname: "/account/orders", query: { status: s } } : "/account/orders"}
                aria-current={active ? "true" : undefined}
                scroll={false}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-bold ring-1 transition",
                  active ? "bg-navy-700 text-white ring-navy-700" : "bg-white text-ink/75 ring-line hover:text-navy-700 hover:ring-navy-300",
                )}
              >
                {s ? t(`status.${s}`) : t("orders.filterAll")}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] tabular-nums",
                    active ? "bg-white/15 text-white" : "bg-canvas text-muted",
                  )}
                >
                  {s ? counts[s] : all.length}
                </span>
              </Link>
            );
          })}
        </nav>
      )}

      <Panel bodyClassName="py-2 sm:py-2">
        {orders.length > 0 ? (
          <OrderList orders={orders} locale={locale} />
        ) : (
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title={status ? t("orders.emptyFiltered") : t("orders.empty")}
            text={status ? undefined : t("orders.emptyText")}
            action={
              status ? (
                <Link href="/account/orders" className={buttonClass("outline", "sm")}>
                  {t("orders.filterAll")}
                </Link>
              ) : (
                <Link href="/catalog" className={buttonClass("primary", "sm")}>
                  {t("overview.startShopping")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )
            }
          />
        )}
      </Panel>
    </div>
  );
}
