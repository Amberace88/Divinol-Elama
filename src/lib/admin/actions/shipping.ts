"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { compareRates, recommend, type CompareOption } from "@/lib/shipping/compare";
import { CarrierError } from "@/lib/shipping/adapter";
import { getAdapter } from "@/lib/shipping/registry";
import {
  compareForOrder,
  loadCarriers,
  loadRates,
  ORDER_SHIP_COLS,
  orderLockedCarrier,
  receiverFromOrder,
  refreshShipmentTracking,
  resolvePickupPoint,
  senderParty,
  SHIPMENT_COLS,
  syncOrderTracking,
  type OrderForShipping,
  type OrderItemLite,
  type ShipmentRow,
} from "@/lib/shipping/service";
import { SHIPMENT_STATUSES, type Carrier, type ShipmentStatus } from "@/lib/shipping/types";
import { SHIPMENT_STATUS_LABEL } from "@/lib/shipping/tracking";
import { ActionError, adminAction, must, revalidateAdmin, UUID_RE } from "../server";
import { deferEmail } from "@/lib/email/send";
import { notifyOrderShipped } from "@/lib/email/notify";

type Ctx = Parameters<Parameters<typeof adminAction>[0]>[0];

const uuid = z.string().regex(UUID_RE, "Nederīgs ID");
const code = z.string().regex(/^[a-z0-9_]{2,30}$/, "Nederīgs pārvadātājs");

const parcelSchema = z.object({
  weightKg: z.number().min(0.05, "Svaram jābūt > 0").max(2000),
  l: z.number().min(0).max(400).nullable().optional(),
  w: z.number().min(0).max(400).nullable().optional(),
  h: z.number().min(0).max(400).nullable().optional(),
  sizeCode: z.string().max(20).nullable().optional(),
});

const createSchema = z.object({
  orderId: uuid.nullable(),
  carrier: code,
  serviceCode: z.string().trim().min(1).max(60),
  mode: z.enum(["api", "manual"]),
  parcels: z.array(parcelSchema).min(1, "Pievienojiet vismaz vienu paku").max(99),
  trackingNumber: z.string().trim().max(120).optional().nullable(),
  costNet: z.number().min(0).max(100000).nullable().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  markShipped: z.boolean().default(false),
  /** only for shipments without an order (e.g. samples / B2B deliveries) */
  receiver: z
    .object({
      name: z.string().trim().min(2).max(120),
      company: z.string().trim().max(120).nullable().optional(),
      phone: z.string().trim().max(40).nullable().optional(),
      email: z.string().trim().max(200).nullable().optional(),
      street: z.string().trim().max(200).nullable().optional(),
      city: z.string().trim().max(100).nullable().optional(),
      postcode: z.string().trim().max(20).nullable().optional(),
      country: z.enum(["LV", "EE", "LT"]),
    })
    .nullable()
    .optional(),
});

export type CreateShipmentPayload = z.input<typeof createSchema>;

async function loadOrder(ctx: Ctx, orderId: string) {
  const order = must(await ctx.supabase.from("orders").select(ORDER_SHIP_COLS).eq("id", orderId).maybeSingle<OrderForShipping>());
  if (!order) throw new ActionError("Pasūtījums nav atrasts");
  const items = must(await ctx.supabase.from("order_items").select("name, pack_label, qty").eq("order_id", orderId)) as OrderItemLite[];
  return { order, items };
}

function carrierOf(carriers: Carrier[], c: string) {
  const found = carriers.find((x) => x.code === c);
  if (!found) throw new ActionError("Pārvadātājs nav atrasts");
  if (!found.enabled) throw new ActionError(`${found.name} ir atslēgts (Tarifi → Pārvadātāji).`);
  return found;
}

