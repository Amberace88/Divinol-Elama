import Link from "next/link";
import { Download, Plus, ShoppingBag } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtDateTime, fmtMoney } from "@/lib/admin/format";
import { labelOf, MARKET, MARKETS, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, SHIPPING_METHOD } from "@/lib/admin/labels";
import { PAGE_SIZE, spInt, withParams, type SP } from "@/lib/admin/params";
import { customerName, ORDER_LIST_SELECT, ordersQuery, parseOrderFilters, type OrderRow } from "@/lib/admin/queries";
import { errorMessage } from "@/lib/admin/server";
import { FilterBar } from "@/components/admin/FilterBar";
import { btn } from "@/components/admin/styles";
import { EmptyState, ErrorNote, PageHeader, Pagination, Pill, SortTh, TableWrap, td, th, trHover } from "@/components/admin/ui";

export const metadata = { title: "Pasūtījumi" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = await searchParams;
  const f = parseOrderFilters(params);
  const page = spInt(params, "page", 1);
  const { supabase } = await requireAdmin();

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await ordersQuery(supabase, f, ORDER_LIST_SELECT, true).range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as OrderRow[];
  const total = count ?? 0;

  const values = {
    q: f.q,
    status: f.status ?? "",
    pay: f.pay ?? "",
    market: f.market ?? "",
    from: f.from ?? "",
    to: f.to ?? "",
    sort: f.sort === "created" ? "" : f.sort,
    dir: f.dir === "desc" ? "" : f.dir,
  };
  const exportHref = `/api/admin/orders/export${withParams(params, { page: null })}`;
  const url = (o: Parameters<typeof withParams>[1]) => `/admin/orders${withParams(params, o)}`;
  const hasFilters = Boolean(f.q || f.status || f.pay || f.market || f.from || f.to);

  return (
    <>
      <PageHeader
        title="Pasūtījumi"
        description={`${total} ${total === 1 ? "pasūtījums" : "pasūtījumi"}${hasFilters ? " atbilst filtriem" : ""}`}
        actions={
          <>
            <a href={exportHref} className={btn("outline")} download>
              <Download className="h-4 w-4" /> Eksportēt CSV
            </a>
            <Link href="/admin/orders/new" className={btn("primary")}>
              <Plus className="h-4 w-4" /> Jauns pasūtījums
            </Link>
          </>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <FilterBar
          values={values}
          fields={[
            { type: "search", name: "q", placeholder: "Nr., e-pasts, tālrunis, klients…" },
            {
              type: "select",
              name: "status",
              label: "Visi statusi",
              options: [{ value: "open", label: "Atvērtie (jauni + procesā)" }, ...Object.entries(ORDER_STATUS).map(([value, v]) => ({ value, label: v.label }))],
            },
            { type: "select", name: "pay", label: "Apmaksa: visi", options: Object.entries(PAYMENT_STATUS).map(([value, v]) => ({ value, label: v.label })) },
            { type: "select", name: "market", label: "Visi tirgi", options: MARKETS.map((m) => ({ value: m, label: MARKET[m] })) },
            { type: "date", name: "from", label: "No" },
            { type: "date", name: "to", label: "Līdz" },
          ]}
        />

        {error ? (
          <div className="p-5">
            <ErrorNote message={errorMessage(error)} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={hasFilters ? "Nekas netika atrasts" : "Pasūtījumu vēl nav"}
            description={hasFilters ? "Mēģiniet mainīt vai notīrīt filtrus." : "Kad klienti noformēs pirmos pasūtījumus, tie parādīsies šeit. Pasūtījumu pa tālruni vai e-pastu var ievadīt ar „Jauns pasūtījums”."}
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <SortTh label="Nr." field="number" current={f.sort} dir={f.dir} href={(s, d) => url({ sort: s, dir: d, page: null })} />
                  <SortTh label="Datums" field="created" current={f.sort} dir={f.dir} href={(s, d) => url({ sort: s === "created" ? null : s, dir: d === "desc" ? null : d, page: null })} />
                  <th className={th}>Klients</th>
                  <th className={th}>Statuss</th>
                  <th className={th}>Apmaksa</th>
                  <th className={th}>Piegāde</th>
                  <SortTh label="Summa" field="total" current={f.sort} dir={f.dir} className="text-right" href={(s, d) => url({ sort: s, dir: d, page: null })} />
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const st = labelOf(ORDER_STATUS, o.status);
                  const pay = labelOf(PAYMENT_STATUS, o.payment_status);
                  return (
                    <tr key={o.id} className={`${trHover} relative`}>
                      <td className={td}>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-bold text-navy-700 after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-navy-300"
                        >
                          {o.number}
                        </Link>
                        {o.customer?.b2b && <span className="ml-1.5 rounded bg-navy-700 px-1 py-px text-[10px] font-bold text-brand-400">B2B</span>}
                        {o.source === "admin" && (
                          <span className="ml-1.5 rounded bg-brand-100 px-1 py-px text-[10px] font-bold text-navy-700 ring-1 ring-inset ring-brand-300" title="Izveidots administrācijā">
                            Adminā
                          </span>
                        )}
                      </td>
                      <td className={`${td} whitespace-nowrap text-muted`}>{fmtDateTime(o.created_at)}</td>
                      <td className={`${td} max-w-[240px]`}>
                        <p className="truncate font-semibold text-ink">{customerName(o.customer, o.email)}</p>
                        <p className="truncate text-[12px] text-muted">
                          {o.email} · {o.market}
                        </p>
                      </td>
                      <td className={td}>
                        <Pill tone={st.tone}>{st.label}</Pill>
                      </td>
                      <td className={td}>
                        <Pill tone={pay.tone} dot={false}>
                          {pay.label}
                        </Pill>
                        <p className="mt-0.5 text-[11px] text-muted">{PAYMENT_METHOD[o.payment_method] ?? o.payment_method}</p>
                      </td>
                      <td className={`${td} text-muted`}>
                        {SHIPPING_METHOD[o.shipping_method] ?? o.shipping_method}
                        {o.tracking_code && <p className="font-mono text-[11px] text-ink">{o.tracking_code}</p>}
                      </td>
                      <td className={`${td} text-right font-bold tabular-nums text-ink`}>{fmtMoney(o.total_gross)}</td>
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
