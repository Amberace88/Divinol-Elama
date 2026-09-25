import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtDateTime } from "@/lib/admin/format";
import { PAYMENT_METHOD, SHIPPING_METHOD } from "@/lib/admin/labels";
import { UUID_RE } from "@/lib/admin/server";
import { getStoreSettings } from "@/lib/settings";
import { AddressBlock } from "@/components/admin/Address";
import { PrintButton } from "@/components/admin/PrintButton";
import { btn } from "@/components/admin/styles";

export const metadata = { title: "Pavadzīme" };

type Order = {
  id: string;
  number: string;
  email: string;
  phone: string | null;
  customer: { name?: string; company_name?: string; reg_no?: string; vat_no?: string } | null;
  shipping_address: Record<string, unknown> | null;
  shipping_point: Record<string, unknown> | null;
  shipping_method: string;
  payment_method: string;
  notes: string | null;
  tracking_code: string | null;
  created_at: string;
};
type Item = { id: string; sku: string | null; name: string; pack_label: string | null; qty: number };

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const [{ data: order }, { data: itemsData }, settings] = await Promise.all([
    supabase
      .from("orders")
      .select("id, number, email, phone, customer, shipping_address, shipping_point, shipping_method, payment_method, notes, tracking_code, created_at")
      .eq("id", id)
      .maybeSingle<Order>(),
    supabase.from("order_items").select("id, sku, name, pack_label, qty").eq("order_id", id).order("name"),
    getStoreSettings(),
  ]);
  if (!order) notFound();
  const items = (itemsData ?? []) as Item[];
  const company = settings.company;
  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  return (
    <>
      <style>{`@page { size: A4; margin: 12mm; } @media print { body { background: #fff !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/orders/${order.id}`} className="text-[13px] font-semibold text-muted hover:text-navy-700">
          ← Atpakaļ uz pasūtījumu
        </Link>
        <div className="flex gap-2">
          <Link href={`/admin/orders/${order.id}`} className={btn("outline")}>
            Aizvērt
          </Link>
          <PrintButton />
        </div>
      </div>

      <article className="mx-auto max-w-[210mm] bg-white p-8 text-[12.5px] text-ink shadow-card ring-1 ring-line print:max-w-none print:p-0 print:shadow-none print:ring-0">
        <header className="flex items-stretch justify-between gap-6 overflow-hidden rounded-xl bg-navy-700 text-white print:rounded-none">
          <div className="flex items-center gap-4 px-6 py-5">
            <Image src="/media/brand/elama-logo.png" alt="ELAMA" width={826} height={155} className="h-7 w-auto" />
          </div>
          <div className="relative flex items-center bg-brand-400 px-7 text-navy-900">
            <div className="absolute inset-y-0 -left-4 w-8 -skew-x-12 bg-brand-400" aria-hidden />
            <div className="relative text-right">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]">Pavadzīme / komplektēšana</p>
              <p className="text-[20px] font-extrabold tracking-[-0.02em]">{order.number}</p>
            </div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-3 gap-6">
          <div>
            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">Nosūtītājs</p>
            <p className="font-bold">{company.name}</p>
            <p>{company.warehouse || company.address}</p>
            <p>{company.phone}</p>
            <p>{company.email}</p>
          </div>
          <div>
            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">Saņēmējs</p>
            {order.customer?.company_name && <p className="font-bold">{order.customer.company_name}</p>}
            <p className={order.customer?.company_name ? "" : "font-bold"}>{order.customer?.name ?? "—"}</p>
            <p>{order.phone ?? ""}</p>
            <p>{order.email}</p>
          </div>
          <div>
            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">Pasūtījums</p>
            <p>Datums: {fmtDateTime(order.created_at)}</p>
            <p>Apmaksa: {PAYMENT_METHOD[order.payment_method] ?? order.payment_method}</p>
            {order.tracking_code && <p className="font-mono">Sūtījums: {order.tracking_code}</p>}
          </div>
        </section>

        <section className="mt-5 rounded-xl border-2 border-navy-700 p-4">
          <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">Piegāde</p>
          <p className="text-[15px] font-extrabold">{SHIPPING_METHOD[order.shipping_method] ?? order.shipping_method}</p>
          <div className="mt-2 grid grid-cols-2 gap-4">
            {order.shipping_point && <AddressBlock value={order.shipping_point} />}
            {order.shipping_address && order.shipping_method !== "pickup" && <AddressBlock value={order.shipping_address} />}
          </div>
        </section>

        <table className="mt-6 w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-navy-700 text-[10.5px] uppercase tracking-[0.1em] text-muted">
              <th className="w-8 py-2">✓</th>
              <th className="w-8 py-2">Nr.</th>
              <th className="py-2">Nosaukums</th>
              <th className="py-2">SKU</th>
              <th className="py-2">Iepakojums</th>
              <th className="py-2 text-right">Daudz.</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className="break-inside-avoid border-b border-line">
                <td className="py-2.5">
                  <span className="inline-block h-4 w-4 rounded-[3px] border-2 border-navy-700" />
                </td>
                <td className="py-2.5 text-muted">{i + 1}</td>
                <td className="py-2.5 font-semibold">{it.name}</td>
                <td className="py-2.5 font-mono">{it.sku ?? "—"}</td>
                <td className="py-2.5">{it.pack_label ?? "—"}</td>
                <td className="py-2.5 text-right text-[15px] font-extrabold">{it.qty}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="pt-3 text-right font-bold">
                Kopā vienības:
              </td>
              <td className="pt-3 text-right text-[15px] font-extrabold">{totalQty}</td>
            </tr>
          </tfoot>
        </table>

        {order.notes && (
          <section className="mt-6 rounded-xl bg-brand-50 p-4 print:border print:border-brand-300">
            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">Klienta komentārs</p>
            <p className="whitespace-pre-wrap">{order.notes}</p>
          </section>
        )}

        <section className="mt-12 grid grid-cols-2 gap-10 text-[11px] text-muted">
          <div className="border-t border-ink/40 pt-1.5">Komplektēja (vārds, paraksts, datums)</div>
          <div className="border-t border-ink/40 pt-1.5">Saņēma (vārds, paraksts, datums)</div>
        </section>
      </article>
    </>
  );
}