/** Core: create one shipment (carrier API or manual). */
async function createOne(ctx: Ctx, input: z.infer<typeof createSchema>, carriers: Carrier[]) {
  const { supabase, user } = ctx;
  const carrier = carrierOf(carriers, input.carrier);
  const rates = (await loadRates(supabase, { activeOnly: true })).filter((r) => r.carrier === input.carrier && r.service_code === input.serviceCode);
  const rate = rates[0];
  const type = rate?.type ?? (input.serviceCode.includes("pallet") ? "pallet" : input.serviceCode.includes("courier") ? "courier" : "locker");

  let order: OrderForShipping | null = null;
  if (input.orderId) {
    const o = await loadOrder(ctx, input.orderId);
    order = o.order;
    const active = must(
      await supabase.from("shipments").select("id").eq("order_id", input.orderId).not("status", "in", "(cancelled,returned)").limit(1),
    ) as { id: string }[];
    if (active.length > 0 && input.mode === "api") throw new ActionError("Šim pasūtījumam jau ir aktīvs sūtījums. Atceliet to vai izveidojiet manuāli.");
    const locked = orderLockedCarrier(order);
    if (type === "locker" && locked && locked !== input.carrier) {
      throw new ActionError(`Klients izvēlējās ${locked === "omniva" ? "Omniva" : locked} pakomātu — pakomāta sūtījumu var veidot tikai ar šo pārvadātāju.`);
    }
  }
  const receiver = order ? receiverFromOrder(order) : input.receiver ? { ...input.receiver, company: input.receiver.company ?? null } : null;
  if (!receiver) throw new ActionError("Norādiet saņēmēju.");
  const country = receiver.country;

  const pickup =
    type === "locker" && order?.shipping_point?.id ? await resolvePickupPoint(input.carrier, country, order.shipping_point) : null;
  if (type === "courier" && input.mode === "api" && !receiver.street) throw new ActionError("Kurjera sūtījumam nepieciešama piegādes adrese.");

  let trackingNumbers: string[] = [];
  let carrierRef: string | null = null;
  if (input.mode === "api") {
    const adapter = getAdapter(input.carrier);
    if (!adapter.createShipment || !adapter.capabilities().api) {
      throw new ActionError(`${carrier.name} API nav pieslēgts — izmantojiet manuālo režīmu (ievadiet sūtījuma kodu).`);
    }
    if (type === "locker" && !pickup) throw new ActionError("Pasūtījumā nav pakomāta ID — izvēlieties manuālo režīmu.");
    try {
      const res = await adapter.createShipment(
        {
          reference: order?.number ?? `DIV-${Date.now().toString(36).toUpperCase()}`,
          serviceType: type,
          serviceCode: input.serviceCode,
          parcels: input.parcels,
          receiver,
          pickupPoint: pickup,
          sender: await senderParty(),
        },
        {
          nextSerial: async (key) => Number(must(await supabase.rpc("shipping_next_serial", { p_key: key }))),
        },
      );
      trackingNumbers = res.trackingNumbers;
      carrierRef = res.carrierRef ?? null;
    } catch (e) {
      throw new ActionError(e instanceof CarrierError ? e.message : `Neizdevās sazināties ar ${carrier.name}.`);
    }
  } else if (input.trackingNumber) {
    trackingNumbers = input.trackingNumber
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 99);
  }

  // expected cost from the rate card (per parcel, cheapest class that fits)
  let cost = input.costNet ?? null;
  let costSource: string | null = cost != null ? "actual" : null;
  if (cost == null && rates.length) {
    const opts = compareRates(rates, {
      country,
      type,
      units: input.parcels.map((p) => ({ weightKg: p.weightKg, l: p.l || 1, w: p.w || 1, h: p.h || 1 })),
      combine: false,
    });
    const o = opts.find((x) => x.valid);
    if (o?.totalNet != null) {
      cost = o.totalNet;
      costSource = o.priceKind === "contract" ? "contract" : "rate";
    }
  }

  const now = new Date().toISOString();
  const status: ShipmentStatus = input.markShipped ? "handed_over" : trackingNumbers.length ? "created" : "draft";
  const weight = input.parcels.reduce((s, p) => s + p.weightKg, 0);
  const row = must(
    await supabase
      .from("shipments")
      .insert({
        order_id: order?.id ?? null,
        carrier: input.carrier,
        service_code: input.serviceCode,
        service_name: rate?.service_name ?? input.serviceCode,
        type,
        mode: input.mode,
        status,
        tracking_number: trackingNumbers[0] ?? null,
        tracking_numbers: trackingNumbers,
        carrier_ref: carrierRef,
        country,
        weight_kg: Math.round(weight * 1000) / 1000,
        parcels: input.parcels.length,
        dims: input.parcels.map((p) => ({ weight_kg: p.weightKg, l: p.l ?? null, w: p.w ?? null, h: p.h ?? null, size_code: p.sizeCode ?? null })),
        cost_net: cost,
        cost_source: costSource,
        customer_paid_net: order ? Number(order.shipping_net) : null,
        receiver,
        pickup_point: pickup ? { id: pickup.id, name: pickup.name, city: pickup.city, address: pickup.address } : null,
        notes: input.notes || null,
        events: [{ at: now, status, text: input.mode === "api" ? `Izveidots ${carrier.name} sistēmā` : "Izveidots manuāli", source: "admin" }],
        shipped_at: input.markShipped ? now : null,
        created_by: user.id,
      })
      .select("id")
      .single<{ id: string }>(),
  );

  if (order) {
    if (trackingNumbers[0]) await syncOrderTracking(supabase, order.id, carrier, trackingNumbers[0]);
    const msg = `${carrier.name}${rate ? ` · ${rate.service_name}` : ""}${trackingNumbers.length ? ` · ${trackingNumbers.join(", ")}` : " · melnraksts"}`;
    must(await supabase.from("order_events").insert({ order_id: order.id, type: "shipment", message: msg, created_by: user.id }));
    if (input.markShipped) await setOrderShipped(ctx, order.id, order.status);
  }
  if (!row) throw new ActionError("Sūtījumu neizdevās saglabāt");
  return { id: row.id, trackingNumbers };
}

