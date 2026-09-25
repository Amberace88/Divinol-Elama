import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, FileText, MapPin, Package, PackageSearch, Truck, Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";
import { formatMoney, packLabel, round2, variantKey } from "@/lib/commerce";
import { requireAccount } from "@/components/account/server";
import { UUID_RE, formatDate, invoiceState, num } from "@/components/account/format";
import { OrderEvents, OrderProgress, type OrderEvent } from "@/components/account/OrderProgress";
import { ReorderButton, type ReorderLine } from "@/components/account/ReorderButton";
import { EmptyState, InvoicePdfLink, LoadError, Panel, StatusPill } from "@/components/account/ui";
import { INVOICE_COLUMNS, type InvoiceRow } from "@/components/account/types";

type Json = Record<string, unknown> | null;

type OrderDetail = {
  id: string;
  number: string;
  created_at: string;
  status: string;
  payment_method: string;
  payment_status: string;
  shipping_method: string;
  shipping_point: Json;
  shipping_address: Json;
  billing_address: Json;
  customer: Json;
  email: string;
  phone: string | null;
  shipping_net: number | string;
  subtotal_net: number | string;
  discount_net: number | string;
  vat_rate: number | string;
  vat_amount: number | string;
  total_gross: number | string;
  reverse_charge: boolean;
  notes: string | null;
  tracking_code: string | null;
  paid_at: string | null;
};

type ItemRow = {
  id: string;
  sku: string | null;
  name: string;
  pack_label: string | null;
  image: string | null;
  qty: number;
  unit_price_net: number | string;
  line_net: number | string;
  products: { slug: string; images: string[] | null } | null;
  product_variants: {
    sku: string | null;
    size: number | string | null;
    unit: string;
    price_net: number | string;
    image: string | null;
    in_stock: boolean;
  } | null;
};

const ORDER_COLUMNS =
  "id, number, created_at, status, payment_method, payment_status, shipping_method, shipping_point, shipping_address, billing_address, customer, email, phone, shipping_net, subtotal_net, discount_net, vat_rate, vat_amount, total_gross, reverse_charge, notes, tracking_code, paid_at";

const ITEM_COLUMNS =
  "id, sku, name, pack_label, image, qty, unit_price_net, line_net, products(slug, images), product_variants(sku, size, unit, price_net, image, in_stock)";

export async function generateMetadata({ params }: PageProps<"/[locale]/account/orders/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.meta" });
  return { title: t("order") };
}

