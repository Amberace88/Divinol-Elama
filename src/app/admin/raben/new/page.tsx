import { requireAdmin } from "@/lib/admin/auth";
import { todayRiga } from "@/lib/admin/format";
import { sp, type SP } from "@/lib/admin/params";
import { UUID_RE } from "@/lib/admin/server";
import { nextWorkingDay, toParty, unitFromPreset, type RabenAddress, type RabenForm, type RabenUnit } from "@/lib/admin/raben";
import { unitsFromItems } from "@/lib/shipping/compare";
import { PageHeader } from "@/components/admin/ui";
import { RabenEditor } from "@/components/admin/raben/RabenEditor";

export const metadata = { title: "Jauns Raben pasūtījums" };

type OrderLite = {
  id: string;
  number: string;
  email: string | null;
  phone: string | null;
  market: string;
  subtotal_net: number | null;
  shipping_address: { name?: string; street?: string; city?: string; postal_code?: string; country?: string; phone?: string } | null;
  customer: { name?: string; company_name?: string; vat_no?: string } | null;
};

export default async function NewRabenPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const { data: addrData } = await supabase.from("raben_addresses").select("*").order("sort").order("label");
  const addresses = (addrData ?? []) as RabenAddress[];
  const wh = addresses.find((a) => /btg|noliktav/i.test(`${a.label} ${a.name}`));
  const zg = addresses.find((a) => /zeller/i.test(`${a.label} ${a.name}`));

  const loadingDate = nextWorkingDay(todayRiga());
  const base: RabenForm = {
    direction: "inbound",
    order_id: null,
    shipper: toParty(zg),
    loading: toParty(zg),
    consignee: toParty(wh),
    unloading: toParty(wh),
    goods_character: "chemical",
    limited_quantity: false,
    units: [unitFromPreset("EUR")],
    loading_date: loadingDate,
    loading_from: "08:00",
    loading_to: "16:00",
    delivery_date: null,
    reference: null,
    cargo_value: null,
    notes: null,
  };

  // Prefill from a shop order: warehouse → customer, cargo estimated from the ordered packs.
  let linked: { id: string; number: string } | null = null;
  const orderId = sp(params, "order");
  if (orderId && UUID_RE.test(orderId)) {
    const { data: order } = await supabase
      .from("orders")
      .select("id, number, email, phone, market, subtotal_net, shipping_address, customer")
      .eq("id", orderId)
      .maybeSingle<OrderLite>();
    if (order) {
      const { data: items } = await supabase.from("order_items").select("name, pack_label, qty").eq("order_id", order.id);
      const list = (items ?? []) as { name: string; pack_label: string | null; qty: number }[];
      const a = order.shipping_address ?? {};
      const c = order.customer ?? {};
      const consignee = toParty({
        name: c.company_name || a.name || c.name || "",
        street: a.street ?? "",
        postal_code: (a.postal_code ?? "").replace(/^(LV|EE|LT)-/i, ""),
        city: a.city ?? "",
        country: a.country || order.market || "LV",
        vat_no: c.vat_no ?? "",
        contact_name: a.name || c.name || "",
        phone: a.phone || order.phone || "",
        email: order.email ?? "",
      });
      const units = unitsFromItems(list);
      const weight = units.reduce((s, u) => s + u.weightKg, 0);
      const drums = list.filter((i) => /208\s*l/i.test(i.pack_label ?? "")).reduce((s, i) => s + i.qty, 0);
      const desc = list
        .map((i) => `${i.qty}× ${i.name}${i.pack_label ? ` ${i.pack_label}` : ""}`)
        .join(", ")
        .slice(0, 200);
      const cargo: RabenUnit[] = [];
      if (drums > 0) cargo.push({ ...unitFromPreset("DRUM", "Muca 208 L"), qty: drums });
      const rest = weight - drums * 195;
      if (rest > 1 || !cargo.length) {
        const pallets = Math.max(1, Math.ceil(rest / 750));
        cargo.push({ ...unitFromPreset("EUR", desc), qty: pallets, weight_kg: Math.max(30, Math.round(rest / pallets + 25)), height_cm: rest / pallets > 400 ? 120 : 100 });
      }
      const whP = toParty(wh);
      Object.assign(base, {
        direction: "outbound",
        order_id: order.id,
        shipper: whP,
        loading: whP,
        consignee,
        unloading: consignee,
        units: cargo,
        reference: order.number,
        cargo_value: order.subtotal_net != null ? Number(order.subtotal_net) : null,
      } satisfies Partial<RabenForm>);
      linked = { id: order.id, number: order.number };
    }
  }

  return (
    <>
      <PageHeader
        back={linked ? { href: `/admin/orders/${linked.id}#piegade`, label: `Pasūtījums ${linked.number}` } : { href: "/admin/raben", label: "Raben kravas" }}
        eyebrow="Raben"
        title="Jauns transporta pasūtījums"
        description="4 vienkārši soļi: maršruts → krava → datumi → pārbaude. Visu var saglabāt kā melnrakstu un pabeigt vēlāk."
      />
      <RabenEditor initial={base} meta={null} addresses={addresses} linkedOrder={linked} />
    </>
  );
}
