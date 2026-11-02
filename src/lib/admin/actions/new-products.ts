"use server";

import batch from "@/data/zg-2026-10.json";
import { ActionError, adminAction, must, revalidateAdmin, revalidateCatalog } from "../server";
import { isDeveloperEmail } from "../developer";
import { BATCH_ID, BATCHES } from "../handover";

/**
 * One-off import of the Divinol products SIA Elama asked for (Oct 2026): product data from zeller-gmelin.de,
 * texts in 5 languages. Products are created as DRAFTS (hidden, price 0 €, badge "Jaunums") and are reviewed and
 * priced on Produkti → Jaunie. Idempotent: products that already exist (same article no. or slug) are skipped.
 */
type Row = {
  art: string;
  slug: string;
  category: string;
  sae: string | null;
  specs: string[];
  oem: string[];
  perf: string[];
  i18n: Record<string, Record<string, string>>;
  packs: number[];
};

const ROWS = batch as unknown as Row[];
/** already in the catalogue without an article number → completed instead of duplicated */
const UPDATE_EXISTING: Record<string, string> = { "52020": "divinol-synthogear-int-sae-75w-80" };

export async function batchStatus() {
  return adminAction(async ({ supabase }) => {
    const arts = ROWS.map((r) => r.art);
    const have = (must(await supabase.from("products").select("base_sku").in("base_sku", arts)) ?? []) as { base_sku: string }[];
    return { total: ROWS.length, imported: have.length };
  });
}

export async function importNewProducts() {
  return adminAction(
    async ({ supabase, user }) => {
      if (!isDeveloperEmail(user.email)) throw new ActionError("Importu var veikt tikai izstrādātājs.");
      const cats = (must(await supabase.from("categories").select("id, slug")) ?? []) as { id: string; slug: string }[];
      const catId = new Map(cats.map((c) => [c.slug, c.id]));
      const existing = (must(await supabase.from("products").select("id, slug, base_sku, category_id, sort")) ?? []) as {
        id: string;
        slug: string;
        base_sku: string | null;
        category_id: string | null;
        sort: number;
      }[];
      const bySku = new Set(existing.map((e) => e.base_sku).filter(Boolean));
      const bySlug = new Map(existing.map((e) => [e.slug, e]));
      const maxSort = new Map<string, number>();
      for (const e of existing) if (e.category_id) maxSort.set(e.category_id, Math.max(maxSort.get(e.category_id) ?? 0, e.sort ?? 0));

      let created = 0;
      let updated = 0;
      let variants = 0;
      const skipped: string[] = [];
      for (const r of ROWS) {
        const content = {
          base_sku: r.art,
          sae: r.sae,
          specs: r.specs,
          oem_approvals: r.oem,
          performance: r.perf,
          i18n: r.i18n,
        };
        const upd = UPDATE_EXISTING[r.art];
        if (upd && bySlug.has(upd) && !bySku.has(r.art)) {
          must(await supabase.from("products").update(content).eq("id", bySlug.get(upd)!.id));
          updated++;
          continue;
        }
        if (bySku.has(r.art) || bySlug.has(r.slug)) {
          skipped.push(r.art);
          continue;
        }
        const cid = catId.get(r.category);
        if (!cid) throw new ActionError(`Kategorija nav atrasta: ${r.category}`);
        const sort = (maxSort.get(cid) ?? 0) + 1;
        maxSort.set(cid, sort);
        const p = must(
          await supabase
            .from("products")
            .insert({ ...content, slug: r.slug, category_id: cid, images: [], is_active: false, is_featured: false, badges: ["new"], sort })
            .select("id")
            .single(),
        ) as { id: string };
        must(
          await supabase.from("product_variants").insert(
            r.packs.map((size, i) => ({
              product_id: p.id,
              sku: `${r.art}-${size}`,
              size,
              unit: "l",
              price_net: 0,
              availability: "in_stock",
              is_active: true,
              sort: i,
            })),
          ),
        );
        created++;
        variants += r.packs.length;
      }
      revalidateCatalog();
      revalidateAdmin();
      return { created, updated, variants, skipped };
    },
    (d) => `Pievienoti ${d.created} produkti (${d.variants} iepakojumi)${d.updated ? `, papildināti ${d.updated}` : ""}${d.skipped.length ? `, jau bija ${d.skipped.length}` : ""}`,
  );
}

/** "Nodot klientam": makes the batch visible to the shop owner's admin (or hides it again with `handed = false`). */
export async function setBatchHandover(handed: boolean, batchId: string = BATCH_ID) {
  return adminAction(
    async ({ supabase, user }) => {
      if (!isDeveloperEmail(user.email)) throw new ActionError("To var tikai izstrādātājs.");
      if (!BATCHES.some((b) => b.id === batchId)) throw new ActionError("Nezināma pakete");
      const { data } = await supabase.from("settings").select("value").eq("key", "handover").maybeSingle<{ value: Record<string, string> | null }>();
      const value: Record<string, string> = { ...(data?.value ?? {}) };
      if (handed) value[batchId] = new Date().toISOString();
      else delete value[batchId];
      must(await supabase.from("settings").upsert({ key: "handover", value, is_public: false }, { onConflict: "key" }));
      revalidateAdmin();
      return { handed };
    },
    (d) => (d.handed ? "Nodots klientam — Arnis tagad redz jaunos produktus" : "Atkal paslēpts no klienta"),
  );
}
