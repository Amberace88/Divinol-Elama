"use server";

import { z } from "zod";
import { locales } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { notifyBusinessSignupIfNew, notifyInquiry } from "./notify";
import { deferEmail } from "./send";

/** Public Server Actions that need a shop notification (the DB write itself goes through the same RPCs as before). */

const inquirySchema = z.object({
  type: z.enum(["contact", "b2b", "quote", "oil_finder"]),
  name: z.string().trim().max(200),
  email: z.string().trim().max(200),
  phone: z.string().trim().max(50).optional(),
  company: z.string().trim().max(200).optional(),
  message: z.string().trim().max(5000).optional(),
  locale: z.enum(locales),
  extra: z
    .record(z.string().max(60), z.unknown())
    .optional()
    .refine((v) => !v || JSON.stringify(v).length <= 20_000, "too_large"),
});

export type InquiryActionResult = { ok: true } | { ok: false; code: "unavailable" | "invalid_email" | "failed" };

/** Stores an inquiry (`submit_inquiry` RPC, callable by anon) and notifies the shop after the response. */
export async function submitInquiryAction(input: z.input<typeof inquirySchema>): Promise<InquiryActionResult> {
  if (!isSupabaseConfigured) return { ok: false, code: "unavailable" };
  const parsed = inquirySchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: parsed.error.issues.some((i) => i.path[0] === "email") ? "invalid_email" : "failed" };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_inquiry", { payload: parsed.data });
    if (error) return { ok: false, code: /invalid_email/.test(error.message) ? "invalid_email" : "failed" };
    const d = parsed.data;
    deferEmail("inquiry", () =>
      notifyInquiry({
        id: typeof data === "string" ? data : null,
        type: d.type,
        name: d.name || "—",
        email: d.email,
        phone: d.phone || null,
        company: d.company || null,
        message: d.message || null,
        locale: d.locale,
        extra: d.extra ?? null,
      }),
    );
    return { ok: true };
  } catch {
    return { ok: false, code: "failed" };
  }
}

/** Called by the register form when sign-up returns a session right away (e-mail confirmation off). */
export async function notifyBusinessSignup(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = await createClient();
    deferEmail("b2b signup", () => notifyBusinessSignupIfNew(supabase));
  } catch {
    /* never surface e-mail problems to the visitor */
  }
}
