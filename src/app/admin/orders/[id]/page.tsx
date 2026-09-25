import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, FileText, History, Mail, Package, Phone, Printer, Truck } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber, fmtRelative } from "@/lib/admin/format";
import { B2B_STATUS, INVOICE_STATUS, INVOICE_TYPE, labelOf, MARKET, ORDER_EVENT, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, SHIPPING_METHOD } from "@/lib/admin/labels";
import { UUID_RE } from "@/lib/admin/server";
import { AddressBlock } from "@/components/admin/Address";
import { CommentForm, InvoiceButtons, NotesForm, PaymentControl, StatusControl } from "@/components/admin/orders/OrderControls";
import { btn } from "@/components/admin/styles";
import { OrderShipping } from "@/components/admin/shipping/OrderShipping";
import { allCapabilities } from "@/lib/shipping/registry";
import { compareForOrder, loadCarriers, loadRates, SHIPMENT_COLS, type OrderForShipping, type ShipmentRow } from "@/lib/shipping/service";
import { Thumb } from "@/components/admin/Thumb";
import { EmptyState, KeyValue, PageHeader, Panel, Pill, td, th } from "@/components/admin/ui";

type Order = {
  id: string;
  number: string;
  user_id: string | null;
  email: string;
  phone: string | null;
  customer: Record<string, unknown> & { name?: string; company_name?: string; reg_no?: string; vat_no?: string; customer_type?: string; b2b?: boolean; discount_percent?: number };
  shipping_address: Record<string, unknown> | null;
  billing_address: Record<string, unknown> | null;
  market: string;
  locale: string;
  status: string;
  payment_method: string;
  payment_status: string;
  shipping_method: string;
  shipping_point: Record<string, unknown> | null;
  shipping_net: number;
  subtotal_net: number;
  discount_net: number;
  vat_rate: number;
  vat_amount: number;
  total_gross: number;
  reverse_charge: boolean;
  notes: string | null;
  admin_notes: string | null;
  tracking_code: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};
