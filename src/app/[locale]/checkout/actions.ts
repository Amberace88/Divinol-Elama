"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const address = z
  .object({
    street: z.string().trim().max(200),
    city: z.string().trim().max(100),
    postal_code: z.string().trim().max(20),
    country: z.string().trim().max(2),
  })
  .nullable();

const schema = z.object({
  email: z.string().trim().max(200),
  phone: z.string().trim().max(50),
  market: z.enum(["LV", "EE", "LT"]),
  locale: z.string().max(5),
  customer: z.object({
    name: z.string().trim().max(200),
    company_name: z.string().trim().max(200).nullable(),
    reg_no: z.string().trim().max(50).nullable(),
    vat_no: z.string().trim().max(50).nullable(),
    customer_type: z.enum(["private", "business"]),
  }),
  shipping_method: z.enum(["pickup", "parcel_locker", "courier", "freight"]),
  shipping_point: z
    .object({
      provider: z.string().max(40),
      id: z.string().max(100).nullable(),
      name: z.string().trim().max(200),
      city: z.string().max(100).optional(),
      address: z.string().max(200).optional(),
    })
    .nullable(),
  shipping_address: address,
  billing_address: address,
  payment_method: z.enum(["bank_transfer", "card", "invoice", "cash_on_pickup"]),
  notes: z.string().max(2000).nullable(),
  items: z
    .array(
      z.object({
        slug: z.string().max(200),
        sku: z.string().max(100).nullable(),
        size: z.number().nullable(),
        unit: z.string().max(10),
        qty: z.number().int().min(1).max(999),
      }),
    )
    .min(1)
    .max(100),
});

export type PlaceOrderPayload = z.infer<typeof schema>;

export type PlaceOrderResult =
  | { ok: true; number: string; total: number; payment: string; invoice: string | null; reverseCharge: boolean }
  | { ok: false; code: string; slug?: string };

const KNOWN = new Set([
  "invalid_email",
  "empty_cart",
  "too_many_items",
  "invalid_payment",
  "invoice_not_allowed",
  "invalid_market",
  "invalid_shipping",
  "shipping_not_available",
  "shipping_item_too_large",
  "shipping_point_required",
  "address_required",
]);

/** Places the order through the `place_order` RPC with the visitor's session (so auth.uid() links the order). */
export async function placeOrder(input: PlaceOrderPayload): Promise<PlaceOrderResult> {
  if (!isSupabaseConfigured) return { ok: false, code: "unavailable" };
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { ok: false, code: field === "items" ? "empty_cart" : field === "email" ? "invalid_email" : "generic" };
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("place_order", { payload: parsed.data });
    if (error) {
      const msg = error.message ?? "";
      const notFound = msg.match(/product_not_found:(\S*)/);
      if (notFound) return { ok: false, code: "product_not_found", slug: notFound[1] };
      const code = [...KNOWN].find((k) => msg.includes(k));
      return { ok: false, code: code ?? "generic" };
    }
    const r = data as {
      number: string;
      total_gross: number | string;
      payment_method: string;
      invoice_number: string | null;
      reverse_charge: boolean;
    };
    return {
      ok: true,
      number: r.number,
      total: Number(r.total_gross),
      payment: r.payment_method,
      invoice: r.invoice_number ?? null,
      reverseCharge: Boolean(r.reverse_charge),
    };
  } catch {
    return { ok: false, code: "generic" };
  }
}
