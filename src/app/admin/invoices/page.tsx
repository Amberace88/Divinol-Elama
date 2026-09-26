import Link from "next/link";
import { AlarmClock, CheckCircle2, Download, FileClock, Plus, ReceiptText, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtDate, fmtMoney, fmtNumber, todayRiga } from "@/lib/admin/format";
import { INVOICE_STATUS, INVOICE_TYPE, labelOf } from "@/lib/admin/labels";
import { PAGE_SIZE, spEnum, spInt, withParams, type SP } from "@/lib/admin/params";
import { invoicesQuery, parseInvoiceFilters, rigaDayStart } from "@/lib/admin/queries";
import { errorMessage } from "@/lib/admin/server";
import { FilterBar } from "@/components/admin/FilterBar";
import { btn } from "@/components/admin/styles";
import { InvoiceActions } from "@/components/admin/invoices/InvoiceActions";
import { EmptyState, ErrorNote, PageHeader, Pagination, Pill, SortTh, TableWrap, td, th, trHover } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Rēķini" };

type InvoiceRow = {
  id: string;
  number: string;
  type: string;
  status: string;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  buyer: { name?: string; company_name?: string; email?: string; vat_no?: string } | null;
  subtotal_net: number;
  vat_amount: number;
  total_gross: number;
  reverse_charge: boolean;
  order_id: string | null;
  orders: { number: string } | null;
};