type Item = { id: string; product_id: string | null; sku: string | null; name: string; pack_label: string | null; image: string | null; qty: number; unit_price_net: number; line_net: number };
type Event = { id: string; type: string; message: string | null; created_at: string; profiles: { full_name: string | null; email: string } | null };
type Invoice = { id: string; number: string; type: string; status: string; issued_at: string; due_at: string | null; total_gross: number };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Pasūtījums ${id.slice(0, 8)}` };
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase } = await requireAdmin();

  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order) notFound();

  const [itemsRes, eventsRes, invoicesRes, profileRes, settingsRes] = await Promise.all([
    supabase.from("order_items").select("id, product_id, sku, name, pack_label, image, qty, unit_price_net, line_net").eq("order_id", id).order("name"),
    supabase.from("order_events").select("id, type, message, created_at, profiles(full_name, email)").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("invoices").select("id, number, type, status, issued_at, due_at, total_gross").eq("order_id", id).order("created_at", { ascending: false }),
    order.user_id
      ? supabase.from("profiles").select("id, full_name, b2b_status, discount_percent, payment_terms_days").eq("id", order.user_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("settings").select("value").eq("key", "invoice").maybeSingle(),
  ]);

  const items = (itemsRes.data ?? []) as Item[];
  const events = (eventsRes.data ?? []) as unknown as Event[];
  const invoices = (invoicesRes.data ?? []) as Invoice[];
  const profile = profileRes.data as { id: string; full_name: string | null; b2b_status: string; discount_percent: number; payment_terms_days: number } | null;
  const dueDefault = Number(profile?.payment_terms_days) || Number((settingsRes.data?.value as { due_days_default?: number } | null)?.due_days_default) || 14;

  const [shipmentsRes, carriers, rates] = await Promise.all([
    supabase.from("shipments").select(SHIPMENT_COLS).eq("order_id", id).order("created_at", { ascending: false }),
    loadCarriers(supabase),
    loadRates(supabase, { activeOnly: true }),
  ]);
  const shipments = (shipmentsRes.data ?? []) as ShipmentRow[];
  const caps = allCapabilities(carriers.map((c) => c.code));
  const carrierInfo = carriers.map((c) => ({ code: c.code, name: c.name, tracking_url_template: c.tracking_url_template, api: caps[c.code]?.api ?? false, tracking: caps[c.code]?.tracking ?? false }));
  const apiCarriers = carrierInfo.filter((c) => c.api).map((c) => c.code);
  const shipOptions = compareForOrder(order as unknown as OrderForShipping, items, rates, carriers);
  const carrierName = (code: string) => carriers.find((c) => c.code === code)?.name ?? code;
  const st = labelOf(ORDER_STATUS, order.status);
  const pay = labelOf(PAYMENT_STATUS, order.payment_status);
  const c = order.customer ?? {};
  const netTotal = Number(order.subtotal_net) + Number(order.shipping_net) - Number(order.discount_net);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orders", label: "Pasūtījumi" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {order.number}
            <Pill tone={st.tone}>{st.label}</Pill>
            <Pill tone={pay.tone} dot={false}>
              {pay.label}
            </Pill>
          </span>
        }
        description={`Izveidots ${fmtDateTime(order.created_at)} · ${MARKET[order.market] ?? order.market} · valoda ${order.locale.toUpperCase()}`}
        actions={
          <Link href={`/admin/orders/${order.id}/print`} className={btn("outline")} target="_blank">
            <Printer className="h-4 w-4" /> Pavadzīme drukai
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Panel title={`Preces (${fmtNumber(items.reduce((s, i) => s + i.qty, 0))} gab.)`} bodyClassName="p-0">
            {items.length === 0 ? (
              <EmptyState icon={Package} title="Pasūtījumā nav preču" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-separate border-spacing-0 text-[13px]">
                  <thead>
                    <tr>
                      <th className={th}>Prece</th>
                      <th className={`${th} text-right`}>Daudz.</th>
                      <th className={`${th} text-right`}>Cena bez PVN</th>
                      <th className={`${th} text-right`}>Summa bez PVN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td className={td}>
                          <div className="flex items-center gap-3">
                            <Thumb src={it.image} size={44} />
                            <div className="min-w-0">
                              {it.product_id ? (
                                <Link href={`/admin/products/${it.product_id}`} className="font-semibold text-ink hover:text-navy-600 hover:underline">
                                  {it.name}
                                </Link>
                              ) : (
                                <p className="font-semibold text-ink">{it.name}</p>
                              )}
                              <p className="text-[12px] text-muted">
                                {[it.pack_label, it.sku && `SKU ${it.sku}`].filter(Boolean).join(" · ") || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className={`${td} text-right font-semibold tabular-nums`}>{it.qty}</td>
                        <td className={`${td} text-right tabular-nums text-muted`}>{fmtMoney(it.unit_price_net)}</td>
                        <td className={`${td} text-right font-bold tabular-nums`}>{fmtMoney(it.line_net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end border-t border-line bg-slate-50/50 px-5 py-4">
              <dl className="w-full max-w-sm space-y-1.5 text-[13px]">
                <Row label="Preces bez PVN" value={fmtMoney(order.subtotal_net)} />
                {Number(order.discount_net) > 0 && <Row label="Atlaide" value={`−${fmtMoney(order.discount_net)}`} />}
                {c.discount_percent ? <Row label="Klienta atlaide (iekļauta cenās)" value={`${fmtNumber(c.discount_percent, 2)}%`} muted /> : null}
                <Row label={`Piegāde bez PVN (${SHIPPING_METHOD[order.shipping_method] ?? order.shipping_method})`} value={fmtMoney(order.shipping_net)} />
                <Row label="Kopā bez PVN" value={fmtMoney(netTotal)} strong />
                <Row label={`PVN ${fmtNumber(order.vat_rate, 2)}%`} value={fmtMoney(order.vat_amount)} />
                <div className="!mt-3 flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="text-[14px] font-bold text-ink">Kopā apmaksai</dt>
                  <dd className="text-[20px] font-extrabold tabular-nums text-ink">{fmtMoney(order.total_gross)}</dd>
                </div>
                {order.reverse_charge && (
                  <p className="!mt-3 rounded-lg bg-navy-50 px-3 py-2 text-[12px] font-semibold text-navy-700">
                    Reverse charge — PVN 0% (ES B2B piegāde, PVN maksā pircējs)
                  </p>
                )}
              </dl>
            </div>
          </Panel>

          <section className="relative overflow-hidden rounded-2xl border border-line bg-white shadow-card" id="piegade">
            <div className="absolute inset-x-0 top-0 h-1 bg-[repeating-linear-gradient(-45deg,var(--color-brand-400)_0_10px,var(--color-navy-700)_10px_20px)]" aria-hidden />
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line/80 px-5 py-4">
              <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink">
                <Truck className="h-4 w-4 text-navy-500" /> Piegāde
              </h2>
              <Link href="/admin/shipping" className="text-[12px] font-bold text-navy-600 hover:underline">
                Visi sūtījumi →
              </Link>
            </header>
            <div className="grid gap-4 border-b border-line/80 px-5 py-4 text-[13px] sm:grid-cols-3">
              <div>
                <p className="mb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Klienta izvēle</p>
                <p className="font-bold text-ink">{SHIPPING_METHOD[order.shipping_method] ?? order.shipping_method}</p>
                <p className="text-[12px] text-muted">
                  Klients samaksāja {fmtMoney(order.shipping_net)} bez PVN
                  {order.shipping_method === "freight" && " · kravas cenu saskaņo menedžeris"}
                </p>
              </div>
              {order.shipping_point && order.shipping_method !== "pickup" && (
                <div>
                  <p className="mb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">
                    Pakomāts{order.shipping_point.provider ? ` · ${carrierName(String(order.shipping_point.provider))}` : ""}
                  </p>
                  <AddressBlock value={order.shipping_point} />
                </div>
              )}
              {order.shipping_address && order.shipping_method !== "pickup" && (
                <div>
                  <p className="mb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Piegādes adrese</p>
                  <AddressBlock value={order.shipping_address} />
                </div>
              )}
            </div>
            <div className="p-5">
              <OrderShipping
                orderId={order.id}
                shipments={shipments}
                carriers={carrierInfo}
                options={shipOptions}
                apiCarriers={apiCarriers}
                isPickup={order.shipping_method === "pickup"}
              />
            </div>
          </section>

          <Panel title="Vēsture" description="Statusu maiņas, apmaksas, rēķini un komentāri" actions={<History className="h-4 w-4 text-muted" />}>
            <CommentForm orderId={order.id} />
            {events.length === 0 ? (
              <p className="mt-4 text-[13px] text-muted">Notikumu vēl nav.</p>
            ) : (
              <ol className="relative mt-5 space-y-4 border-l-2 border-line pl-5">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 -skew-x-12 rounded-[3px] bg-brand-400 ring-4 ring-white" aria-hidden />
                    <p className="text-[13px] font-semibold text-ink">
                      {ORDER_EVENT[e.type] ?? e.type}
                      {e.message && e.message !== ORDER_EVENT[e.type] && <span className="font-normal text-ink/80"> — {e.message}</span>}
                    </p>
                    <p className="text-[12px] text-muted">
                      <time dateTime={e.created_at} title={fmtDateTime(e.created_at)}>
                        {fmtRelative(e.created_at)}
                      </time>
                      {e.profiles && ` · ${e.profiles.full_name || e.profiles.email}`}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Statuss">
            <StatusControl key={order.status} orderId={order.id} status={order.status} />
            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Apmaksa</p>
              <KeyValue
                className="mb-3"
                items={[
                  ["Veids", PAYMENT_METHOD[order.payment_method] ?? order.payment_method],
                  ["Apmaksāts", order.paid_at ? fmtDateTime(order.paid_at) : "—"],
                ]}
              />
              <PaymentControl orderId={order.id} paymentStatus={order.payment_status} />
            </div>
          </Panel>

          <Panel
            title="Klients"
            actions={
              order.user_id ? (
                <Link href={`/admin/customers/${order.user_id}`} className="text-[12px] font-bold text-navy-600 hover:underline">
                  Profils →
                </Link>
              ) : (
                <span className="text-[12px] text-muted">Viesis</span>
              )
            }
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-navy-50 text-navy-600">
                {c.company_name ? <Building2 className="h-5 w-5" /> : <span className="text-[13px] font-extrabold">{(c.name || order.email)[0]?.toUpperCase()}</span>}
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold text-ink">{c.company_name || c.name || "—"}</p>
                {c.company_name && c.name && <p className="truncate text-[12px] text-muted">{c.name}</p>}
              </div>
              {c.b2b && <Pill tone="navy">B2B</Pill>}
            </div>
            <div className="mb-4 flex flex-col gap-1.5 text-[13px]">
              <a href={`mailto:${order.email}`} className="flex items-center gap-2 text-navy-600 hover:underline">
                <Mail className="h-3.5 w-3.5" /> {order.email}
              </a>
              {order.phone && (
                <a href={`tel:${order.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-navy-600 hover:underline">
                  <Phone className="h-3.5 w-3.5" /> {order.phone}
                </a>
              )}
            </div>
            <KeyValue
              items={[
                ["Klienta tips", c.customer_type === "business" ? "Uzņēmums" : "Privātpersona"],
                ...(c.reg_no ? ([["Reģ. nr.", c.reg_no]] as [string, string][]) : []),
                ...(c.vat_no ? ([["PVN nr.", c.vat_no]] as [string, string][]) : []),
                ...(profile ? ([["B2B statuss", labelOf(B2B_STATUS, profile.b2b_status).label]] as [string, string][]) : []),
              ]}
            />
          </Panel>

          <Panel title="Adreses">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div>
                <p className="mb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Piegādes</p>
                <AddressBlock value={order.shipping_address} empty={order.shipping_method === "pickup" ? "Saņemšana noliktavā" : "—"} />
              </div>
              <div>
                <p className="mb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Rēķina</p>
                <AddressBlock value={order.billing_address} empty="Sakrīt ar piegādes adresi" />
              </div>
            </div>
          </Panel>

          <Panel title="Rēķini" actions={<FileText className="h-4 w-4 text-muted" />}>
            {invoices.length > 0 && (
              <ul className="mb-4 divide-y divide-line/70 rounded-xl border border-line">
                {invoices.map((inv) => {
                  const t = labelOf(INVOICE_TYPE, inv.type);
                  const s = labelOf(INVOICE_STATUS, inv.status);
                  return (
                    <li key={inv.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                      <div className="min-w-0 flex-1">
                        <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="font-bold text-navy-700 hover:underline">
                          {inv.number}
                        </a>
                        <p className="text-[12px] text-muted">
                          {t.label} · {fmtDate(inv.issued_at)}
                          {inv.due_at && ` · līdz ${fmtDate(inv.due_at)}`}
                        </p>
                      </div>
                      <Pill tone={s.tone} dot={false}>
                        {s.label}
                      </Pill>
                      <span className="font-semibold tabular-nums">{fmtMoney(inv.total_gross)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <InvoiceButtons orderId={order.id} defaultDueDays={dueDefault} />
          </Panel>

          {order.notes && (
            <Panel title="Klienta komentārs">
              <p className="whitespace-pre-wrap rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-ink">{order.notes}</p>
            </Panel>
          )}

          <Panel title="Iekšējās piezīmes">
            <NotesForm orderId={order.id} notes={order.admin_notes} />
          </Panel>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={muted ? "text-muted/80" : "text-muted"}>{label}</dt>
      <dd className={strong ? "font-bold tabular-nums text-ink" : "tabular-nums text-ink"}>{value}</dd>
    </div>
  );
}
