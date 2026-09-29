"use server";

import { z } from "zod";
import { ActionError, adminAction, must, revalidateAdmin, UUID_RE } from "../server";
import type { RabenAddress, RabenStatus } from "../raben";

const uuid = z.string().regex(UUID_RE, "Nederīgs ID");
const opt = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));

const party = z.object({
  name: z.string().trim().max(160),
  street: z.string().trim().max(200),
  postal_code: z.string().trim().max(20),
  city: z.string().trim().max(100),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Valsts kodam jābūt 2 burtiem (piem. LV)"),
  vat_no: opt(40),
  contact_name: opt(120),
  phone: opt(40),
  email: opt(200),
});

const requiredParty = party.superRefine((p, ctx) => {
  if (p.name.length < 2) ctx.addIssue({ code: "custom", message: "Norādiet nosaukumu", path: ["name"] });
  if (!p.street) ctx.addIssue({ code: "custom", message: "Norādiet ielu", path: ["street"] });
  if (!p.postal_code) ctx.addIssue({ code: "custom", message: "Norādiet pasta indeksu", path: ["postal_code"] });
  if (!p.city) ctx.addIssue({ code: "custom", message: "Norādiet pilsētu", path: ["city"] });
});

const unit = z.object({
  type: z.enum(["EUR", "FIN", "HALF", "QUARTER", "DRUM", "IBC", "BOX", "OTHER"]),
  qty: z.number().int("Skaitam jābūt veselam").min(1, "Skaits vismaz 1").max(99),
  weight_kg: z.number().min(0.1, "Norādiet svaru").max(5000),
  length_cm: z.number().min(1).max(1360),
  width_cm: z.number().min(1).max(250),
  height_cm: z.number().min(1).max(300),
  stackable: z.boolean(),
  description: z.string().trim().max(200),
});

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().transform((v) => v || null);
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional().transform((v) => v || null);

const orderSchema = z.object({
  direction: z.enum(["inbound", "outbound", "return", "other"]),
  order_id: uuid.nullable().optional(),
  shipper: party,
  loading: party,
  consignee: party,
  unloading: party,
  goods_character: z.enum(["chemical", "neutral", "food", "adr"]),
  limited_quantity: z.boolean(),
  units: z.array(unit).max(30),
  loading_date: date,
  loading_from: time,
  loading_to: time,
  delivery_date: date,
  reference: opt(80),
  cargo_value: z.number().min(0).max(10_000_000).nullable().optional(),
  notes: opt(1000),
  raben_number: opt(80),
  cost_net: z.number().min(0).max(100_000).nullable().optional(),
});

export type RabenOrderPayload = z.input<typeof orderSchema>;

/** Stricter check used when the order is marked "ready" — everything myRaben requires must be present. */
function assertComplete(o: z.output<typeof orderSchema>) {
  const labels = { shipper: "Nosūtītājs", loading: "Iekraušanas vieta", consignee: "Preču saņēmējs", unloading: "Izkraušanas vieta" } as const;
  for (const k of Object.keys(labels) as (keyof typeof labels)[]) {
    const r = requiredParty.safeParse(o[k]);
    if (!r.success) throw new ActionError(`${labels[k]}: ${r.error.issues[0]?.message ?? "nepilnīga adrese"}`);
  }
  if (!o.units.length) throw new ActionError("Pievienojiet vismaz vienu kravas vienību");
  if (!o.loading_date) throw new ActionError("Norādiet iekraušanas datumu");
  if (o.loading_from && o.loading_to && o.loading_from >= o.loading_to) throw new ActionError("Iekraušanas laika logs: “no” jābūt pirms “līdz”");
  if (o.delivery_date && o.delivery_date < o.loading_date) throw new ActionError("Piegādes datums nevar būt pirms iekraušanas datuma");
}

export async function saveRabenOrder(id: string | null, payload: RabenOrderPayload, markReady = false) {
  return adminAction(
    async ({ supabase, user }) => {
      if (id) uuid.parse(id);
      const o = orderSchema.parse(payload);
      if (markReady) assertComplete(o);
      const row = { ...o, order_id: o.order_id ?? null, cargo_value: o.cargo_value ?? null, cost_net: o.cost_net ?? null };
      if (id) {
        const cur = must(await supabase.from("raben_orders").select("status").eq("id", id).maybeSingle<{ status: RabenStatus }>());
        if (!cur) throw new ActionError("Raben pasūtījums nav atrasts");
        const patch: Record<string, unknown> = { ...row };
        if (markReady && cur.status === "draft") patch.status = "ready";
        must(await supabase.from("raben_orders").update(patch).eq("id", id));
        revalidateAdmin();
        return { id };
      }
      const created = must(
        await supabase
          .from("raben_orders")
          .insert({ ...row, status: markReady ? "ready" : "draft", created_by: user.id })
          .select("id, number")
          .single<{ id: string; number: string }>(),
      )!;
      if (o.order_id) {
        await supabase.from("order_events").insert({
          order_id: o.order_id,
          type: "shipment",
          message: `Sagatavots Raben transporta pasūtījums ${created.number}`,
          created_by: user.id,
        });
      }
      revalidateAdmin();
      return { id: created.id };
    },
    markReady ? "Saglabāts — gatavs ievadīšanai myRaben" : "Melnraksts saglabāts",
  );
}

