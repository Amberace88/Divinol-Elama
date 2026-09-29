import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtDateTime } from "@/lib/admin/format";
import { sp, type SP } from "@/lib/admin/params";
import { UUID_RE } from "@/lib/admin/server";
import { RABEN_DIRECTION, toParty, type RabenAddress, type RabenForm, type RabenOrder } from "@/lib/admin/raben";
import { PageHeader } from "@/components/admin/ui";
import { RabenEditor } from "@/components/admin/raben/RabenEditor";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Raben ${UUID_RE.test(id) ? "pasūtījums" : ""}` };
}

export default async function RabenOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const [{ data: order }, { data: addrData }] = await Promise.all([
    supabase.from("raben_orders").select("*").eq("id", id).maybeSingle<RabenOrder>(),
    supabase.from("raben_addresses").select("*").order("sort").order("label"),
  ]);
  if (!order) notFound();
  const linked = order.order_id
    ? ((await supabase.from("orders").select("id, number").eq("id", order.order_id).maybeSingle<{ id: string; number: string }>()).data ?? null)
    : null;

  const initial: RabenForm = {
    direction: order.direction,
    order_id: order.order_id,
    shipper: toParty(order.shipper),
    loading: toParty(order.loading),
    consignee: toParty(order.consignee),
    unloading: toParty(order.unloading),
    goods_character: order.goods_character,
    limited_quantity: order.limited_quantity,
    units: order.units ?? [],
    loading_date: order.loading_date,
    loading_from: order.loading_from?.slice(0, 5) ?? null,
    loading_to: order.loading_to?.slice(0, 5) ?? null,
    delivery_date: order.delivery_date,
    reference: order.reference,
    cargo_value: order.cargo_value != null ? Number(order.cargo_value) : null,
    notes: order.notes,
  };
  const stepParam = Number(sp(query, "step"));
  const step = Number.isInteger(stepParam) ? stepParam : order.status === "draft" ? 0 : 3;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/raben", label: "Raben kravas" }}
        eyebrow={`Raben · ${RABEN_DIRECTION[order.direction].label}`}
        title={order.number}
        description={`Izveidots ${fmtDateTime(order.created_at)}${order.submitted_at ? ` · iesniegts ${fmtDateTime(order.submitted_at)}` : ""}${order.delivered_at ? ` · piegādāts ${fmtDateTime(order.delivered_at)}` : ""}`}
      />
      <RabenEditor
        initial={initial}
        meta={{
          id: order.id,
          number: order.number,
          status: order.status,
          raben_number: order.raben_number,
          cost_net: order.cost_net != null ? Number(order.cost_net) : null,
          submitted_at: order.submitted_at,
          delivered_at: order.delivered_at,
        }}
        addresses={(addrData ?? []) as RabenAddress[]}
        linkedOrder={linked}
        initialStep={step}
      />
    </>
  );
}