async function setOrderShipped(ctx: Ctx, orderId: string, current: string) {
  if (!["new", "confirmed", "processing"].includes(current)) return;
  must(await ctx.supabase.from("orders").update({ status: "shipped" }).eq("id", orderId));
  must(
    await ctx.supabase.from("order_events").insert({
      order_id: orderId,
      type: "status",
      message: `${current === "new" ? "Jauns" : current === "confirmed" ? "Apstiprināts" : "Komplektē"} → Nosūtīts`,
      created_by: ctx.user.id,
    }),
  );
  // "Your order has been shipped" → customer (only on this transition; runs after the response)
  deferEmail("order shipped", () => notifyOrderShipped(ctx.supabase, orderId));
}

export async function createShipmentAction(payload: CreateShipmentPayload) {
  return adminAction(async (ctx) => {
    const input = createSchema.parse(payload);
    if (input.mode === "manual" && input.markShipped && !input.trackingNumber) {
      throw new ActionError("Lai atzīmētu kā nosūtītu, ievadiet sūtījuma kodu.");
    }
    const carriers = await loadCarriers(ctx.supabase);
    const res = await createOne(ctx, input, carriers);
    revalidateAdmin();
    return res;
  }, (d) => (d.trackingNumbers.length ? `Sūtījums izveidots: ${d.trackingNumbers.join(", ")}` : "Sūtījuma melnraksts izveidots"));
}

/** Bulk: one shipment per order with the chosen (or recommended) carrier service; parcels derived from order items. */
export async function createShipmentsBulk(rows: { orderId: string; carrier?: string | null; serviceCode?: string | null }[]) {
  return adminAction(async (ctx) => {
    const list = z
      .array(z.object({ orderId: uuid, carrier: code.nullable().optional(), serviceCode: z.string().max(60).nullable().optional() }))
      .min(1, "Atzīmējiet pasūtījumus")
      .max(50, "Vienā reizē līdz 50 pasūtījumiem")
      .parse(rows);
    const carriers = await loadCarriers(ctx.supabase);
    const rates = await loadRates(ctx.supabase, { activeOnly: true });
    const results: { orderId: string; ok: boolean; message: string; shipmentId?: string }[] = [];
    for (const r of list) {
      try {
        const { order, items } = await loadOrder(ctx, r.orderId);
        const options = compareForOrder(order, items, rates, carriers);
        const chosen: CompareOption | null =
          r.carrier && r.serviceCode ? options.find((o) => o.carrier === r.carrier && o.serviceCode === r.serviceCode && o.valid) ?? null : recommend(options);
        if (!chosen) throw new ActionError("Nav piemērota pārvadātāja");
        const api = getAdapter(chosen.carrier).capabilities().api;
        const parcels = chosen.parcels.map((p) => ({ weightKg: Math.max(0.1, p.weightKg), sizeCode: p.sizeCode }));
        const res = await createOne(
          ctx,
          { orderId: order.id, carrier: chosen.carrier, serviceCode: chosen.serviceCode, mode: api ? "api" : "manual", parcels, markShipped: false, costNet: null, notes: null, trackingNumber: null, receiver: null },
          carriers,
        );
        results.push({
          orderId: r.orderId,
          ok: true,
          shipmentId: res.id,
          message: `${order.number}: ${chosen.carrierName}${res.trackingNumbers.length ? ` ${res.trackingNumbers.join(", ")}` : " (melnraksts — ievadiet kodu)"}`,
        });
      } catch (e) {
        results.push({ orderId: r.orderId, ok: false, message: e instanceof Error ? e.message : "Kļūda" });
      }
    }
    revalidateAdmin();
    return results;
  }, (d) => {
    const ok = d.filter((x) => x.ok).length;
    return ok === d.length ? `Izveidoti ${ok} sūtījumi` : `Izveidoti ${ok} no ${d.length} sūtījumiem`;
  });
}