const SORTS = { issued: "issued_at", due: "due_at", total: "total_gross", number: "number" } as const;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = await searchParams;
  const f = parseInvoiceFilters(params);
  const { type, status, overdue, from, to, q } = f;
  const sort = spEnum(params, "sort", Object.keys(SORTS) as (keyof typeof SORTS)[], "issued");
  const dir = spEnum(params, "dir", ["asc", "desc"] as const, "desc");
  const page = spInt(params, "page", 1);
  const today = todayRiga();
  const monthStart = `${today.slice(0, 8)}01`;

  const { supabase } = await requireAdmin();

  let query = invoicesQuery(
    supabase,
    f,
    "id, number, type, status, issued_at, due_at, paid_at, buyer, subtotal_net, vat_amount, total_gross, reverse_charge, order_id, orders(number)",
    today,
    true,
  );
  query = query.order(SORTS[sort], { ascending: dir === "asc", nullsFirst: false }).order("number", { ascending: false });
  const start = (page - 1) * PAGE_SIZE;

  const [listRes, openRes, paidRes] = await Promise.all([
    query.range(start, start + PAGE_SIZE - 1),
    supabase.from("invoices").select("type, total_gross, due_at").eq("status", "issued").limit(5000),
    supabase.from("invoices").select("type, total_gross").eq("status", "paid").gte("paid_at", rigaDayStart(monthStart)).limit(5000),
  ]);

  const rows = (listRes.data ?? []) as unknown as InvoiceRow[];
  const total = listRes.count ?? 0;
  const open = (openRes.data ?? []) as { type: string; total_gross: number; due_at: string | null }[];
  const sum = (arr: { total_gross: number }[]) => arr.reduce((s, r) => s + Number(r.total_gross || 0), 0);
  const unpaid = open.filter((r) => r.type === "invoice");
  const overdueRows = unpaid.filter((r) => r.due_at && r.due_at < today);
  const proformas = open.filter((r) => r.type === "proforma");
  const paidMonth = ((paidRes.data ?? []) as { type: string; total_gross: number }[]).filter((r) => r.type !== "credit_note");

  const url = (o: Parameters<typeof withParams>[1]) => `/admin/invoices${withParams(params, o)}`;
  const hasFilters = Boolean(type || status || overdue || from || to || q);

  const cards = [
    { label: "Neapmaksātie rēķini", value: fmtMoney(sum(unpaid)), hint: `${unpaid.length} rēķini`, icon: Wallet, href: "/admin/invoices?status=issued&type=invoice", tone: "navy" },
    { label: "Kavētie", value: fmtMoney(sum(overdueRows)), hint: `${overdueRows.length} rēķini`, icon: AlarmClock, href: "/admin/invoices?overdue=1", tone: overdueRows.length ? "red" : "navy" },
    { label: "Avansa rēķini gaida", value: fmtMoney(sum(proformas)), hint: `${proformas.length} rēķini`, icon: FileClock, href: "/admin/invoices?status=issued&type=proforma", tone: "navy" },
    { label: "Apmaksāts šomēnes", value: fmtMoney(sum(paidMonth)), hint: `${paidMonth.length} rēķini`, icon: CheckCircle2, href: "/admin/invoices?status=paid", tone: "green" },
  ] as const;

  return (
    <>
      <PageHeader
        title="Rēķini"
        description="Avansa rēķini veidojas automātiski no e-veikala pasūtījumiem; rēķinu pēc apmaksas izraksta automātiski. Jaunu rēķinu vari izveidot arī manuāli."
        actions={
          <>
            <a
              href={`/api/admin/invoices/export${withParams(params, { page: null, sort: null, dir: null })}`}
              className={btn("outline")}
              download
              title="CSV grāmatvedībai — pēc izvēlētajiem filtriem un perioda (No / Līdz)"
            >
              <Download className="h-4 w-4" /> CSV grāmatvedim
            </a>
            <Link href="/admin/orders/new?from=invoices" className={btn("primary")}>
              <Plus className="h-4 w-4" /> Jauns rēķins
            </Link>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={cn(
              "group rounded-2xl border bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift",
              c.tone === "red" ? "border-red-200" : "border-line",
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">{c.label}</p>
              <c.icon className={cn("h-4 w-4", c.tone === "red" ? "text-red-500" : c.tone === "green" ? "text-emerald-600" : "text-navy-500")} aria-hidden />
            </div>
            <p className={cn("mt-2 text-[20px] font-extrabold tabular-nums sm:text-[22px]", c.tone === "red" ? "text-red-600" : "text-ink")}>{c.value}</p>
            <p className="text-[12px] text-muted">{c.hint}</p>
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <FilterBar
          values={{ q, type: type ?? "", status: status ?? "", overdue: overdue ? "1" : "", from: from ?? "", to: to ?? "", sort: sort === "issued" ? "" : sort, dir: dir === "desc" ? "" : dir }}
          fields={[
            { type: "search", name: "q", placeholder: "Numurs, pircējs, e-pasts…" },
            { type: "select", name: "type", label: "Visi veidi", options: Object.entries(INVOICE_TYPE).map(([value, v]) => ({ value, label: v.label })) },
            { type: "select", name: "status", label: "Visi statusi", options: Object.entries(INVOICE_STATUS).map(([value, v]) => ({ value, label: v.label })) },
            { type: "select", name: "overdue", label: "Termiņš: visi", options: [{ value: "1", label: "Tikai kavētie" }] },
            { type: "date", name: "from", label: "No" },
            { type: "date", name: "to", label: "Līdz" },
          ]}
        />
        {listRes.error ? (
          <div className="p-5">
            <ErrorNote message={errorMessage(listRes.error)} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={hasFilters ? "Nekas netika atrasts" : "Rēķinu vēl nav"}
            description={hasFilters ? "Mēģiniet mainīt filtrus." : "Rēķini tiek izveidoti automātiski (bankas pārskaitījums / B2B), manuāli pasūtījuma kartītē vai ar „Jauns rēķins”."}
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <SortTh label="Numurs" field="number" current={sort} dir={dir} href={(s, d) => url({ sort: s, dir: d, page: null })} />
                  <th className={th}>Veids</th>
                  <th className={th}>Pircējs</th>
                  <SortTh label="Izrakstīts" field="issued" current={sort} dir={dir} href={(s, d) => url({ sort: s === "issued" ? null : s, dir: d === "desc" ? null : d, page: null })} />
                  <SortTh label="Termiņš" field="due" current={sort} dir={dir} href={(s, d) => url({ sort: s, dir: d, page: null })} />
                  <th className={th}>Statuss</th>
                  <SortTh label="Summa" field="total" current={sort} dir={dir} className="text-right" href={(s, d) => url({ sort: s, dir: d, page: null })} />
                  <th className={`${th} text-right`}>
                    <span className="sr-only">Darbības</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => {
                  const t = labelOf(INVOICE_TYPE, inv.type);
                  const s = labelOf(INVOICE_STATUS, inv.status);
                  const isOverdue = inv.status === "issued" && inv.type !== "credit_note" && inv.due_at != null && inv.due_at < today;
                  const daysLate = isOverdue && inv.due_at ? Math.round((Date.parse(today) - Date.parse(inv.due_at)) / 86_400_000) : 0;
                  return (
                    <tr key={inv.id} className={cn(trHover, isOverdue && "bg-red-50/40")}>
                      <td className={td}>
                        <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="font-bold text-navy-700 hover:underline">
                          {inv.number}
                        </a>
                        {inv.order_id && inv.orders && (
                          <Link href={`/admin/orders/${inv.order_id}`} className="block text-[12px] text-muted hover:text-navy-600 hover:underline">
                            {inv.orders.number}
                          </Link>
                        )}
                      </td>
                      <td className={td}>
                        <Pill tone={t.tone} dot={false}>
                          {t.label}
                        </Pill>
                      </td>
                      <td className={`${td} max-w-[220px]`}>
                        <p className="truncate font-semibold text-ink">{inv.buyer?.company_name || inv.buyer?.name || "—"}</p>
                        <p className="truncate text-[12px] text-muted">
                          {inv.buyer?.email}
                          {inv.reverse_charge && " · reverse charge"}
                        </p>
                      </td>
                      <td className={`${td} whitespace-nowrap text-muted`}>{fmtDate(inv.issued_at)}</td>
                      <td className={`${td} whitespace-nowrap`}>
                        <span className={isOverdue ? "font-bold text-red-600" : "text-muted"}>{fmtDate(inv.due_at)}</span>
                        {isOverdue && <p className="text-[11px] font-semibold text-red-600">kavēts {fmtNumber(daysLate)} d.</p>}
                        {inv.status === "paid" && inv.paid_at && <p className="text-[11px] text-emerald-700">apm. {fmtDate(inv.paid_at)}</p>}
                      </td>
                      <td className={td}>
                        <Pill tone={isOverdue ? "red" : s.tone}>{isOverdue ? "Kavēts" : s.label}</Pill>
                      </td>
                      <td className={`${td} text-right`}>
                        <p className={cn("font-bold tabular-nums", inv.status === "void" ? "text-muted line-through" : "text-ink")}>{fmtMoney(inv.total_gross)}</p>
                        <p className="text-[11px] tabular-nums text-muted">PVN {fmtMoney(inv.vat_amount)}</p>
                      </td>
                      <td className={td}>
                        <InvoiceActions id={inv.id} number={inv.number} status={inv.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
            <Pagination page={page} total={total} pageSize={PAGE_SIZE} href={(p) => url({ page: p === 1 ? null : p })} />
          </>
        )}
      </div>
    </>
  );
}
