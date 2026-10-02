"use server";

import { z } from "zod";
import { BADGE_KEYS } from "@/lib/promo";
import { issuesToFieldErrors, productSchema, promoSchema, type ProductPayload } from "../schemas";
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

export async function bulkSetProductsFeatured(ids: string[], value: boolean) {
  return adminAction(
    async ({ supabase }) => {
      const list = z.array(id).min(1, "Nav atlasītu produktu").max(500).parse(ids);
      must(await supabase.from("products").update({ is_featured: Boolean(value) }).in("id", list));
      revalidateCatalog();
      return { count: list.length };
    },
    (d) => `${d.count} ${value ? "produkti izcelti" : "produkti noņemti no izceltajiem"}`,
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
        badges: [...new Set(p.badges)],
        promo_type: p.promo_type,
        promo_percent: p.promo_type ? p.promo_percent : null,
        promo_starts_at: p.promo_type ? p.promo_starts_at : null,
        promo_ends_at: p.promo_type ? p.promo_ends_at : null,
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
          // in_stock is derived from availability by a DB trigger
          availability: v.availability,
          lead_time_days: v.availability === "on_order" || v.availability === "out_of_stock" ? v.lead_time_days : null,
          low_stock_threshold: v.low_stock_threshold,
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

// ───────────────────────── promotions & badges (bulk) ─────────────────────────

/** Sets (or with `promo = null` removes) the same promotion on many products. */
export async function bulkSetPromo(ids: string[], promo: z.input<typeof promoSchema> | null) {
  return adminAction(
    async ({ supabase }) => {
      const list = z.array(id).min(1, "Nav atlasītu produktu").max(500).parse(ids);
      let row: Record<string, unknown> = { promo_type: null, promo_percent: null, promo_starts_at: null, promo_ends_at: null };
      if (promo) {
        const parsed = promoSchema.safeParse(promo);
        if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Pārbaudiet akcijas laukus", issuesToFieldErrors(parsed.error.issues));
        const p = parsed.data;
        if (!p.promo_type) throw new ActionError("Izvēlieties akcijas veidu");
        row = { promo_type: p.promo_type, promo_percent: p.promo_percent, promo_starts_at: p.promo_starts_at, promo_ends_at: p.promo_ends_at };
      }
      must(await supabase.from("products").update(row).in("id", list));
      revalidateCatalog();
      revalidateAdmin();
      return { count: list.length, removed: !promo };
    },
    (d) => (d.removed ? `Akcija noņemta ${d.count} produktiem` : `Akcija piemērota ${d.count} produktiem`),
  );
}

/** Adds or removes one badge on many products. */
export async function bulkToggleBadge(ids: string[], badge: string, add: boolean) {
  return adminAction(
    async ({ supabase }) => {
      const list = z.array(id).min(1, "Nav atlasītu produktu").max(500).parse(ids);
      const b = z.enum(BADGE_KEYS).parse(badge);
      const rows = (must(await supabase.from("products").select("id, badges").in("id", list)) ?? []) as { id: string; badges: string[] | null }[];
      // group products by their resulting badge set → one update per distinct set
      const groups = new Map<string, { badges: string[]; ids: string[] }>();
      for (const r of rows) {
        const cur = new Set(r.badges ?? []);
        if (add) cur.add(b);
        else cur.delete(b);
        const next = BADGE_KEYS.filter((k) => cur.has(k));
        const key = next.join(",");
        if (!groups.has(key)) groups.set(key, { badges: next, ids: [] });
        groups.get(key)!.ids.push(r.id);
      }
      for (const g of groups.values()) must(await supabase.from("products").update({ badges: g.badges }).in("id", g.ids));
      revalidateCatalog();
      revalidateAdmin();
      return { count: rows.length };
    },
    (d) => `${add ? "Nozīmīte pievienota" : "Nozīmīte noņemta"} — ${d.count} produkti`,
  );
}
