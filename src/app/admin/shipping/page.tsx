import Link from "next/link";
import { Coins, PackageOpen, Route, Truck } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtMoney, fmtNumber } from "@/lib/admin/format";
import { sanitizeSearch } from "@/lib/admin/server";
import { sp, withParams, type SP } from "@/lib/admin/params";
import { KpiCard } from "@/components/admin/Kpi";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader, Panel, Segmented } from "@/components/admin/ui";
import { Calculator } from "@/components/admin/shipping/Calculator";
import { CarrierSettings } from "@/components/admin/shipping/CarrierSettings";
import { RatesEditor } from "@/components/admin/shipping/RatesEditor";
import { ShipmentsTable, type ShipmentListRow } from "@/components/admin/shipping/ShipmentsTable";
import { ToShipTable, type ToShipRow } from "@/components/admin/shipping/ToShipTable";
import { recommend } from "@/lib/shipping/compare";
import { allCapabilities } from "@/lib/shipping/registry";
import {
  carrierMap,
  compareForOrder,
  loadCarriers,
  loadRates,
  ORDER_SHIP_COLS,
  orderUnits,
  SHIPMENT_COLS,
  type OrderForShipping,
  type OrderItemLite,
  type ShipmentRow,
} from "@/lib/shipping/service";
import { SHIPMENT_STATUS_LABEL } from "@/lib/shipping/tracking";
import { SHIPMENT_STATUSES } from "@/lib/shipping/types";

export const metadata = { title: "Sūtījumi" };

