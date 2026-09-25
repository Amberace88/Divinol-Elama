import type { ProductSummary } from "@/lib/catalog";
import { displayPrice, packLabel, pricePerUnit, type PriceContext } from "@/lib/commerce";
import { normalize, scoreDoc } from "@/lib/shop/search";

export type SortKey = "popular" | "price-asc" | "price-desc" | "name";
export const SORTS: SortKey[] = ["popular", "price-asc", "price-desc", "name"];

export type Filters = {
  q: string;
  sae: string[];
  iso: string[];
  spec: string[];
  approval: string;
  pack: string[];
  stock: boolean;
  sort: SortKey;
};

export const EMPTY_FILTERS: Filters = { q: "", sae: [], iso: [], spec: [], approval: "", pack: [], stock: false, sort: "popular" };

const list = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

export function parseFilters(qs: string): Filters {
  const sp = new URLSearchParams(qs);
  const sort = sp.get("sort") as SortKey | null;
  return {
    q: sp.get("q") ?? "",
    sae: list(sp.get("sae")),
    iso: list(sp.get("iso")),
    spec: list(sp.get("spec")),
    approval: sp.get("approval") ?? "",
    pack: list(sp.get("pack")),
    stock: sp.get("stock") === "1",
    sort: sort && SORTS.includes(sort) ? sort : "popular",
  };
}

export function serializeFilters(f: Filters): string {
  const sp = new URLSearchParams();
  if (f.q.trim()) sp.set("q", f.q);
  if (f.sae.length) sp.set("sae", f.sae.join(","));
  if (f.iso.length) sp.set("iso", f.iso.join(","));
  if (f.spec.length) sp.set("spec", f.spec.join(","));
  if (f.approval.trim()) sp.set("approval", f.approval);
  if (f.pack.length) sp.set("pack", f.pack.join(","));
  if (f.stock) sp.set("stock", "1");
  if (f.sort !== "popular") sp.set("sort", f.sort);
  return sp.toString();
}

export function activeCount(f: Filters) {
  return f.sae.length + f.iso.length + f.spec.length + f.pack.length + (f.approval.trim() ? 1 : 0) + (f.stock ? 1 : 0) + (f.q.trim() ? 1 : 0);
}

/** "ACEA A3/B4" and "ACEA A3 / B4" are the same spec. */
export function normSpec(s: string) {
  return s.replace(/\s*\/\s*/g, " / ").replace(/\s+/g, " ").trim();
}

export function packKey(v: { size: number | null; unit: string }) {
  return v.size ? `${Number(v.size)}${v.unit}` : "pcs";
}

function saeRank(s: string) {
  const m = s.match(/(\d+)W-(\d+)/i);
  if (m) return Number(m[1]) * 1000 + Number(m[2]);
  const mono = s.match(/(\d+)/);
  return 100000 + Number(mono?.[1] ?? 0);
}

export type Facets = {
  sae: string[];
  iso: string[];
  specs: { acea: string[]; api: string[]; other: string[] };
  packs: { key: string; label: string }[];
};

export function buildFacets(products: ProductSummary[], pcsLabel: string): Facets {
  const sae = new Set<string>();
  const iso = new Set<string>();
  const specs = new Set<string>();
  const packs = new Map<string, { key: string; label: string; unit: string; size: number }>();
  for (const p of products) {
    if (p.sae) sae.add(p.sae);
    if (p.iso_vg) iso.add(p.iso_vg);
    for (const s of p.specs) specs.add(normSpec(s));
    for (const v of p.variants) {
      const k = packKey(v);
      if (!packs.has(k)) packs.set(k, { key: k, label: packLabel(v) || pcsLabel, unit: v.unit, size: Number(v.size ?? 0) });
    }
  }
  const all = [...specs].sort((a, b) => a.localeCompare(b));
  const unitOrder: Record<string, number> = { l: 0, kg: 1, pcs: 2 };
  return {
    sae: [...sae].sort((a, b) => saeRank(a) - saeRank(b)),
    iso: [...iso].sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""))),
    specs: {
      acea: all.filter((s) => /^ACEA\b/i.test(s)),
      api: all.filter((s) => /^API\b/i.test(s)),
      other: all.filter((s) => !/^(ACEA|API)\b/i.test(s)),
    },
    packs: [...packs.values()]
      .sort((a, b) => (unitOrder[a.unit] ?? 3) - (unitOrder[b.unit] ?? 3) || a.size - b.size)
      .map(({ key, label }) => ({ key, label })),
  };
}

const compact = (s: string) => normalize(s).replace(/[\s\-./]+/g, "");

export function minPrice(p: ProductSummary, ctx: PriceContext) {
  const prices = p.variants.map((v) => displayPrice(v, ctx)).filter((n) => n > 0);
  return prices.length ? Math.min(...prices) : Infinity;
}

export function minPerUnit(p: ProductSummary, ctx: PriceContext) {
  let best: { price: number; unit: string } | null = null;
  for (const v of p.variants) {
    const ppu = pricePerUnit(v, ctx);
    if (ppu != null && (!best || ppu < best.price)) best = { price: ppu, unit: v.unit };
  }
  return best;
}

type Searchable = Parameters<typeof scoreDoc>[0];
const searchCache = new WeakMap<ProductSummary, Searchable>();
function searchable(p: ProductSummary): Searchable {
  let s = searchCache.get(p);
  if (!s) {
    s = { ...p, skus: p.variants.map((v) => v.sku).filter((x): x is string => Boolean(x)) };
    searchCache.set(p, s);
  }
  return s;
}

export function applyFilters(products: ProductSummary[], f: Filters, ctx: PriceContext) {
  const approval = compact(f.approval);
  const specSet = new Set(f.spec);
  const scores = new Map<string, number>();
  const out = products.filter((p) => {
    if (f.sae.length && !(p.sae && f.sae.includes(p.sae))) return false;
    if (f.iso.length && !(p.iso_vg && f.iso.includes(p.iso_vg))) return false;
    if (specSet.size && !p.specs.some((s) => specSet.has(normSpec(s)))) return false;
    if (f.pack.length && !p.variants.some((v) => f.pack.includes(packKey(v)))) return false;
    if (f.stock && !p.variants.some((v) => v.in_stock)) return false;
    if (approval && ![...p.approvals, ...p.specs].some((a) => compact(a).includes(approval))) return false;
    if (f.q.trim()) {
      const s = scoreDoc(searchable(p), f.q);
      if (s <= 0) return false;
      scores.set(p.slug, s);
    }
    return true;
  });
  const order = new Map(products.map((p, i) => [p.slug, i]));
  const sorted = [...out];
  switch (f.sort) {
    case "price-asc":
      sorted.sort((a, b) => minPrice(a, ctx) - minPrice(b, ctx));
      break;
    case "price-desc":
      sorted.sort((a, b) => minPrice(b, ctx) - minPrice(a, ctx));
      break;
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      sorted.sort(
        (a, b) =>
          (scores.get(b.slug) ?? 0) - (scores.get(a.slug) ?? 0) ||
          Number(b.featured) - Number(a.featured) ||
          (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0),
      );
  }
  return sorted;
}
