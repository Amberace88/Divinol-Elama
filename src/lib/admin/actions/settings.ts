"use server";

import { z } from "zod";
import { issuesToFieldErrors } from "../schemas";
import { ActionError, adminAction, must, revalidateAdmin, revalidateSettings } from "../server";

const s = (max: number) => z.string().trim().max(max, `Maksimums ${max} simboli`);
const market3 = (schema: z.ZodNumber) => z.object({ LV: schema, EE: schema, LT: schema });
const money = z.number({ error: "Ievadiet skaitli" }).min(0, "Nevar būt negatīvs").max(100000);
const MARKET = z.enum(["LV", "EE", "LT"]);

const schemas = {
  company: z.object({
    name: s(200).min(1, "Nosaukums ir obligāts"),
    reg_no: s(40),
    vat_no: s(40),
    address: s(300),
    warehouse: s(300),
    phone: s(60),
    email: s(200).refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Nederīgs e-pasts"),
    bank_name: s(120),
    iban: s(60).transform((v) => v.replace(/\s+/g, " ").toUpperCase()),
    swift: s(20).transform((v) => v.toUpperCase()),
    hours: s(300),
  }),
  vat: market3(z.number({ error: "Ievadiet likmi" }).min(0, "0–50%").max(50, "0–50%")),
  shipping: z.object({
    free_threshold: market3(money),
    methods: z.record(
      z.enum(["pickup", "parcel_locker", "courier", "freight"]),
      z.object({
        enabled: z.boolean(),
        price_net: money.nullable(),
        markets: z.array(MARKET),
        max_item: z.number().positive().max(10000).nullable().optional(),
        free_over: z.boolean().optional(),
        surcharge: z.object({ LV: money, EE: money, LT: money }).partial().optional(),
      }),
    ),
  }),
  invoice: z.object({
    due_days_default: z.number({ error: "Ievadiet dienas" }).int().min(0, "0–120").max(120, "0–120"),
    notes: s(1000),
    /** read by ensure_final_invoice() (migration 0010); missing = on */
    auto_final_invoice: z.boolean().default(true),
  }),
} as const;

export type SettingsKey = keyof typeof schemas;
const PUBLIC: Record<SettingsKey, boolean> = { company: true, vat: true, shipping: true, invoice: false };
const LABEL: Record<SettingsKey, string> = { company: "Uzņēmuma rekvizīti", vat: "PVN likmes", shipping: "Piegādes iestatījumi", invoice: "Rēķinu iestatījumi" };

export async function saveSettings(key: SettingsKey, value: unknown) {
  return adminAction(async ({ supabase }) => {
    const schema = schemas[key];
    if (!schema) throw new ActionError("Nezināms iestatījums");
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new ActionError("Pārbaudiet iezīmētos laukus", issuesToFieldErrors(parsed.error.issues));
    let data: unknown = parsed.data;
    if (key === "shipping") {
      // Drop undefined / null optional keys so the JSON stays clean for place_order().
      const sh = parsed.data as z.output<typeof schemas.shipping>;
      data = {
        free_threshold: sh.free_threshold,
        methods: Object.fromEntries(
          Object.entries(sh.methods).map(([id, m]) => [
            id,
            Object.fromEntries(Object.entries(m).filter(([k, v]) => v !== undefined && !(k === "max_item" && v === null))),
          ]),
        ),
      };
    }
    must(
      await supabase
        .from("settings")
        .upsert({ key, value: data, is_public: PUBLIC[key], updated_at: new Date().toISOString() }, { onConflict: "key" }),
    );
    revalidateSettings();
    revalidateAdmin();
    return null;
  }, `${LABEL[key] ?? "Iestatījumi"} saglabāti`);
}
