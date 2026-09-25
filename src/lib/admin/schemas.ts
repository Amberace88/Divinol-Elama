import { z } from "zod";

/** Validation shared by admin client forms and Server Actions (client-safe). */
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Nederīgs ID");
const optText = (max: number) => z.string().trim().max(max, `Maksimums ${max} simboli`);
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimums ${max} simboli`)
    .nullable()
    .transform((v) => (v ? v : null));

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const slugSchema = z
  .string()
  .trim()
  .min(2, "Slug ir pārāk īss")
  .max(120, "Slug ir pārāk garš")
  .regex(SLUG_RE, "Atļauti tikai mazie latīņu burti, cipari un domuzīmes");

export const productTextSchema = z.object({
  name: optText(200),
  type: optText(200),
  short: optText(1000),
  description: z.string().max(60000, "Apraksts ir pārāk garš"),
  meta_title: optText(160),
  meta_description: optText(400),
});

export const LANG_KEYS = ["lv", "et", "lt", "en", "ru"] as const;

export const variantSchema = z.object({
  id: uuid.nullable().optional(),
  sku: nullableText(60),
  size: z.number({ error: "Nederīgs izmērs" }).positive("Izmēram jābūt > 0").max(100000).nullable(),
  unit: z.enum(["l", "kg", "pcs"], { error: "Nederīga mērvienība" }),
  price_net: z.number({ error: "Norādiet cenu" }).min(0, "Cena nevar būt negatīva").max(1_000_000),
  cost_net: z.number({ error: "Nederīga pašizmaksa" }).min(0).max(1_000_000).nullable(),
  stock: z.number({ error: "Nederīgs atlikums" }).int("Atlikumam jābūt veselam skaitlim").min(0, "Atlikums nevar būt negatīvs").nullable(),
  in_stock: z.boolean(),
  is_active: z.boolean(),
  image: z.string().max(1000).nullable(),
  weight_kg: z.number().min(0).max(100000).nullable(),
  sort: z.number().int(),
});

export const productSchema = z
  .object({
    id: uuid.nullable().optional(),
    slug: slugSchema,
    base_sku: nullableText(40),
    category_id: uuid.nullable(),
    sae: nullableText(40),
    iso_vg: nullableText(20),
    specs: z.array(z.string().trim().min(1).max(120)).max(100),
    oem_approvals: z.array(z.string().trim().min(1).max(120)).max(200),
    performance: z.array(z.string().trim().min(1).max(120)).max(100),
    images: z.array(z.string().min(1).max(1000)).max(30, "Maksimums 30 attēli"),
    i18n: z.object({
      lv: productTextSchema.extend({ name: optText(200).min(1, "Latviešu nosaukums ir obligāts") }),
      et: productTextSchema.optional(),
      lt: productTextSchema.optional(),
      en: productTextSchema.optional(),
      ru: productTextSchema.optional(),
    }),
    tds_url: nullableText(1000),
    sds_url: nullableText(1000),
    is_active: z.boolean(),
    is_featured: z.boolean(),
    sort: z.number().int().min(-100000).max(100000),
    variants: z.array(variantSchema).min(1, "Pievienojiet vismaz vienu variantu").max(50),
  })
  .superRefine((p, ctx) => {
    const seen = new Map<string, number>();
    p.variants.forEach((v, i) => {
      if (!v.sku) return;
      const k = v.sku.toLowerCase();
      if (seen.has(k)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: `SKU dublējas ar ${seen.get(k)! + 1}. variantu` });
      else seen.set(k, i);
    });
  });

export type ProductPayload = z.input<typeof productSchema>;
export type ProductParsed = z.output<typeof productSchema>;

export const categorySchema = z.object({
  id: uuid.nullable().optional(),
  slug: slugSchema,
  icon: z.enum(["car", "truck", "bike", "cog", "gauge", "factory", "droplets", "spray", "snowflake", "hardhat"]),
  image: nullableText(1000),
  is_active: z.boolean(),
  i18n: z.partialRecord(
    z.enum(LANG_KEYS),
    z.object({ name: optText(160), description: optText(2000), seo_text: optText(20000).optional() }),
  ),
});
export type CategoryPayload = z.input<typeof categorySchema>;

/** Converts zod issues to { "a.b.0.c": "message" }. */
export function issuesToFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.map(String).join(".");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}