function str(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Renders an address-like jsonb object as lines (tolerant to the exact shape written by checkout). */
function addressLines(a: Json, countryName: (c: string) => string): string[] {
  if (!a || typeof a !== "object") return [];
  const street = str(a.street) ?? str(a.address) ?? str(a.line1);
  const cityLine = [str(a.postal_code) ?? str(a.zip), str(a.city)].filter(Boolean).join(" ");
  const country = str(a.country);
  return [
    str(a.name),
    str(a.company),
    street,
    cityLine || null,
    country ? (["LV", "EE", "LT"].includes(country) ? countryName(country) : country) : null,
    str(a.phone),
  ].filter((x): x is string => Boolean(x));
}

export default async function OrderDetailPage({ params }: PageProps<"/[locale]/account/orders/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireAccount(locale, `/account/orders/${id}`);
  const t = await getTranslations({ locale, namespace: "account" });
  const tm = await getTranslations({ locale, namespace: "market" });

  const back = (
    <Link href="/account/orders" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-navy-700 hover:underline">
      <ArrowLeft className="h-4 w-4" />
      {t("order.back")}
    </Link>
  );

  const valid = UUID_RE.test(id);
  const orderRes = valid
    ? await supabase.from("orders").select(ORDER_COLUMNS).eq("id", id).eq("user_id", user.id).maybeSingle()
    : { data: null, error: null };
  const order = orderRes.data as OrderDetail | null;

  if (!order) {
    return (
      <div>
        {back}
        <Panel>
          {orderRes.error ? (
            <LoadError text={t("common.loadError")} />
          ) : (
            <EmptyState
              icon={<PackageSearch className="h-6 w-6" />}
              title={t("order.notFound")}
              text={t("order.notFoundText")}
              action={
                <Link href="/account/orders" className={buttonClass("outline", "sm")}>
                  {t("order.back")}
                </Link>
              }
            />
          )}
        </Panel>
      </div>
    );
  }

  const [itemsRes, eventsRes, invoicesRes] = await Promise.all([
    supabase.from("order_items").select(ITEM_COLUMNS).eq("order_id", order.id),
    supabase.from("order_events").select("id, type, message, created_at").eq("order_id", order.id).order("created_at", { ascending: true }),
    supabase.from("invoices").select(INVOICE_COLUMNS).eq("order_id", order.id).order("issued_at", { ascending: false }),
  ]);
  const items = (itemsRes.data ?? []) as unknown as ItemRow[];
  const events = (eventsRes.data ?? []) as OrderEvent[];
  const invoices = (invoicesRes.data ?? []) as InvoiceRow[];

  const vatRate = num(order.vat_rate);
  const b2b = Boolean(order.customer && order.customer.b2b === true) || order.reverse_charge;
  const unitShown = (net: number) => (b2b ? net : round2(net * (1 + vatRate / 100)));

  // Reorder: current catalogue variants (null when the product/variant is no longer sold).
  const reorder: ReorderLine[] = [];
  let unavailable = 0;
  for (const it of items) {
    const p = it.products;
    const v = it.product_variants;
    if (!p?.slug || !v) {
      unavailable++;
      continue;
    }
    const size = v.size == null ? null : Number(v.size);
    reorder.push({
      slug: p.slug,
      key: variantKey({ sku: v.sku, size, unit: v.unit }),
      sku: v.sku,
      name: it.name,
      pack: packLabel({ size, unit: v.unit }) || it.pack_label || "",
      image: v.image ?? p.images?.[0] ?? it.image ?? null,
      size,
      unit: v.unit,
      price_net: num(v.price_net),
      qty: Math.max(1, num(it.qty)),
    });
  }

  const shippingLines = addressLines(order.shipping_address, (c) => tm(c));
  const point = order.shipping_point;
  const pointLines = point ? [str(point.name), str(point.address), str(point.city)].filter((x): x is string => Boolean(x)) : [];
  const discount = num(order.discount_net);

  return (
    <div>
      {back}

      {/* Summary header */}
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="h-display text-2xl text-navy-800 tabular-nums sm:text-[1.75rem]">{t("order.title", { number: order.number })}</h1>
              <StatusPill status={order.status} label={t(`status.${order.status}`)} />
            </div>
            <p className="mt-1 text-sm text-muted">{t("order.placed", { date: formatDate(order.created_at, locale, { time: true, month: "long" }) })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ReorderButton lines={reorder} unavailable={unavailable} />
          </div>
        </div>
        <div className="mt-6">
          <OrderProgress status={order.status} locale={locale} />
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:mt-6 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 content-start gap-5 lg:gap-6">
          {/* Items */}
          <Panel title={t("order.items")} description={b2b ? t("order.pricesExVat") : t("order.pricesInclVat")} bodyClassName="p-0 sm:p-0">
            {itemsRes.error && (
              <div className="p-5">
                <LoadError text={t("common.loadError")} />
              </div>
            )}
            <ul className="divide-y divide-line">
              {items.map((it) => {
                const unit = unitShown(num(it.unit_price_net));
                const line = b2b ? num(it.line_net) : round2(unit * num(it.qty));
                const img = it.image ?? it.product_variants?.image ?? it.products?.images?.[0] ?? null;
                const slug = it.products?.slug;
                return (
                  <li key={it.id} className="flex gap-4 px-5 py-4 sm:px-6">
                    <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-canvas ring-1 ring-line sm:h-20 sm:w-20">
                      {img ? (
                        <Image src={img} alt="" fill sizes="80px" unoptimized className="object-contain p-1.5" />
                      ) : (
                        <Package className="h-6 w-6 text-muted" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                        <div className="min-w-0">
                          {slug ? (
                            <Link
                              href={{ pathname: "/product/[slug]", params: { slug } }}
                              className="font-bold text-ink underline-offset-4 hover:text-navy-700 hover:underline"
                            >
                              {it.name}
                            </Link>
                          ) : (
                            <p className="font-bold text-ink">{it.name}</p>
                          )}
                          <p className="mt-0.5 text-[13px] text-muted">
                            {[it.pack_label, it.sku && `${t("order.sku")} ${it.sku}`].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <p className="font-extrabold text-ink tabular-nums">{formatMoney(line, locale)}</p>
                      </div>
                      <p className="mt-1.5 text-[13px] text-muted tabular-nums">
                        {num(it.qty)} × {formatMoney(unit, locale)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Totals */}
            <dl className="grid gap-2 border-t border-line bg-canvas/60 px-5 py-5 text-sm sm:px-6">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t("order.subtotal")}</dt>
                <dd className="font-semibold tabular-nums">{formatMoney(num(order.subtotal_net), locale)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{t("order.discount")}</dt>
                  <dd className="font-semibold text-success tabular-nums">−{formatMoney(discount, locale)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t("order.shippingCost")}</dt>
                <dd className="font-semibold tabular-nums">
                  {num(order.shipping_net) > 0 ? formatMoney(num(order.shipping_net), locale) : t("order.free")}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{order.reverse_charge ? t("order.vatReverse") : t("order.vat", { rate: vatRate })}</dt>
                <dd className="font-semibold tabular-nums">{formatMoney(num(order.vat_amount), locale)}</dd>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-3">
                <dt className="font-bold text-navy-800">{t("order.total")}</dt>
                <dd className="h-display text-xl text-navy-800 tabular-nums">{formatMoney(num(order.total_gross), locale)}</dd>
              </div>
              {order.reverse_charge && <p className="mt-1 text-xs leading-5 text-muted">{t("order.reverseChargeNote")}</p>}
            </dl>
          </Panel>

          {/* Timeline */}
          {events.length > 0 && (
            <Panel title={t("order.timeline")}>
              <OrderEvents events={events} locale={locale} />
            </Panel>
          )}
        </div>

        <div className="grid content-start gap-5 lg:gap-6">
          {/* Shipping */}
          <Panel title={<span className="inline-flex items-center gap-2"><Truck className="h-4 w-4 text-navy-500" />{t("order.shipping")}</span>}>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs font-bold tracking-wider text-muted uppercase">{t("order.shippingMethod")}</dt>
                <dd className="mt-0.5 font-semibold">{t.has(`shippingMethod.${order.shipping_method}`) ? t(`shippingMethod.${order.shipping_method}`) : order.shipping_method}</dd>
              </div>
              {pointLines.length > 0 && (
                <div>
                  <dt className="text-xs font-bold tracking-wider text-muted uppercase">{t("order.shippingPoint")}</dt>
                  <dd className="mt-0.5 leading-6">{pointLines.join(", ")}</dd>
                </div>
              )}
              {shippingLines.length > 0 && (
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted uppercase">
                    <MapPin className="h-3.5 w-3.5" />
                    {t("order.shippingAddress")}
                  </dt>
                  <dd className="mt-0.5 leading-6">
                    {shippingLines.map((l, i) => (
                      <span key={i} className="block">
                        {l}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {order.tracking_code && (
                <div>
                  <dt className="text-xs font-bold tracking-wider text-muted uppercase">{t("order.tracking")}</dt>
                  <dd className="mt-0.5 font-mono text-[13px] font-semibold break-all">
                    {/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(order.tracking_code) ? (
                      <a
                        href={`https://www.omniva.lv/en/track-and-receive-parcels/?barcode=${encodeURIComponent(order.tracking_code)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-navy-600 underline decoration-brand-400 decoration-2 underline-offset-4 hover:text-navy-800"
                      >
                        {order.tracking_code} ↗
                      </a>
                    ) : (
                      order.tracking_code
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </Panel>

          {/* Payment */}
          <Panel title={<span className="inline-flex items-center gap-2"><Wallet className="h-4 w-4 text-navy-500" />{t("order.payment")}</span>}>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs font-bold tracking-wider text-muted uppercase">{t("order.paymentMethod")}</dt>
                <dd className="mt-0.5 font-semibold">{t.has(`paymentMethod.${order.payment_method}`) ? t(`paymentMethod.${order.payment_method}`) : order.payment_method}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold tracking-wider text-muted uppercase">{t("order.paymentStatus")}</dt>
                <dd className="mt-1">
                  <StatusPill
                    status={order.payment_status}
                    label={t.has(`paymentStatus.${order.payment_status}`) ? t(`paymentStatus.${order.payment_status}`) : order.payment_status}
                  />
                  {order.paid_at && <span className="ml-2 text-xs text-muted">{formatDate(order.paid_at, locale)}</span>}
                </dd>
              </div>
              {order.notes && (
                <div>
                  <dt className="text-xs font-bold tracking-wider text-muted uppercase">{t("order.notes")}</dt>
                  <dd className="mt-0.5 leading-6 break-words whitespace-pre-line text-ink/80">{order.notes}</dd>
                </div>
              )}
            </dl>
          </Panel>

          {/* Invoices */}
          <Panel title={<span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-navy-500" />{t("order.invoices")}</span>}>
            {invoices.length > 0 ? (
              <ul className="grid gap-3">
                {invoices.map((inv) => {
                  const state = invoiceState(inv);
                  return (
                    <li key={inv.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink tabular-nums">{inv.number}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                          {t.has(`invoices.type.${inv.type}`) ? t(`invoices.type.${inv.type}`) : inv.type}
                          <StatusPill status={state} label={t(`invoices.state.${state}`)} />
                        </p>
                      </div>
                      <InvoicePdfLink id={inv.id} number={inv.number} label={t("invoices.pdf")} compact />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm leading-6 text-muted">{t("order.noInvoices")}</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
