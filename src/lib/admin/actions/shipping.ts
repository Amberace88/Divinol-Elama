"use server";

import { z } from "zod";
import { createOmnivaShipment, OmnivaError, omnivaConfigured } from "@/lib/shipping/omniva";
import { getStoreSettings } from "@/lib/settings";
import type { Market } from "@/lib/types";
import { ActionError, adminAction, must, revalidateAdmin, UUID_RE } from "../server";

type OrderRow = {
  id: string;
  number: string;
  email: string;
  phone: string | null;
  market: Market;
  status: string;
  shipping_method: string;
  shipping_point: { id?: string | null; name?: string } | null;
  shipping_address: { name?: string; street?: string; city?: string; postal_code?: string; country?: string; phone?: string } | null;
  customer: { name?: string; company_name?: string } | null;
  tracking_code: string | null;
};

/** Parses "Ventspils iela 51, Rīga, LV-1002" into street / city / postcode for the sender address. */
function parseWarehouse(addr: string) {
  const parts = addr.split(",").map((p) => p.trim());
  const postcode = parts.find((p) => /\d{4}/.test(p) && /LV|EE|LT|^\d/.test(p)) ?? "";
  return { street: parts[0] ?? addr, city: parts[1] ?? "Rīga", postcode };
}

export async function createOmnivaShipmentAction(orderId: string, weightKg: number, markShipped: boolean) {
  return adminAction(async ({ supabase, user }) => {
    z.string().regex(UUID_RE).parse(orderId);
    const weight = z.number().min(0.1).max(1000).parse(weightKg);
    if (!omnivaConfigured()) {
      throw new ActionError("Omniva API nav pieslēgts. Netlify iestatījumos pievienojiet OMNIVA_USERNAME, OMNIVA_PASSWORD un OMNIVA_CUSTOMER_CODE.");
    }
    const order = must(
      await supabase
        .from("orders")
        .select("id, number, email, phone, market, status, shipping_method, shipping_point, shipping_address, customer, tracking_code")
        .eq("id", orderId)
        .maybeSingle<OrderRow>(),
    );
    if (!order) throw new ActionError("Pasūtījums nav atrasts");
    if (order.tracking_code) throw new ActionError("Šim pasūtījumam jau ir sūtījuma kods.");
    const channel = order.shipping_method === "parcel_locker" ? "PARCEL_MACHINE" : order.shipping_method === "courier" ? "COURIER" : null;
    if (!channel) throw new ActionError("Omniva sūtījumu var izveidot tikai pakomāta vai kurjera piegādei.");
    if (channel === "PARCEL_MACHINE" && !order.shipping_point?.id) {
      throw new ActionError("Klients norādīja pakomātu brīvā tekstā — izvēlieties pakomātu Omniva sistēmā vai ievadiet kodu manuāli.");
    }
    const settings = await getStoreSettings();
    const wh = parseWarehouse(settings.company.warehouse);
    const addr = order.shipping_address ?? {};
    let barcode: string;
    try {
      barcode = await createOmnivaShipment({
        orderNumber: order.number,
        channel,
        weightKg: weight,
        receiver: {
          name: addr.name || order.customer?.name || order.customer?.company_name || order.email,
          phone: addr.phone || order.phone,
          email: order.email,
          country: order.market,
          lockerZip: order.shipping_point?.id ?? null,
          street: addr.street ?? null,
          city: addr.city ?? null,
          postcode: addr.postal_code ?? null,
        },
        sender: {
          name: settings.company.name.replace(/"/g, ""),
          phone: settings.company.phone,
          email: settings.company.email,
          street: wh.street,
          city: wh.city,
          postcode: wh.postcode,
          country: "LV",
        },
      });
    } catch (e) {
      throw new ActionError(e instanceof OmnivaError ? e.message : "Neizdevās sazināties ar Omniva.");
    }
    must(
      await supabase
        .from("orders")
        .update({ tracking_code: barcode, ...(markShipped && ["new", "confirmed", "processing"].includes(order.status) ? { status: "shipped" } : {}) })
        .eq("id", orderId),
    );
    must(
      await supabase.from("order_events").insert({ order_id: orderId, type: "shipment", message: `Omniva sūtījums ${barcode}`, created_by: user.id }),
    );
    revalidateAdmin();
    return { barcode };
  }, (d) => `Omniva sūtījums izveidots: ${d.barcode}`);
}
