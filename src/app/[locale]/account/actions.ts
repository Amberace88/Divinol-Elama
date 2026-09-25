"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { locales } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { deferEmail } from "@/lib/email/send";
import { notifyBusinessApplication } from "@/lib/email/notify";
import type { ActionResult } from "@/components/account/types";

const trimmed = (max: number) => z.string().trim().max(max);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

async function session() {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, user: data.user } : null;
}

function done(): ActionResult {
  revalidatePath("/[locale]/account", "layout");
  return { ok: true };
}

// ───────────── profile ─────────────

const profileSchema = z.object({
  full_name: trimmed(120).min(1),
  phone: optional(40),
  preferred_locale: z.enum(locales),
  market: z.enum(["LV", "EE", "LT"]),
  marketing_consent: z.boolean(),
});

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const s = await session();
  if (!s) return { ok: false, error: "unauthorized" };
  // role / discount / payment terms / b2b approval are additionally protected by a DB trigger.
  const { error } = await s.supabase.from("profiles").update(parsed.data).eq("id", s.user.id);
  if (error) return { ok: false, error: "generic" };
  return done();
}

// ───────────── addresses ─────────────

const addressSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  label: optional(60),
  name: trimmed(120).min(1),
  company: optional(160),
  phone: optional(40),
  street: trimmed(200).min(1),
  city: trimmed(100).min(1),
  postal_code: trimmed(20).min(1),
  country: z.enum(["LV", "EE", "LT"]),
  is_default: z.boolean(),
});

export async function saveAddress(input: z.input<typeof addressSchema>): Promise<ActionResult> {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const s = await session();
  if (!s) return { ok: false, error: "unauthorized" };
  const { id, ...fields } = parsed.data;

  // The first address automatically becomes the default one.
  let isDefault = fields.is_default;
  if (!isDefault && !id) {
    const { count } = await s.supabase.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", s.user.id);
    if (!count) isDefault = true;
  }
  if (isDefault) {
    const reset = s.supabase.from("addresses").update({ is_default: false }).eq("user_id", s.user.id);
    const { error } = id ? await reset.neq("id", id) : await reset;
    if (error) return { ok: false, error: "generic" };
  }

  const row = { ...fields, is_default: isDefault };
  const { error } = id
    ? await s.supabase.from("addresses").update(row).eq("id", id).eq("user_id", s.user.id)
    : await s.supabase.from("addresses").insert({ ...row, user_id: s.user.id });
  if (error) return { ok: false, error: "generic" };
  return done();
}

export async function deleteAddress(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "invalid" };
  const s = await session();
  if (!s) return { ok: false, error: "unauthorized" };
  const { data: removed, error } = await s.supabase
    .from("addresses")
    .delete()
    .eq("id", id)
    .eq("user_id", s.user.id)
    .select("is_default")
    .maybeSingle();
  if (error) return { ok: false, error: "generic" };
  // Promote the newest remaining address when the default one was removed.
  if (removed?.is_default) {
    const { data: nextDefault } = await s.supabase
      .from("addresses")
      .select("id")
      .eq("user_id", s.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (nextDefault) await s.supabase.from("addresses").update({ is_default: true }).eq("id", nextDefault.id);
  }
  return done();
}

export async function setDefaultAddress(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "invalid" };
  const s = await session();
  if (!s) return { ok: false, error: "unauthorized" };
  const { error: e1 } = await s.supabase.from("addresses").update({ is_default: false }).eq("user_id", s.user.id).neq("id", id);
  if (e1) return { ok: false, error: "generic" };
  const { error: e2 } = await s.supabase.from("addresses").update({ is_default: true }).eq("id", id).eq("user_id", s.user.id);
  if (e2) return { ok: false, error: "generic" };
  return done();
}

// ───────────── business / B2B application ─────────────

const businessSchema = z.object({
  company_name: trimmed(160).min(2),
  reg_no: trimmed(40).min(3),
  vat_no: optional(40),
  legal_address: trimmed(300).min(3),
  phone: optional(40),
});

export async function submitBusiness(input: z.input<typeof businessSchema>): Promise<ActionResult> {
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const s = await session();
  if (!s) return { ok: false, error: "unauthorized" };

  const { data: current, error: readError } = await s.supabase
    .from("profiles")
    .select("b2b_status")
    .eq("id", s.user.id)
    .maybeSingle();
  if (readError || !current) return { ok: false, error: "generic" };
  if (current.b2b_status === "approved") return { ok: false, error: "locked" };

  const { phone, ...company } = parsed.data;
  const { error } = await s.supabase
    .from("profiles")
    .update({
      ...company,
      ...(phone ? { phone } : {}),
      customer_type: "business",
      // none / rejected → pending is the only transition customers may make (enforced by a DB trigger too).
      b2b_status: "pending",
    })
    .eq("id", s.user.id);
  if (error) return { ok: false, error: "generic" };
  // new application → notify the shop (after the response)
  if (current.b2b_status !== "pending") deferEmail("b2b application", () => notifyBusinessApplication(s.supabase, s.user.id, "account"));
  return done();
}
