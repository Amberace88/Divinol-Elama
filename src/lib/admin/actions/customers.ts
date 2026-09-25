"use server";

import { z } from "zod";
import { issuesToFieldErrors } from "../schemas";
import { ActionError, adminAction, must, revalidateAdmin, UUID_RE } from "../server";

const id = z.string().regex(UUID_RE, "Nederīgs ID");
const txt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimums ${max} simboli`)
    .transform((v) => v || null)
    .nullable()
    .optional();

const customerPatch = z.object({
  full_name: txt(200),
  phone: txt(50),
  customer_type: z.enum(["private", "business"]).optional(),
  company_name: txt(200),
  reg_no: txt(40),
  vat_no: txt(40),
  legal_address: txt(400),
  market: z.enum(["LV", "EE", "LT"]).optional(),
  b2b_status: z.enum(["none", "pending", "approved", "rejected"]).optional(),
  discount_percent: z.number({ error: "Nederīga atlaide" }).min(0, "Atlaide 0–90%").max(90, "Atlaide 0–90%").optional(),
  payment_terms_days: z.number({ error: "Nederīgs termiņš" }).int().min(0, "Termiņš 0–120 dienas").max(120, "Termiņš 0–120 dienas").optional(),
  role: z.enum(["customer", "admin"]).optional(),
  admin_notes: txt(5000),
});
export type CustomerPatch = z.input<typeof customerPatch>;

export async function updateCustomer(customerId: string, patch: CustomerPatch) {
  return adminAction(async ({ supabase, user }) => {
    id.parse(customerId);
    const parsed = customerPatch.safeParse(patch);
    if (!parsed.success) throw new ActionError("Pārbaudiet iezīmētos laukus", issuesToFieldErrors(parsed.error.issues));
    const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
    if (customerId === user.id && data.role && data.role !== "admin") throw new ActionError("Nevar noņemt administratora tiesības pašam sev.");
    if (!Object.keys(data).length) return null;
    const res = must(await supabase.from("profiles").update(data).eq("id", customerId).select("id")) as { id: string }[] | null;
    if (!res?.length) throw new ActionError("Klients nav atrasts vai nav tiesību to labot");
    revalidateAdmin();
    return null;
  }, "Klienta dati saglabāti");
}

export async function decideB2B(customerId: string, decision: "approved" | "rejected", discount?: number, termsDays?: number) {
  return adminAction(async ({ supabase }) => {
    id.parse(customerId);
    if (decision !== "approved" && decision !== "rejected") throw new ActionError("Nederīgs lēmums");
    const patch: Record<string, unknown> = { b2b_status: decision };
    if (decision === "approved") {
      patch.customer_type = "business";
      if (discount != null) patch.discount_percent = z.number().min(0).max(90).parse(discount);
      if (termsDays != null) patch.payment_terms_days = z.number().int().min(0).max(120).parse(termsDays);
    }
    must(await supabase.from("profiles").update(patch).eq("id", customerId));
    revalidateAdmin();
    return null;
  }, decision === "approved" ? "B2B statuss apstiprināts" : "B2B pieteikums noraidīts");
}