const STATUS_FLOW: Record<RabenStatus, RabenStatus[]> = {
  draft: ["ready", "cancelled"],
  ready: ["draft", "submitted", "cancelled"],
  submitted: ["ready", "in_transit", "delivered", "cancelled"],
  in_transit: ["submitted", "delivered", "cancelled"],
  delivered: ["in_transit"],
  cancelled: ["draft"],
};

export async function setRabenStatus(id: string, status: RabenStatus, extra?: { raben_number?: string | null; cost_net?: number | null }) {
  return adminAction(async ({ supabase }) => {
    uuid.parse(id);
    const cur = must(await supabase.from("raben_orders").select("status, raben_number").eq("id", id).maybeSingle<{ status: RabenStatus; raben_number: string | null }>());
    if (!cur) throw new ActionError("Raben pasūtījums nav atrasts");
    if (cur.status !== status && !STATUS_FLOW[cur.status]?.includes(status)) throw new ActionError("Šādu statusa maiņu nevar veikt");
    const patch: Record<string, unknown> = { status };
    const num = extra?.raben_number?.trim();
    if (num !== undefined) patch.raben_number = num ? num.slice(0, 80) : null;
    if (extra?.cost_net !== undefined) {
      const c = extra.cost_net;
      if (c != null && (!Number.isFinite(c) || c < 0 || c > 100_000)) throw new ActionError("Nederīga transporta izmaksa");
      patch.cost_net = c;
    }
    if (status === "submitted") patch.submitted_at = new Date().toISOString();
    if (status === "delivered") patch.delivered_at = new Date().toISOString();
    if (status === "draft" || status === "ready") {
      patch.submitted_at = null;
      patch.delivered_at = null;
    }
    must(await supabase.from("raben_orders").update(patch).eq("id", id));
    revalidateAdmin();
    return null;
  }, "Statuss atjaunināts");
}

export async function duplicateRabenOrder(id: string) {
  return adminAction(async ({ supabase, user }) => {
    uuid.parse(id);
    const src = must(await supabase.from("raben_orders").select("*").eq("id", id).maybeSingle<Record<string, unknown>>());
    if (!src) throw new ActionError("Raben pasūtījums nav atrasts");
    const keep = ["direction", "shipper", "loading", "consignee", "unloading", "goods_character", "limited_quantity", "units", "loading_from", "loading_to", "notes"];
    const row: Record<string, unknown> = { status: "draft", created_by: user.id };
    for (const k of keep) row[k] = src[k];
    const created = must(await supabase.from("raben_orders").insert(row).select("id").single<{ id: string }>())!;
    revalidateAdmin();
    return { id: created.id };
  }, "Izveidota kopija");
}

export async function deleteRabenOrder(id: string) {
  return adminAction(async ({ supabase }) => {
    uuid.parse(id);
    const cur = must(await supabase.from("raben_orders").select("status").eq("id", id).maybeSingle<{ status: RabenStatus }>());
    if (!cur) throw new ActionError("Raben pasūtījums nav atrasts");
    if (!["draft", "ready", "cancelled"].includes(cur.status)) throw new ActionError("Iesniegtu pasūtījumu nevar dzēst — atceliet to.");
    must(await supabase.from("raben_orders").delete().eq("id", id));
    revalidateAdmin();
    return null;
  }, "Dzēsts");
}

// ───────────────────────── address book ─────────────────────────
const addressSchema = requiredParty.and(z.object({ label: opt(80), notes: opt(500) }));
export type RabenAddressPayload = z.input<typeof addressSchema>;

export async function saveRabenAddress(id: string | null, payload: RabenAddressPayload) {
  return adminAction(async ({ supabase }) => {
    if (id) uuid.parse(id);
    const a = addressSchema.parse(payload);
    const row = { ...a, label: a.label || a.name };
    if (id) {
      const saved = must(await supabase.from("raben_addresses").update(row).eq("id", id).select("*").single<RabenAddress>())!;
      revalidateAdmin();
      return saved;
    }
    const { data: last } = await supabase.from("raben_addresses").select("sort").order("sort", { ascending: false }).limit(1).maybeSingle<{ sort: number }>();
    const saved = must(await supabase.from("raben_addresses").insert({ ...row, sort: (last?.sort ?? 0) + 1 }).select("*").single<RabenAddress>())!;
    revalidateAdmin();
    return saved;
  }, "Adrese saglabāta");
}

export async function deleteRabenAddress(id: string) {
  return adminAction(async ({ supabase }) => {
    uuid.parse(id);
    must(await supabase.from("raben_addresses").delete().eq("id", id));
    revalidateAdmin();
    return null;
  }, "Adrese dzēsta");
}
