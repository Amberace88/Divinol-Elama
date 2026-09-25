import "server-only";
import { unstable_cache } from "next/cache";
import seedProducts from "@/data/products.seed.json";
import { categoriesSeed } from "@/data/categories";
import { BASE_VAT } from "./commerce";
import { createPublicClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";
import type { Category, Product, ProductI18n, Variant } from "./types";
import type { Locale } from "@/i18n/routing";

export const CATALOG_TAG = "catalog";

type SeedVariant = { sku: string | null; size: number | null; unit: string; price_gross: number; in_stock: boolean; image: string | null };
type SeedProduct = Omit<Product, "variants"> & { variants: SeedVariant[] };

function seedCatalog(): { products: Product[]; categories: Category[] } {
  const products = (seedProducts as unknown as SeedProduct[]).map((p) => ({
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
  return { products, categories: categoriesSeed };
}

type DbVariant = {
  id: string; sku: string | null; size: number | null; unit: string; price_net: number | string;
  in_stock: boolean; stock: number | null; image: string | null; sort: number; is_active: boolean;
  availability?: Variant["availability"]; lead_time_days?: number | null;
};
type DbProduct = {
  id: string; slug: string; base_sku: string | null; sae: string | null; iso_vg: string | null;
  specs: string[]; oem_approvals: string[]; performance: string[]; images: string[];
  i18n: Partial<Record<Locale, ProductI18n>>; is_featured: boolean; tds_url: string | null; sds_url: string | null;
  sort: number; categories: { slug: string } | null; product_variants: DbVariant[];
};

async function loadFromDb(): Promise<{ products: Product[]; categories: Category[] } | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const sb = createPublicClient();
    const [{ data: cats, error: ce }, { data: prods, error: pe }] = await Promise.all([
      sb.from("categories").select("id, slug, icon, image, sort, i18n").eq("is_active", true).order("sort"),
      sb
        .from("products")
        .select("id, slug, base_sku, sae, iso_vg, specs, oem_approvals, performance, images, i18n, is_featured, tds_url, sds_url, sort, categories(slug), product_variants(id, sku, size, unit, price_net, in_stock, stock, availability, lead_time_days, image, sort, is_active)")
        .eq("is_active", true)
        .order("sort")
        .order("slug"),
    ]);
    if (ce || pe || !prods || prods.length === 0) return null;
    // A product whose every active pack is discontinued disappears from the storefront.
    const sellable = (prods as unknown as DbProduct[]).filter(
      (p) => !(p.product_variants ?? []).some((v) => v.is_active) || (p.product_variants ?? []).some((v) => v.is_active && v.availability !== "discontinued"),
    );
    const products: Product[] = sellable.map((p) => ({
      id: p.id,
      slug: p.slug,
      base_sku: p.base_sku,
      category: p.categories?.slug ?? "",
      sae: p.sae,
      iso_vg: p.iso_vg,
      specs: p.specs ?? [],
      oem_approvals: p.oem_approvals ?? [],
      performance: p.performance ?? [],
      images: p.images ?? [],
      i18n: p.i18n ?? {},
      is_featured: p.is_featured,
      tds_url: p.tds_url,
      sds_url: p.sds_url,
      variants: (p.product_variants ?? [])
        // discontinued variants are hidden from the storefront (and rejected by place_order)
        .filter((v) => v.is_active && v.availability !== "discontinued")
        .sort((a, b) => a.sort - b.sort || Number(a.size ?? 0) - Number(b.size ?? 0))
        .map<Variant>((v) => ({
          id: v.id,
          sku: v.sku,
          size: v.size == null ? null : Number(v.size),
          unit: v.unit,
          price_net: Number(v.price_net),
          in_stock: v.in_stock,
          stock: v.stock,
          availability: v.availability,
          lead_time_days: v.lead_time_days ?? null,
          image: v.image,
        })),
    }));
    return { products, categories: (cats ?? []) as Category[] };
  } catch {
    return null;
  }
}

const getCatalog = unstable_cache(
  async () => (await loadFromDb()) ?? seedCatalog(),
  ["catalog-v1"],
  { tags: [CATALOG_TAG], revalidate: 3600 },
);

export async function getCategories() {
  return (await getCatalog()).categories;
}

export async function getProducts() {
  return (await getCatalog()).products;
}

export async function getProduct(slug: string) {
  return (await getProducts()).find((p) => p.slug === slug) ?? null;
}

export async function getCategory(slug: string) {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}

export function t18<T>(obj: Partial<Record<Locale, T>> | undefined, locale: Locale): T | undefined {
  if (!obj) return undefined;
  return obj[locale] ?? obj.en ?? obj.lv;
}

export function productText(p: Product, locale: Locale): ProductI18n {
  return (
    t18(p.i18n, locale) ?? { name: p.slug, type: "", short: "", description: "", meta_title: p.slug, meta_description: "" }
  );
}

/** Lightweight product shape for client components (cards, filters, finder). */
export type ProductSummary = {
  slug: string;
  name: string;
  type: string;
  short: string;
  category: string;
  sae: string | null;
  iso_vg: string | null;
  specs: string[];
  approvals: string[];
  image: string | null;
  featured: boolean;
  variants: { key: string; sku: string | null; size: number | null; unit: string; price_net: number; in_stock: boolean; image: string | null }[];
};

export function summarize(p: Product, locale: Locale): ProductSummary {
  const t = productText(p, locale);
  return {
    slug: p.slug,
    name: t.name,
    type: t.type,
    short: t.short,
    category: p.category,
    sae: p.sae,
    iso_vg: p.iso_vg,
    specs: p.specs,
    approvals: [...p.oem_approvals, ...p.performance],
    image: p.images[0] ?? p.variants.find((v) => v.image)?.image ?? null,
    featured: Boolean(p.is_featured),
    variants: p.variants.map((v) => ({
      key: v.sku ?? `${v.size ?? "x"}${v.unit}`,
      sku: v.sku,
      size: v.size,
      unit: v.unit,
      price_net: v.price_net,
      in_stock: v.in_stock,
      image: v.image,
    })),
  };
}
