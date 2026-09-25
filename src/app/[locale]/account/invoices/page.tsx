import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlertTriangle, FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/commerce";
import { cn } from "@/lib/utils";
import { requireAccount } from "@/components/account/server";
import { formatDate, invoiceState, num, todayRiga } from "@/components/account/format";
import { EmptyState, InvoicePdfLink, LoadError, PageTitle, Panel, StatusPill } from "@/components/account/ui";
import { INVOICE_COLUMNS, type InvoiceRow } from "@/components/account/types";

export async function generateMetadata({ params }: PageProps<"/[locale]/account/invoices">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.meta" });
  return { title: t("invoices") };
}

export default async function InvoicesPage({ params }: PageProps<"/[locale]/account/invoices">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireAccount(locale, "/account/invoices");
  const t = await getTranslations({ locale, namespace: "account" });

  const [invRes, ordRes] = await Promise.all([
    supabase
      .from("invoices")
      .select(INVOICE_COLUMNS)
      .eq("user_id", user.id)
      .order("issued_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("orders").select("id, number").eq("user_id", user.id).limit(1000),
  ]);
  const invoices = (invRes.data ?? []) as InvoiceRow[];
  const orderNumbers = new Map(((ordRes.data ?? []) as { id: string; number: string }[]).map((o) => [o.id, o.number]));

  const today = todayRiga();
  const rows = invoices.map((inv) => ({ ...inv, state: invoiceState(inv, today) }));
  const open = rows.filter((r) => r.state === "unpaid" || r.state === "overdue");
  const overdue = rows.filter((r) => r.state === "overdue");
  const openTotal = open.reduce((s, r) => s + num(r.total_gross), 0);
  const typeLabel = (type: string) => (t.has(`invoices.type.${type}`) ? t(`invoices.type.${type}`) : type);

  return (
    <div>
      <PageTitle title={t("invoices.title")} subtitle={t("invoices.subtitle")} />

      {invRes.error && (
        <div className="mb-4">
          <LoadError text={t("common.loadError")} />
        </div>
      )}

      {open.length > 0 && (
        <div
          className={cn(
            "mb-4 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3.5 text-sm sm:px-5",
            overdue.length ? "bg-danger/8 text-danger ring-1 ring-danger/20" : "bg-brand-50 text-brand-700 ring-1 ring-brand-200",
          )}
          role="status"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-semibold">
            {t("invoices.summaryUnpaid", { count: open.length, amount: formatMoney(openTotal, locale) })}
            {overdue.length > 0 && <> · {t("invoices.summaryOverdue", { count: overdue.length })}</>}
          </span>
        </div>
      )}

      <Panel bodyClassName="p-0 sm:p-0">
        {rows.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title={t("invoices.empty")} text={t("invoices.emptyText")} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-canvas/70 text-[11px] font-bold tracking-wider text-muted uppercase">
                  <tr>
                    <th scope="col" className="px-5 py-3">{t("invoices.number")}</th>
                    <th scope="col" className="px-3 py-3">{t("invoices.date")}</th>
                    <th scope="col" className="px-3 py-3">{t("invoices.due")}</th>
                    <th scope="col" className="px-3 py-3">{t("invoices.status")}</th>
                    <th scope="col" className="px-3 py-3 text-right">{t("invoices.total")}</th>
                    <th scope="col" className="px-5 py-3 text-right"><span className="sr-only">{t("invoices.pdf")}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((inv) => {
                    const orderNo = inv.order_id ? orderNumbers.get(inv.order_id) : null;
                    return (
                      <tr key={inv.id} className={cn("transition hover:bg-canvas/60", inv.state === "overdue" && "bg-danger/[0.03]")}>
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-ink tabular-nums">{inv.number}</p>
                          <p className="mt-0.5 text-xs text-muted">
                            {typeLabel(inv.type)}
                            {orderNo && inv.order_id && (
                              <>
                                {" · "}
                                <Link
                                  href={{ pathname: "/account/orders/[id]", params: { id: inv.order_id } }}
                                  className="font-semibold text-navy-700 hover:underline"
                                >
                                  {orderNo}
                                </Link>
                              </>
                            )}
                          </p>
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-ink/80">{formatDate(inv.issued_at, locale)}</td>
                        <td className={cn("px-3 py-3.5 whitespace-nowrap", inv.state === "overdue" ? "font-bold text-danger" : "text-ink/80")}>
                          {inv.type === "credit_note" ? "—" : formatDate(inv.due_at, locale)}
                        </td>
                        <td className="px-3 py-3.5">
                          <StatusPill status={inv.state} label={t(`invoices.state.${inv.state}`)} />
                        </td>
                        <td className="px-3 py-3.5 text-right font-extrabold whitespace-nowrap tabular-nums">
                          {formatMoney(num(inv.total_gross), locale)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <InvoicePdfLink id={inv.id} number={inv.number} label={t("invoices.pdf")} compact />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-line md:hidden">
              {rows.map((inv) => (
                <li key={inv.id} className={cn("px-4 py-4", inv.state === "overdue" && "bg-danger/[0.03]")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-ink tabular-nums">{inv.number}</p>
                      <p className="mt-0.5 text-xs text-muted">{typeLabel(inv.type)}</p>
                    </div>
                    <p className="font-extrabold tabular-nums">{formatMoney(num(inv.total_gross), locale)}</p>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
                    <StatusPill status={inv.state} label={t(`invoices.state.${inv.state}`)} />
                    <span>{formatDate(inv.issued_at, locale)}</span>
                    {inv.type !== "credit_note" && inv.due_at && (
                      <span className={cn(inv.state === "overdue" && "font-bold text-danger")}>
                        {t("invoices.dueShort", { date: formatDate(inv.due_at, locale) })}
                      </span>
                    )}
                    <span className="ml-auto">
                      <InvoicePdfLink id={inv.id} number={inv.number} label={t("invoices.pdf")} compact />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
