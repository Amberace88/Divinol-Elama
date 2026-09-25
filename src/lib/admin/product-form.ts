import "server-only";
import type { ProductFormInit, ProductText } from "@/components/admin/products/ProductEditor";
import type { VariantState } from "@/components/admin/products/VariantsEditor";
import { BASE_VAT } from "@/lib/commerce";
import { LANGS } from "./labels";

type DbVariant = {
  id: string;
  sku: string | null;
  size: number | string | null;
  unit: string;
  price_net: number | string;
  cost_net: number | string | null;
  stock: number | null;
  in_stock: boolean;
  is_active: boolean;
  image: string | null;
  weight_kg: number | string | null;
  sort: number;
};
export type DbProduct = {
  id: string;
  slug: string;
  base_sku: string | null;
  category_id: string | null;
  sae: string | null;
  iso_vg: string | null;
  specs: string[] | null;
  oem_approvals: string[] | null;
  performance: string[] | null;
  images: string[] | null;
  i18n: Record<string, Partial<ProductText>> | null;
  legacy_slugs: string[] | null;
  tds_url: string | null;
  sds_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  sort: number;
  updated_at: string;
  product_variants: DbVariant[] | null;
};

const dec = (n: number, max: number) =>
  new Intl.NumberFormat("lv-LV", { minimumFractionDigits: 2, maximumFractionDigits: max, useGrouping: false }).format(n);

function text(t: Partial<ProductText> | undefined): ProductText {
  return {
    name: t?.name ?? "",
    type: t?.type ?? "",
    short: t?.short ?? "",
    description: t?.description ?? "",
    meta_title: t?.meta_title ?? "",
    meta_description: t?.meta_description ?? "",
  };
}

export function dbToForm(p: DbProduct): ProductFormInit {
  const k = 1 + BASE_VAT / 100;
  const variants: VariantState[] = [...(p.product_variants ?? [])]
    .sort((a, b) => a.sort - b.sort || Number(a.size ?? 0) - Number(b.size ?? 0))
    .map((v) => {
      const net = Number(v.price_net);
      return {
        key: v.id,
        id: v.id,
        sku: v.sku ?? "",
        size: v.size == null ? "" : String(Number(v.size)).replace(".", ","),
        unit: (["l", "kg", "pcs"].includes(v.unit) ? v.unit : "l") as VariantState["unit"],
        gross: dec(Math.round(net * k * 100) / 100, 2),
        net: dec(net, 4),
        cost: v.cost_net == null ? "" : dec(Number(v.cost_net), 4),
        stock: v.stock == null ? "" : String(v.stock),
        in_stock: v.in_stock,
        is_active: v.is_active,
        image: v.image,
        weight_kg: v.weight_kg == null ? null : Number(v.weight_kg),
      };
    });
  return {
    id: p.id,
    slug: p.slug,
    base_sku: p.base_sku ?? "",
    category_id: p.category_id ?? "",
    sae: p.sae ?? "",
    iso_vg: p.iso_vg ?? "",
    specs: p.specs ?? [],
    oem_approvals: p.oem_approvals ?? [],
    performance: p.performance ?? [],
    images: p.images ?? [],
    i18n: Object.fromEntries(LANGS.map((l) => [l, text(p.i18n?.[l])])) as ProductFormInit["i18n"],
    tds_url: p.tds_url ?? "",
    sds_url: p.sds_url ?? "",
    is_active: p.is_active,
    is_featured: p.is_featured,
    sort: p.sort ?? 0,
    variants,
    legacy_slugs: p.legacy_slugs ?? [],
  };
}

export function emptyForm(): ProductFormInit {
  return {
    id: null,
    slug: "",
    base_sku: "",
    category_id: "",
    sae: "",
    iso_vg: "",
    specs: [],
    oem_approvals: [],
    performance: [],
    images: [],
    i18n: Object.fromEntries(LANGS.map((l) => [l, text(undefined)])) as ProductFormInit["i18n"],
    tds_url: "",
    sds_url: "",
    is_active: true,
    is_featured: false,
    sort: 0,
    variants: [
      { key: "v-new-1", id: null, sku: "", size: "", unit: "l", gross: "", net: "", cost: "", stock: "", in_stock: true, is_active: true, image: null, weight_kg: null },
    ],
    legacy_slugs: [],
  };
}

export const PRODUCT_SELECT =
  "id, slug, base_sku, category_id, sae, iso_vg, specs, oem_approvals, performance, images, i18n, legacy_slugs, tds_url, sds_url, is_active, is_featured, sort, updated_at, product_variants(id, sku, size, unit, price_net, cost_net, stock, in_stock, is_active, image, weight_kg, sort)";
