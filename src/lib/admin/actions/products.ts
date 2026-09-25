"use server";

import { z } from "zod";
import { issuesToFieldErrors, productSchema, type ProductPayload } from "../schemas";
import { ActionError, adminAction, must, revalidateAdmin, revalidateCatalog, UUID_RE } from "../server";

const id = z.string().regex(UUID_RE, "Nederīgs ID");
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export async function setProductFlag(productId: string, field: "is_active" | "is_featured", value: boolean) {
  return adminAction(
    async ({ supabase }) => {
      id.parse(productId);
      if (field !== "is_active" && field !== "is_featured") throw new ActionError("Nederīgs lauks");
      must(await supabase.from("products").update({ [field]: Boolean(value) }).eq("id", productId));
      revalidateCatalog();
      return null;
    },
    field === "is_active" ? (value ? "Produkts aktivizēts" : "Produkts paslēpts") : value ? "Pievienots izceltajiem" : "Noņemts no izceltajiem",
  );
}

export async function bulkSetProductsActive(ids: string[], value: boolean) {
  return adminAction(
    async ({ supabase }) => {
      const list = z.array(id).min(1, "Nav atlasītu produktu").max(500).parse(ids);
      must(await supabase.from("products").update({ is_active: Boolean(value) }).in("id", list));
      revalidateCatalog();
      return { count: list.length };
    },
    (d) => `${d.count} ${value ? "produkti aktivizēti" : "produkti paslēpti"}`,
  );
}

export async function checkSlugAvailable(slug: string, excludeId?: string | null) {
  return adminAction(async ({ supabase }) => {
    let q = supabase.from("products").select("id").eq("slug", slug.trim()).limit(1);
    if (excludeId && UUID_RE.test(excludeId)) q = q.neq("id", excludeId);
    const rows = must(await q) as { id: string }[] | null;
    return { available: !rows || rows.length === 0 };
  });
}

export async function saveProduct(input: ProductPayload) {
  return adminAction(
    async ({ supabase }) => {
      const parsed = productSchema.safeParse(input);
      if (!parsed.success) throw new ActionError("Pārbaudiet iezīmētos laukus", issuesToFieldErrors(parsed.error.issues));
      const p = parsed.data;

      const dup = must(await supabase.from("products").select("id").eq("slug", p.slug).limit(2)) as { id: string }[] | null;
      if ((dup ?? []).some((r) => r.id !== p.id)) throw new ActionError("Šāds slug jau eksistē", { slug: "Šāds slug jau eksistē — izvēlieties citu" });

      // Drop empty languages so the storefront falls back to en/lv instead of showing blanks.
      const i18n: Record<string, unknown> = {};
      for (const [lang, t] of Object.entries(p.i18n)) {
        if (t && t.name.trim()) i18n[lang] = { ...t, name: t.name.trim() };
      }

      const row = {
        slug: p.slug,
        base_sku: p.base_sku,
        category_id: p.category_id,
        sae: p.sae,
        iso_vg: p.iso_vg,
        specs: p.specs,
        oem_approvals: p.oem_approvals,
        performance: p.performance,
        images: p.images,
        i18n,
        tds_url: p.tds_url,
        sds_url: p.sds_url,
        is_active: p.is_active,
        is_featured: p.is_featured,
        sort: p.sort,
      };

      let productId = p.id ?? null;
      if (productId) {
        must(await supabase.from("products").update(row).eq("id", productId));
      } else {
        const created = must(await supabase.from("products").insert(row).select("id").single()) as { id: string };
        productId = created.id;
      }

      // Variants: delete removed → update existing → insert new.
      const existing = (must(await supabase.from("product_variants").select("id").eq("product_id", productId)) ?? []) as { id: string }[];
      const keep = new Set(p.variants.map((v) => v.id).filter(Boolean) as string[]);
      const remove = existing.map((e) => e.id).filter((vid) => !keep.has(vid));
      if (remove.length) must(await supabase.from("product_variants").delete().in("id", remove));

      const existingIds = new Set(existing.map((e) => e.id));
      for (const [i, v] of p.variants.entries()) {
        const vrow = {
          product_id: productId,
          sku: v.sku,
          size: v.size,
          unit: v.unit,
          price_net: round4(v.price_net),
          cost_net: v.cost_net == null ? null : round4(v.cost_net),
          stock: v.stock,
          in_stock: v.in_stock,
          is_active: v.is_active,
          image: v.image,
          weight_kg: v.weight_kg,
          sort: i,
        };
        if (v.id && existingIds.has(v.id)) must(await supabase.from("product_variants").update(vrow).eq("id", v.id));
        else must(await supabase.from("product_variants").insert(vrow));
      }

      revalidateCatalog();
      revalidateAdmin();
      return { id: productId, slug: p.slug, created: !p.id };
    },
    (d) => (d.created ? "Produkts izveidots" : "Produkts saglabāts"),
  );
}

export async function deleteProduct(productId: string) {
  return adminAction(async ({ supabase }) => {
    id.parse(productId);
    must(await supabase.from("products").delete().eq("id", productId));
    revalidateCatalog();
    return null;
  }, "Produkts dzēsts");
}