const TABS = [
  { id: "to-ship", label: "Jānosūta" },
  { id: "shipments", label: "Sūtījumi" },
  { id: "calculator", label: "Cenu kalkulators" },
  { id: "rates", label: "Tarifi" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function ShippingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = await searchParams;
  const tab = (TABS.find((t) => t.id === sp(params, "tab"))?.id ?? "to-ship") as Tab;
  const { supabase } = await requireAdmin();

  const [carriers, rates] = await Promise.all([loadCarriers(supabase), loadRates(supabase)]);
  const caps = allCapabilities(carriers.map((c) => c.code));
  const carrierInfo = carriers.map((c) => ({ code: c.code, name: c.name, tracking_url_template: c.tracking_url_template, api: caps[c.code]?.api ?? false, tracking: caps[c.code]?.tracking ?? false }));
  const apiCarriers = carrierInfo.filter((c) => c.api && carriers.find((x) => x.code === c.code)?.enabled).map((c) => c.code);
  const activeRates = rates.filter((r) => r.active);

  // KPIs (this month)
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [{ data: monthRows }, { count: inTransit }] = await Promise.all([
    supabase.from("shipments").select("cost_net, customer_paid_net, status").gte("created_at", monthStart.toISOString()).neq("status", "cancelled"),
    supabase.from("shipments").select("id", { count: "exact", head: true }).in("status", ["created", "label_printed", "handed_over", "in_transit"]),
  ]);
  const month = (monthRows ?? []) as { cost_net: number | null; customer_paid_net: number | null }[];
  const monthCost = month.reduce((s, r) => s + Number(r.cost_net ?? 0), 0);
  const monthPaid = month.reduce((s, r) => s + Number(r.customer_paid_net ?? 0), 0);

  // "Jānosūta" is always computed (for the badge count)
  const includeUnpaid = sp(params, "unpaid") === "1";
  const toShip = await loadToShip(supabase, includeUnpaid, rates, carriers);

  const url = (o: Record<string, string | null>) => `/admin/shipping${withParams(params, o)}`;

  return (
    <>
      <PageHeader
        title="Sūtījumi"
        description="Pārvadātāju salīdzināšana, sūtījumu izveide, uzlīmes un izsekošana — Omniva, DPD, Venipak, SmartPosti, Unisend, Latvijas Pasts un kravas."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Jānosūta" value={fmtNumber(toShip.length)} icon={PackageOpen} accent={toShip.length > 0} hint="apmaksāti / apstiprināti bez sūtījuma" />
        <KpiCard label="Ceļā" value={fmtNumber(inTransit ?? 0)} icon={Route} hint="izveidoti, nav piegādāti" />
        <KpiCard label="Piegādes izmaksas" value={fmtMoney(monthCost)} icon={Truck} hint="šomēnes, bez PVN" />
        <KpiCard
          label="Klienti samaksāja"
          value={fmtMoney(monthPaid)}
          icon={Coins}
          hint={month.length ? `starpība ${monthPaid - monthCost >= 0 ? "+" : "−"}${fmtMoney(Math.abs(monthPaid - monthCost))}` : "šomēnes"}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented items={TABS.map((t) => ({ href: url({ tab: t.id === "to-ship" ? null : t.id, status: null, carrier: null, q: null, page: null }), label: t.id === "to-ship" && toShip.length ? `${t.label} (${toShip.length})` : t.label, active: tab === t.id }))} />
        {tab === "to-ship" && (
          <Link href={url({ unpaid: includeUnpaid ? null : "1" })} scroll={false} className="text-[12.5px] font-bold text-navy-600 hover:underline">
            {includeUnpaid ? "Rādīt tikai apmaksātos / apstiprinātos" : "Rādīt arī neapmaksātos jaunos"}
          </Link>
        )}
      </div>

      {tab === "to-ship" && (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <ToShipTable rows={toShip} apiCarriers={apiCarriers} />
        </div>
      )}

      {tab === "shipments" && <ShipmentsTab supabase={supabase} params={params} carriers={carriers} carrierInfo={carrierInfo} />}

      {tab === "calculator" && (
        <Panel title="Piegādes cenu salīdzinājums" description="Bez pasūtījuma: izvēlieties valsti, piegādes veidu un preces vai gatavas kastes." bodyClassName="p-0">
          <Calculator rates={activeRates} carriers={carrierMap(carriers)} apiCarriers={apiCarriers} />
        </Panel>
      )}

      {tab === "rates" && (
        <div className="space-y-6">
          <Panel title="Pārvadātāji" description="API atslēgas glabājas tikai Netlify vides mainīgajos — šeit redzams, vai tās ir iestatītas." bodyClassName="p-0">
            <CarrierSettings carriers={carriers} caps={caps} />
          </Panel>
          <Panel title="Tarifi" description="Izmaksas veikalam (bez PVN) par vienu paku izmēra/svara klasē. Salīdzinājums izmanto tikai aktīvos tarifus." bodyClassName="p-0">
            <RatesEditor rates={rates} carriers={carriers} />
          </Panel>
        </div>
      )}
    </>
  );
}

type Db = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

async function loadToShip(supabase: Db, includeUnpaid: boolean, rates: Awaited<ReturnType<typeof loadRates>>, carriers: Awaited<ReturnType<typeof loadCarriers>>): Promise<ToShipRow[]> {
  const { data: orders } = await supabase
    .from("orders")
    .select(ORDER_SHIP_COLS)
    .in("status", ["new", "confirmed", "processing"])
    .neq("shipping_method", "pickup")
    .order("created_at", { ascending: true })
    .limit(150);
  let list = (orders ?? []) as OrderForShipping[];
  if (!includeUnpaid) list = list.filter((o) => o.payment_status === "paid" || o.status !== "new" || o.payment_method === "invoice");
  if (list.length === 0) return [];
  const ids = list.map((o) => o.id);
  const [{ data: items }, { data: ships }] = await Promise.all([
    supabase.from("order_items").select("order_id, name, pack_label, qty").in("order_id", ids),
    supabase.from("shipments").select("order_id").in("order_id", ids).not("status", "in", "(cancelled,returned)"),
  ]);
  const shipped = new Set(((ships ?? []) as { order_id: string }[]).map((s) => s.order_id));
  const byOrder = new Map<string, OrderItemLite[]>();
  for (const it of (items ?? []) as OrderItemLite[]) byOrder.set(it.order_id!, [...(byOrder.get(it.order_id!) ?? []), it]);
  const active = rates.filter((r) => r.active);
  return list
    .filter((o) => !shipped.has(o.id))
    .map((o) => {
      const its = byOrder.get(o.id) ?? [];
      const options = compareForOrder(o, its, active, carriers);
      const units = orderUnits(its);
      return {
        id: o.id,
        number: o.number,
        created_at: o.created_at,
        customer: o.customer?.company_name || o.customer?.name || o.email,
        market: o.market,
        shipping_method: o.shipping_method,
        payment_status: o.payment_status,
        point: o.shipping_point?.name ? `${o.shipping_point.name}${o.shipping_point.city ? `, ${o.shipping_point.city}` : ""}` : o.shipping_address?.city ?? null,
        items: its.map((i) => `${i.qty}× ${i.name}${i.pack_label ? ` ${i.pack_label}` : ""}`).join(", "),
        weightKg: units.reduce((s, u) => s + u.weightKg, 0),
        customerPaidNet: Number(o.shipping_net),
        options,
        recommendedKey: recommend(options)?.key ?? null,
      };
    });
}

async function ShipmentsTab({
  supabase,
  params,
  carriers,
  carrierInfo,
}: {
  supabase: Db;
  params: SP;
  carriers: Awaited<ReturnType<typeof loadCarriers>>;
  carrierInfo: { code: string; name: string; tracking_url_template: string | null; api: boolean; tracking: boolean }[];
}) {
  const status = sp(params, "status");
  const carrier = sp(params, "carrier");
  const q = sanitizeSearch(sp(params, "q"));
  let query = supabase.from("shipments").select(`${SHIPMENT_COLS}, orders(number)`).order("created_at", { ascending: false }).limit(200);
  if (status === "open") query = query.in("status", ["draft", "created", "label_printed", "handed_over", "in_transit"]);
  else if ((SHIPMENT_STATUSES as readonly string[]).includes(status)) query = query.eq("status", status);
  if (carrier && carriers.some((c) => c.code === carrier)) query = query.eq("carrier", carrier);
  if (q) query = query.ilike("tracking_number", `%${q}%`);
  const { data } = await query;
  const rows: ShipmentListRow[] = ((data ?? []) as unknown as (ShipmentRow & { orders: { number: string } | null })[]).map(({ orders, ...s }) => ({ ...s, order_number: orders?.number ?? null }));

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <FilterBar
        values={{ tab: "shipments", q, status, carrier }}
        fields={[
          { type: "search", name: "q", placeholder: "Sūtījuma kods…" },
          { type: "select", name: "status", label: "Visi statusi", options: [{ value: "open", label: "Aktīvie (nav piegādāti)" }, ...SHIPMENT_STATUSES.map((s) => ({ value: s, label: SHIPMENT_STATUS_LABEL[s].label }))] },
          { type: "select", name: "carrier", label: "Visi pārvadātāji", options: carriers.map((c) => ({ value: c.code, label: c.name })) },
        ]}
      />
      <ShipmentsTable rows={rows} carriers={carrierInfo} filtered={Boolean(status || carrier || q)} />
    </div>
  );
}