const updateSchema = z.object({
  status: z.enum(SHIPMENT_STATUSES).optional(),
  trackingNumber: z.string().trim().max(400).nullable().optional(),
  costNet: z.number().min(0).max(100000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  labelPath: z.string().max(300).nullable().optional(),
  labelUrl: z.string().trim().url().max(500).nullable().optional().or(z.literal("")),
});

async function getShipment(ctx: Ctx, id: string) {
  const s = must(await ctx.supabase.from("shipments").select(SHIPMENT_COLS).eq("id", id).maybeSingle<ShipmentRow>());
  if (!s) throw new ActionError("Sūtījums nav atrasts");
  return s;
}

export async function updateShipmentAction(id: string, patch: z.input<typeof updateSchema>) {
  return adminAction(async (ctx) => {
    uuid.parse(id);
    const p = updateSchema.parse(patch);
    const s = await getShipment(ctx, id);
    const carriers = await loadCarriers(ctx.supabase);
    const carrier = carriers.find((c) => c.code === s.carrier);
    const update: Record<string, unknown> = {};
    const events = [...(s.events ?? [])];
    const now = new Date().toISOString();
    if (p.trackingNumber !== undefined) {
      const nums = (p.trackingNumber ?? "")
        .split(/[\s,;]+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 99);
      update.tracking_numbers = nums;
      update.tracking_number = nums[0] ?? null;
      if (nums.length && s.status === "draft" && !p.status) update.status = "created";
      events.push({ at: now, text: nums.length ? `Sūtījuma kods: ${nums.join(", ")}` : "Sūtījuma kods noņemts", source: "admin" });
      if (s.order_id) await syncOrderTracking(ctx.supabase, s.order_id, carrier, nums[0] ?? null);
    }
    if (p.status && p.status !== s.status) {
      update.status = p.status;
      events.push({ at: now, status: p.status, text: `Statuss: ${SHIPMENT_STATUS_LABEL[p.status].label}`, source: "admin" });
      if (["handed_over", "in_transit", "delivered"].includes(p.status) && !s.shipped_at) update.shipped_at = now;
      if (p.status === "delivered" && !s.delivered_at) update.delivered_at = now;
    }
    if (p.costNet !== undefined) {
      update.cost_net = p.costNet;
      update.cost_source = p.costNet == null ? null : "actual";
    }
    if (p.notes !== undefined) update.notes = p.notes || null;
    if (p.labelPath !== undefined) update.label_path = p.labelPath;
    if (p.labelUrl !== undefined) update.label_url = p.labelUrl || null;
    update.events = events.slice(-100);
    must(await ctx.supabase.from("shipments").update(update).eq("id", id));
    if (s.order_id && p.status && ["handed_over", "in_transit"].includes(p.status)) {
      const o = must(await ctx.supabase.from("orders").select("status").eq("id", s.order_id).maybeSingle<{ status: string }>());
      if (o) await setOrderShipped(ctx, s.order_id, o.status);
    }
    revalidateAdmin();
    return null;
  }, "Sūtījums atjaunināts");
}

/** "Nosūtīts": shipment handed over to the carrier + order status → shipped + tracking on the order. */
export async function markShipmentShipped(id: string) {
  return adminAction(async (ctx) => {
    uuid.parse(id);
    const s = await getShipment(ctx, id);
    if (!s.tracking_number) throw new ActionError("Vispirms ievadiet sūtījuma kodu.");
    const now = new Date().toISOString();
    if (STATUS_ORDER.indexOf(s.status) < STATUS_ORDER.indexOf("handed_over")) {
      must(
        await ctx.supabase
          .from("shipments")
          .update({ status: "handed_over", shipped_at: s.shipped_at ?? now, events: [...(s.events ?? []), { at: now, status: "handed_over", text: "Nodots pārvadātājam", source: "admin" }] })
          .eq("id", id),
      );
    }
    if (s.order_id) {
      const carriers = await loadCarriers(ctx.supabase);
      await syncOrderTracking(ctx.supabase, s.order_id, carriers.find((c) => c.code === s.carrier), s.tracking_number);
      const o = must(await ctx.supabase.from("orders").select("status").eq("id", s.order_id).maybeSingle<{ status: string }>());
      if (o) await setOrderShipped(ctx, s.order_id, o.status);
    }
    revalidateAdmin();
    return null;
  }, "Atzīmēts kā nosūtīts");
}

const STATUS_ORDER: ShipmentStatus[] = ["draft", "created", "label_printed", "handed_over", "in_transit", "delivered", "returned", "cancelled"];

export async function cancelShipmentAction(id: string) {
  return adminAction(async (ctx) => {
    uuid.parse(id);
    const s = await getShipment(ctx, id);
    if (s.status === "delivered") throw new ActionError("Piegādātu sūtījumu nevar atcelt.");
    const now = new Date().toISOString();
    must(
      await ctx.supabase
        .from("shipments")
        .update({
          status: "cancelled",
          events: [
            ...(s.events ?? []),
            { at: now, status: "cancelled", text: s.mode === "api" ? "Atcelts (pārvadātāja sistēmā atceliet atsevišķi, ja nepieciešams)" : "Atcelts", source: "admin" },
          ],
        })
        .eq("id", id),
    );
    if (s.order_id) {
      const o = must(await ctx.supabase.from("orders").select("tracking_code").eq("id", s.order_id).maybeSingle<{ tracking_code: string | null }>());
      if (o?.tracking_code && o.tracking_code === s.tracking_number) await syncOrderTracking(ctx.supabase, s.order_id, undefined, null);
      must(await ctx.supabase.from("order_events").insert({ order_id: s.order_id, type: "shipment", message: `Sūtījums atcelts${s.tracking_number ? ` (${s.tracking_number})` : ""}`, created_by: ctx.user.id }));
    }
    revalidateAdmin();
    return null;
  }, "Sūtījums atcelts");
}

export async function refreshTrackingAction(id: string) {
  return adminAction(async (ctx) => {
    uuid.parse(id);
    const s = await getShipment(ctx, id);
    try {
      const r = await refreshShipmentTracking(ctx.supabase, s);
      revalidateAdmin();
      return r;
    } catch (e) {
      throw new ActionError(e instanceof Error ? e.message : "Izsekošana neizdevās");
    }
  }, (d) => (d.added ? `Atjaunināts: ${d.added} jauni notikumi` : "Jaunu notikumu nav"));
}

export async function refreshTrackingBulk() {
  return adminAction(async (ctx) => {
    const list = must(
      await ctx.supabase.from("shipments").select(SHIPMENT_COLS).in("status", ["created", "label_printed", "handed_over", "in_transit"]).order("last_tracked_at", { ascending: true, nullsFirst: true }).limit(15),
    ) as ShipmentRow[];
    let updated = 0;
    let skipped = 0;
    for (const s of list) {
      if (!getAdapter(s.carrier).capabilities().tracking || !s.tracking_number) {
        skipped++;
        continue;
      }
      try {
        await refreshShipmentTracking(ctx.supabase, s);
        updated++;
      } catch {
        skipped++;
      }
    }
    revalidateAdmin();
    return { updated, skipped };
  }, (d) => `Izsekošana atjaunināta: ${d.updated}${d.skipped ? ` (izlaisti ${d.skipped})` : ""}`);
}

// ───────────────────────── rates & carriers ─────────────────────────

const rateSchema = z
  .object({
    id: uuid.nullable().optional(),
    carrier: code,
    service_code: z.string().trim().min(1, "Norādiet pakalpojuma kodu").max(60).regex(/^[a-z0-9_-]+$/i, "Kods: burti, cipari, _ -"),
    service_name: z.string().trim().min(2, "Norādiet nosaukumu").max(120),
    type: z.enum(["locker", "courier", "pickup", "pallet"]),
    country: z.enum(["LV", "EE", "LT"]),
    size_code: z.string().trim().max(20).nullable(),
    min_weight_kg: z.number().min(0).max(2000),
    max_weight_kg: z.number().gt(0, "Maks. svaram jābūt > 0").max(5000),
    max_length_cm: z.number().min(0).max(1000).nullable(),
    max_width_cm: z.number().min(0).max(1000).nullable(),
    max_height_cm: z.number().min(0).max(1000).nullable(),
    price_net: z.number().min(0).max(100000).nullable(),
    transit_days_min: z.number().int().min(0).max(60).nullable(),
    transit_days_max: z.number().int().min(0).max(60).nullable(),
    source_url: z.string().trim().url("Nederīga saite").max(500).nullable().or(z.literal("").transform(() => null)),
    source_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().or(z.literal("").transform(() => null)),
    source_note: z.string().trim().max(300).nullable(),
    is_contract: z.boolean(),
    active: z.boolean(),
  })
  .refine((r) => r.max_weight_kg >= r.min_weight_kg, { message: "Maks. svars mazāks par min.", path: ["max_weight_kg"] });

export type RateInput = z.input<typeof rateSchema>;

export async function saveRate(input: RateInput) {
  return adminAction(async ({ supabase }) => {
    const r = rateSchema.parse(input);
    const { id, ...row } = r;
    const data = { ...row, size_code: row.size_code || null };
    if (id) must(await supabase.from("shipping_rates").update(data).eq("id", id));
    else must(await supabase.from("shipping_rates").insert(data));
    revalidateAdmin();
    return null;
  }, "Tarifs saglabāts");
}

export async function setRateActive(id: string, active: boolean) {
  return adminAction(async ({ supabase }) => {
    uuid.parse(id);
    must(await supabase.from("shipping_rates").update({ active }).eq("id", id));
    revalidateAdmin();
    return null;
  }, active ? "Tarifs aktivizēts" : "Tarifs deaktivizēts");
}

export async function deleteRate(id: string) {
  return adminAction(async ({ supabase }) => {
    uuid.parse(id);
    must(await supabase.from("shipping_rates").delete().eq("id", id));
    revalidateAdmin();
    return null;
  }, "Tarifs dzēsts");
}

const carrierSchema = z.object({
  enabled: z.boolean().optional(),
  checkout_enabled: z.boolean().optional(),
  tracking_url_template: z
    .string()
    .trim()
    .max(400)
    .refine((v) => v === "" || (/^https:\/\//.test(v) && v.includes("{code}")), "Saitei jāsākas ar https:// un jāsatur {code}")
    .nullable()
    .optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export async function updateCarrier(carrierCode: string, patch: z.input<typeof carrierSchema>) {
  return adminAction(async ({ supabase }) => {
    code.parse(carrierCode);
    const p = carrierSchema.parse(patch);
    if (p.checkout_enabled) {
      const adapter = getAdapter(carrierCode);
      if (!adapter.listPickupPoints || !adapter.capabilities().pickupPoints) {
        throw new ActionError("Šim pārvadātājam nav pieejams pakomātu saraksts — to nevar piedāvāt klientiem.");
      }
    }
    const update: Record<string, unknown> = { ...p };
    if (p.tracking_url_template !== undefined) update.tracking_url_template = p.tracking_url_template || null;
    must(await supabase.from("shipping_carriers").update(update).eq("code", carrierCode));
    revalidateTag("shipping-carriers", { expire: 0 });
    revalidateAdmin();
    return null;
  }, "Pārvadātājs saglabāts");
}
