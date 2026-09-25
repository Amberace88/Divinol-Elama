import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/commerce";
import { formatDate, num } from "./format";
import { StatusPill } from "./ui";
import type { OrderRow } from "./types";

export type OrderListRow = OrderRow & { order_items?: { qty: number }[] | null };

export async function OrderList({ orders, locale }: { orders: OrderListRow[]; locale: string }) {
  const t = await getTranslations({ locale, namespace: "account" });
  return (
    <ul className="divide-y divide-line">
      {orders.map((o) => {
        const qty = (o.order_items ?? []).reduce((s, i) => s + num(i.qty), 0);
        return (
          <li key={o.id}>
            <Link
              href={{ pathname: "/account/orders/[id]", params: { id: o.id } }}
              className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3.5 transition hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-300 sm:gap-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="font-bold text-navy-800 tabular-nums">{o.number}</span>
                  <StatusPill status={o.status} label={t(`status.${o.status}`)} />
                  {o.payment_status === "paid" && o.status !== "cancelled" && (
                    <StatusPill status="paid" label={t("paymentStatus.paid")} className="max-sm:hidden" />
                  )}
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  {formatDate(o.created_at, locale)}
                  {qty > 0 && <> · {t("orders.items", { count: qty })}</>}
                </p>
              </div>
              <span className="text-right font-extrabold text-ink tabular-nums">{formatMoney(num(o.total_gross), locale)}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-navy-700" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
