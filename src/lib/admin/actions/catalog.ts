"use server";

import seedProducts from "@/data/products.seed.json";
import { categoriesSeed } from "@/data/categories";
import { BASE_VAT } from "@/lib/commerce";
import { ActionError, adminAction, must, revalidateAdmin, revalidateCatalog } from "../server";
import { isDeveloperEmail } from "../developer";

const CHUNK = 15;

type SeedVariant = { sku: string | null; size: number | null; unit: string; price_gross: number; in_stock: boolean; image: string | null };
type SeedProduct = Record<string, unknown> & { slug: string; variants: SeedVariant[] };

export type ImportChunkResult = {
  index: number;
  chunks: number;
  total: number;
  done: boolean;
  counts: { categories: number; products: number; variants: number };
};

/**
 * Imports one chunk (~15 products) of the bundled seed catalog through RPC `admin_import_catalog`.
 * Categories are sent only with the first chunk. Seed prices are gross incl. 21% LV VAT → stored as net (4 decimals).
 */
export async function importCatalogChunk(index: number) {
  return adminAction<ImportChunkResult>(async ({ supabase, user }) => {
    if (!isDeveloperEmail(user.email)) throw new ActionError("Kataloga importu var veikt tikai izstrādātājs.");
    const all = seedProducts as unknown as SeedProduct[];
    const chunks = Math.ceil(all.length / CHUNK);
    const i = Math.floor(Number(index));
    if (!Number.isFinite(i) || i < 0 || i >= chunks) throw new ActionError("Nederīga importa daļa");

    const products = all.slice(i * CHUNK, (i + 1) * CHUNK).map((p) => ({
      ...p,
      variants: p.variants.map((v) => ({
        sku: v.sku,
        size: v.size,
        unit: v.unit,
        price_net: Math.round((v.price_gross / (1 + BASE_VAT / 100)) * 10000) / 10000,
        in_stock: v.in_stock,
        image: v.image,
      })),
    }));
    const categories =
      i === 0 ? categoriesSeed.map((c) => ({ slug: c.slug, icon: c.icon, image: c.image ?? null, sort: c.sort, i18n: c.i18n })) : [];

    const res = must(await supabase.rpc("admin_import_catalog", { p_categories: categories, p_products: products })) as {
      categories: number;
      products: number;
      variants: number;
    } | null;

    const done = i + 1 >= chunks;
    if (done) {
      revalidateCatalog();
      revalidateAdmin();
    }
    return {
      index: i,
      chunks,
      total: all.length,
      done,
      counts: { categories: res?.categories ?? 0, products: res?.products ?? 0, variants: res?.variants ?? 0 },
    };
  });
}
