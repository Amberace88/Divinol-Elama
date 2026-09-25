import Link from "next/link";
import { Building2, Users } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtDate, fmtMoney, fmtNumber, fmtRelative } from "@/lib/admin/format";
import { B2B_STATUS, CUSTOMER_TYPE, labelOf, MARKET } from "@/lib/admin/labels";
import { PAGE_SIZE, sp, spEnum, spInt, withParams, type SP } from "@/lib/admin/params";
import { errorMessage, sanitizeSearch } from "@/lib/admin/server";
import { B2BDecision } from "@/components/admin/customers/B2BDecision";
import { FilterBar } from "@/components/admin/FilterBar";
import { EmptyState, ErrorNote, PageHeader, Pagination, Pill, TableWrap, td, th, trHover } from "@/components/admin/ui";

export const metadata = { title: "Klienti" };

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  reg_no: string | null;
  vat_no: string | null;
  customer_type: string;
  b2b_status: string;
  discount_percent: number;
  payment_terms_days: number;
  market: string;
  role: string;
  created_at: string;
};

const SELECT = "id, email, full_name, phone, company_name, reg_no, vat_no, customer_type, b2b_status, discount_percent, payment_terms_days, market, role, created_at";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = await searchParams;
  const q = sanitizeSearch(sp(params, "q"));
  const b2b = spEnum(params, "b2b", Object.keys(B2B_STATUS), null);
  const type = spEnum(params, "type", Object.keys(CUSTOMER_TYPE), null);
  const role = spEnum(params, "role", ["admin", "customer"] as const, null);
  const page = spInt(params, "page", 1);
  const { supabase } = await requireAdmin();

  let query = supabase.from("profiles").select(SELECT, { count: "exact" });
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%,reg_no.ilike.%${q}%,vat_no.ilike.%${q}%,phone.ilike.%${q}%`);
  if (b2b) query = query.eq("b2b_status", b2b);
  if (type) query = query.eq("customer_type", type);
  if (role) query = query.eq("role", role);
  const from = (page - 1) * PAGE_SIZE;
  const showPending = !b2b && !q && page === 1;

  const [listRes, pendingRes] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1),
    showPending
      ? supabase.from("profiles").select(SELECT).eq("b2b_status", "pending").order("created_at", { ascending: true }).limit(20)
      : Promise.resolve({ data: [] as Profile[] }),
  ]);
  const rows = (listRes.data ?? []) as Profile[];
  const pending = (pendingRes.data ?? []) as Profile[];
  const total = listRes.count ?? 0;

  // Orders count + total spent for the visible customers.
  const ids = [...new Set([...rows, ...pending].map((r) => r.id))];
  const stats = new Map<string, { count: number; spent: number }>();
  if (ids.length) {
    const { data } = await supabase.from("orders").select("user_id, total_gross, status").in("user_id", ids).limit(5000);
    for (const o of (data ?? []) as { user_id: string; total_gross: number; status: string }[]) {
      if (o.status === "cancelled") continue;
      const s = stats.get(o.user_id) ?? { count: 0, spent: 0 };
      s.count += 1;
      s.spent += Number(o.total_gross) || 0;
      stats.set(o.user_id, s);
    }
  }
  const hasFilters = Boolean(q || b2b || type || role);

  return (
    <>
      <PageHeader title="Klienti" description={`${total} ${hasFilters ? "atbilst filtriem" : "reģistrēti klienti"}`} />

      {pending.length > 0 && (
        <section className="mb-6 overflow-hidden rounded-2xl border border-brand-300 bg-white shadow-card">
          <header className="flex items-center gap-3 border-b border-brand-200 bg-brand-50 px-5 py-3.5">
            <span className="grid h-8 w-8 -skew-x-6 place-items-center rounded-lg bg-brand-400 text-navy-900">
              <Building2 className="h-4 w-4 skew-x-6" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-ink">B2B pieteikumi gaida apstiprinājumu ({pending.length})</h2>
              <p className="text-[12px] text-muted">Pārbaudiet uzņēmuma datus un piešķiriet atlaidi un apmaksas termiņu.</p>
            </div>
          </header>
          <ul className="divide-y divide-line/70">
            {pending.map((c) => (
              <li key={c.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/customers/${c.id}`} className="font-bold text-ink hover:text-navy-600 hover:underline">
                    {c.company_name || c.full_name || c.email}
                  </Link>
                  <p className="truncate text-[12px] text-muted">
                    {[c.full_name, c.email, c.reg_no && `Reģ. ${c.reg_no}`, c.vat_no && `PVN ${c.vat_no}`, MARKET[c.market]].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="text-[12px] text-muted">{fmtRelative(c.created_at)}</span>
                <B2BDecision customerId={c.id} name={c.company_name || c.full_name || c.email} discount={Number(c.discount_percent)} terms={c.payment_terms_days} compact />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <FilterBar
          values={{ q, b2b: b2b ?? "", type: type ?? "", role: role ?? "" }}
          fields={[
            { type: "search", name: "q", placeholder: "Vārds, e-pasts, uzņēmums, reģ. nr…" },
            {
              type: "select",
              name: "b2b",
              label: "B2B: visi",
              options: Object.entries(B2B_STATUS).map(([value, v]) => ({ value, label: value === "none" ? "Nav B2B" : v.label })),
            },
            { type: "select", name: "type", label: "Visi tipi", options: Object.entries(CUSTOMER_TYPE).map(([value, label]) => ({ value, label })) },
            {
              type: "select",
              name: "role",
              label: "Visas lomas",
              options: [
                { value: "customer", label: "Klienti" },
                { value: "admin", label: "Administratori" },
              ],
            },
          ]}
        />
        {listRes.error ? (
          <div className="p-5">
            <ErrorNote message={errorMessage(listRes.error)} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title={hasFilters ? "Nekas netika atrasts" : "Klientu vēl nav"} description={hasFilters ? "Mēģiniet mainīt filtrus." : "Reģistrētie klienti parādīsies šeit."} />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <th className={th}>Klients</th>
                  <th className={th}>Uzņēmums</th>
                  <th className={th}>B2B</th>
                  <th className={`${th} text-right`}>Atlaide</th>
                  <th className={`${th} text-right`}>Pasūtījumi</th>
                  <th className={`${th} text-right`}>Iztērēts</th>
                  <th className={th}>Reģistrēts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const b = labelOf(B2B_STATUS, c.b2b_status);
                  const s = stats.get(c.id);
                  return (
                    <tr key={c.id} className={`${trHover} relative`}>
                      <td className={`${td} max-w-[260px]`}>
                        <Link
                          href={`/admin/customers/${c.id}`}
                          className="font-bold text-ink after:absolute after:inset-0 after:content-[''] hover:text-navy-600 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-navy-300"
                        >
                          {c.full_name || c.email}
                        </Link>
                        {c.role === "admin" && <span className="ml-1.5 rounded bg-navy-700 px-1 py-px text-[10px] font-bold text-brand-400">ADMIN</span>}
                        <p className="truncate text-[12px] text-muted">
                          {c.email} · {c.market}
                        </p>
                      </td>
                      <td className={`${td} max-w-[220px]`}>
                        {c.company_name ? (
                          <>
                            <p className="truncate font-semibold text-ink">{c.company_name}</p>
                            <p className="truncate text-[12px] text-muted">{c.vat_no || c.reg_no}</p>
                          </>
                        ) : (
                          <span className="text-muted">{CUSTOMER_TYPE[c.customer_type] ?? c.customer_type}</span>
                        )}
                      </td>
                      <td className={td}>{c.b2b_status === "none" ? <span className="text-muted">—</span> : <Pill tone={b.tone}>{b.label}</Pill>}</td>
                      <td className={`${td} text-right tabular-nums`}>{Number(c.discount_percent) ? `${fmtNumber(c.discount_percent, 2)}%` : "—"}</td>
                      <td className={`${td} text-right tabular-nums`}>{fmtNumber(s?.count ?? 0)}</td>
                      <td className={`${td} text-right font-bold tabular-nums`}>{fmtMoney(s?.spent ?? 0)}</td>
                      <td className={`${td} whitespace-nowrap text-muted`}>{fmtDate(c.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
            <Pagination page={page} total={total} pageSize={PAGE_SIZE} href={(p) => `/admin/customers${withParams(params, { page: p === 1 ? null : p })}`} />
          </>
        )}
      </div>
    </>
  );
}
