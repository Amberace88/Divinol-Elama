import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Euro,
  FileWarning,
  Inbox,
  PackageOpen,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  UserPlus,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { deltaPct, fmtMoney, fmtNumber, fmtRelative } from "@/lib/admin/format";
import { labelOf, MARKET, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/admin/labels";
import { sp, type SP } from "@/lib/admin/params";
import { customerName, ORDER_LIST_SELECT, type OrderRow } from "@/lib/admin/queries";
import { errorMessage } from "@/lib/admin/server";
import { MarketDonut, RevenueChart } from "@/components/admin/Charts";
import { ActionTile, KpiCard } from "@/components/admin/Kpi";
import { EmptyState, ErrorNote, PageHeader, Panel, Pill, Segmented, td, th, trHover } from "@/components/admin/ui";

export const metadata = { title: "Pārskats" };

const PERIODS = [
  { days: 7, label: "7 d." },
  { days: 30, label: "30 d." },
  { days: 90, label: "90 d." },
  { days: 365, label: "12 mēn." },
];

type Stats = {
  revenue: number;
  revenue_prev: number;
  orders: number;
  orders_prev: number;
  customers_new: number;
  b2b_pending: number;
  orders_open: number;
  unpaid_total: number;
  overdue: number;
  inquiries_new: number;
  series: { day: string; revenue: number; orders: number }[];
  top_products: { name: string; qty: number; revenue_net: number }[] | null;
  by_market: Record<string, number> | null;
  low_stock: { name: string | null; sku: string | null; stock: number }[] | null;
};

/** Same window as admin_stats(): today minus (days − 1), previous window of equal length before it. */
function periodBounds(days: number) {
  const dayMs = 86_400_000;
  const curStart = new Date(Date.now() - (days - 1) * dayMs);
  curStart.setUTCHours(0, 0, 0, 0);
  return { curStart, prevStart: new Date(curStart.getTime() - days * dayMs) };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = await searchParams;
  const days = PERIODS.find((p) => String(p.days) === sp(params, "days"))?.days ?? 30;
  const { supabase, profile } = await requireAdmin();

  const { curStart, prevStart } = periodBounds(days);

  const [statsRes, recentRes, custPrevRes] = await Promise.all([
    supabase.rpc("admin_stats", { p_days: days }),
    supabase.from("orders").select(ORDER_LIST_SELECT).order("created_at", { ascending: false }).limit(8),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", prevStart.toISOString())
      .lt("created_at", curStart.toISOString()),
  ]);

  const stats = (statsRes.data ?? null) as Stats | null;
  const recent = (recentRes.data ?? []) as unknown as OrderRow[];
  const n = (v: unknown) => Number(v ?? 0) || 0;

  const revenue = n(stats?.revenue);
  const revenuePrev = n(stats?.revenue_prev);
  const orders = n(stats?.orders);
  const ordersPrev = n(stats?.orders_prev);
  const aov = orders ? revenue / orders : 0;
  const aovPrev = ordersPrev ? revenuePrev / ordersPrev : 0;
  const custNew = n(stats?.customers_new);
  const custPrev = custPrevRes.count ?? 0;
  const series = stats?.series ?? [];
  const hasSales = series.some((s) => n(s.orders) > 0);
  const top = stats?.top_products ?? [];
  const low = stats?.low_stock ?? [];
  const periodLabel = PERIODS.find((p) => p.days === days)?.label ?? "";
  const hello = profile.full_name?.split(" ")[0];

  return (
    <>
      <PageHeader
        eyebrow="Pārskats"
        title={hello ? `Sveiki, ${hello}!` : "Pārskats"}
        description={`Veikala rādītāji par pēdējām ${days === 365 ? "12 mēnešiem" : `${days} dienām`} salīdzinājumā ar iepriekšējo periodu.`}
        actions={<Segmented items={PERIODS.map((p) => ({ href: `/admin?days=${p.days}`, label: p.label, active: p.days === days }))} />}
      />

      {statsRes.error && (
        <div className="mb-5">
          <ErrorNote message={errorMessage(statsRes.error)} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard accent label="Apgrozījums" value={fmtMoney(revenue)} delta={deltaPct(revenue, revenuePrev)} hint={`ar PVN · ${periodLabel}`} icon={Euro} />
        <KpiCard label="Pasūtījumi" value={fmtNumber(orders)} delta={deltaPct(orders, ordersPrev)} hint="vs iepr. periods" icon={ShoppingCart} />
        <KpiCard label="Vid. pasūtījums" value={fmtMoney(aov)} delta={deltaPct(aov, aovPrev)} hint="vs iepr. periods" icon={BarChart3} />
        <KpiCard label="Jauni klienti" value={fmtNumber(custNew)} delta={deltaPct(custNew, custPrev)} hint="reģistrācijas" icon={UserPlus} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ActionTile label="Atvērtie pasūtījumi" value={fmtNumber(stats?.orders_open)} href="/admin/orders?status=open" icon={ShoppingBag} tone={n(stats?.orders_open) ? "warn" : "default"} />
        <ActionTile label="Neapmaksātie rēķini" value={fmtMoney(stats?.unpaid_total)} href="/admin/invoices?status=issued" icon={Receipt} />
        <ActionTile label="Kavētie rēķini" value={fmtNumber(stats?.overdue)} href="/admin/invoices?overdue=1" icon={FileWarning} tone={n(stats?.overdue) ? "danger" : "default"} />
        <ActionTile label="B2B pieteikumi" value={fmtNumber(stats?.b2b_pending)} href="/admin/customers?b2b=pending" icon={Building2} tone={n(stats?.b2b_pending) ? "warn" : "default"} />
        <ActionTile label="Jauni pieprasījumi" value={fmtNumber(stats?.inquiries_new)} href="/admin/inquiries?status=new" icon={Inbox} tone={n(stats?.inquiries_new) ? "warn" : "default"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Apgrozījums un pasūtījumi"
          description="Apgrozījums ar PVN (līnija) un pasūtījumu skaits (stabiņi)"
        >
          {hasSales ? (
            <RevenueChart series={series} days={days} />
          ) : (
            <EmptyState icon={BarChart3} title="Šajā periodā pasūtījumu nav" description="Kad veikalā tiks veikti pasūtījumi, šeit redzēsiet apgrozījuma dinamiku." />
          )}
        </Panel>
        <Panel title="Pārdošana pa tirgiem" description={`Ar PVN · ${periodLabel}`}>
          <MarketDonut byMarket={stats?.by_market ?? {}} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Populārākie produkti" description="Pēc apgrozījuma bez PVN" bodyClassName="p-0">
          {top.length === 0 ? (
            <EmptyState icon={PackageOpen} title="Vēl nav datu" description="Populārākie produkti parādīsies pēc pirmajiem pasūtījumiem." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-[13px]">
                <thead>
                  <tr>
                    <th className={th}>#</th>
                    <th className={th}>Produkts</th>
                    <th className={`${th} text-right`}>Daudzums</th>
                    <th className={`${th} text-right`}>Apgrozījums</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((p, i) => {
                    const max = n(top[0]?.revenue_net) || 1;
                    return (
                      <tr key={p.name + i} className={trHover}>
                        <td className={`${td} w-10 font-bold text-muted`}>{i + 1}</td>
                        <td className={td}>
                          <p className="font-semibold text-ink">{p.name}</p>
                          <div className="mt-1.5 h-1.5 w-full max-w-[260px] overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full -skew-x-12 rounded-full bg-brand-400" style={{ width: `${Math.max(4, (n(p.revenue_net) / max) * 100)}%` }} />
                          </div>
                        </td>
                        <td className={`${td} text-right tabular-nums`}>{fmtNumber(p.qty)}</td>
                        <td className={`${td} text-right font-bold tabular-nums`}>{fmtMoney(p.revenue_net)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel
          title="Zems atlikums"
          description="Aktīvi varianti ar atlikumu ≤ 3"
          bodyClassName="p-0"
          actions={
            <Link href="/admin/products" className="text-[12px] font-bold text-navy-600 hover:underline">
              Produkti →
            </Link>
          }
        >
          {low.length === 0 ? (
            <EmptyState icon={PackageOpen} title="Viss kārtībā" description="Nav variantu ar zemu atlikumu (vai atlikums netiek uzskaitīts)." />
          ) : (
            <ul className="divide-y divide-line/70">
              {low.map((v, i) => (
                <li key={(v.sku ?? "") + i} className="flex items-center gap-3 px-5 py-3 text-[13px]">
                  <AlertTriangle className={v.stock <= 0 ? "h-4 w-4 text-red-500" : "h-4 w-4 text-brand-600"} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{v.name ?? "—"}</p>
                    <p className="font-mono text-[11px] text-muted">{v.sku ?? "bez SKU"}</p>
                  </div>
                  <Pill tone={v.stock <= 0 ? "red" : "yellow"}>{v.stock} gab.</Pill>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        className="mt-6"
        title="Jaunākie pasūtījumi"
        bodyClassName="p-0"
        actions={
          <Link href="/admin/orders" className="text-[12px] font-bold text-navy-600 hover:underline">
            Visi pasūtījumi →
          </Link>
        }
      >
        {recent.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="Pasūtījumu vēl nav" description="Jaunie pasūtījumi parādīsies šeit uzreiz pēc to noformēšanas." />
        ) : (
          <ul className="divide-y divide-line/70">
            {recent.map((o) => {
              const st = labelOf(ORDER_STATUS, o.status);
              const pay = labelOf(PAYMENT_STATUS, o.payment_status);
              return (
                <li key={o.id}>
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-[13px] transition hover:bg-navy-50/40 focus-visible:bg-navy-50 focus-visible:outline-none"
                  >
                    <span className="w-32 font-bold text-ink">{o.number}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {customerName(o.customer, o.email)}
                      <span className="ml-2 text-muted">{MARKET[o.market] ?? o.market}</span>
                    </span>
                    <span className="hidden text-muted sm:inline">{fmtRelative(o.created_at)}</span>
                    <Pill tone={st.tone}>{st.label}</Pill>
                    <Pill tone={pay.tone} dot={false} className="hidden md:inline-flex">
                      {pay.label}
                    </Pill>
                    <span className="w-24 text-right font-bold tabular-nums text-ink">{fmtMoney(o.total_gross)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
