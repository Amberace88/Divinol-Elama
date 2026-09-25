import Link from "next/link";
import { PackageSearch, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { PAGE_SIZE, sp, spEnum, spInt, withParams, type SP } from "@/lib/admin/params";
import { errorMessage, sanitizeSearch, UUID_RE } from "@/lib/admin/server";
import { getStoreSettings } from "@/lib/settings";
import { FilterBar } from "@/components/admin/FilterBar";
import { isAvailability, STOCK_FILTER_LABEL, STOCK_FILTERS, type StockFilter, type StockLevel } from "@/lib/admin/inventory";
import { cn } from "@/lib/utils";
import { CatalogImportButton, CatalogImportHero } from "@/components/admin/products/CatalogImport";
import { InventoryCsvButtons } from "@/components/admin/products/InventoryImport";
import { ProductTable, type ProductListItem } from "@/components/admin/products/ProductTable";
import { btn } from "@/components/admin/styles";
import { EmptyState, ErrorNote, PageHeader, Pagination } from "@/components/admin/ui";

export const metadata = { title: "Produkti" };

type Row = {
  id: string;
  slug: string;
  base_sku: string | null;
  sae: string | null;
  iso_vg: string | null;
  images: string[] | null;
  is_active: boolean;
  is_featured: boolean;
  i18n: Record<string, { name?: string }> | null;
  categories: { i18n: Record<string, { name?: string }> | null; slug: string } | null;
  product_variants: {
    id: string;
    sku: string | null;
    size: number | string | null;
    unit: string;
    price_net: number | string;
    stock: number | null;
    availability: string;
    lead_time_days: number | null;
    low_stock_threshold: number;
    is_active: boolean;
    image: string | null;
    sort: number;
  }[];
};

type LevelRow = { product_id: string; stock_level: StockLevel; is_active: boolean };

const SORTS = { sort: "sort", name: "i18n->lv->>name", updated: "updated_at" } as const;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = await searchParams;
  const q = sanitizeSearch(sp(params, "q"));
  const category = sp(params, "category");
  const status = spEnum(params, "status", ["active", "inactive", "featured"] as const, null);
  const stock = spEnum(params, "stock", STOCK_FILTERS, null);
  const sort = spEnum(params, "sort", Object.keys(SORTS) as (keyof typeof SORTS)[], "sort");
  const page = spInt(params, "page", 1);
  const PER = PAGE_SIZE + 5;

  const { supabase } = await requireAdmin();

  // SKU search goes through the variants table.
  let skuIds: string[] = [];
  if (q) {
    const { data } = await supabase.from("product_variants").select("product_id").ilike("sku", `%${q}%`).limit(50);
    skuIds = [...new Set(((data ?? []) as { product_id: string }[]).map((r) => r.product_id))];
  }

  // Availability levels of every variant → tab counts + product ids for the ?stock= filter.
  const levels: LevelRow[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await supabase.from("product_variants").select("product_id, stock_level, is_active").order("id").range(from, from + 999);
    const batch = (data ?? []) as LevelRow[];
    levels.push(...batch);
    if (batch.length < 1000) break;
  }
  const byLevel = new Map<string, Set<string>>();
  for (const l of levels) {
    if (!l.is_active) continue;
    if (!byLevel.has(l.stock_level)) byLevel.set(l.stock_level, new Set());
    byLevel.get(l.stock_level)!.add(l.product_id);
  }

  let query = supabase
    .from("products")
    .select(
      "id, slug, base_sku, sae, iso_vg, images, is_active, is_featured, i18n, categories(slug, i18n), product_variants(id, sku, size, unit, price_net, stock, availability, lead_time_days, low_stock_threshold, is_active, image, sort)",
      { count: "exact" },
    );
  if (stock === "inactive") query = query.eq("is_active", false);
  else if (stock) {
    const ids = [...(byLevel.get(stock) ?? [])];
    query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (q) {
    const ors = [`slug.ilike.%${q}%`, `base_sku.ilike.%${q}%`, `sae.ilike.%${q}%`, `iso_vg.ilike.%${q}%`, `i18n->lv->>name.ilike.%${q}%`];
    if (skuIds.length) ors.push(`id.in.(${skuIds.join(",")})`);
    query = query.or(ors.join(","));
  }
  if (category === "none") query = query.is("category_id", null);
  else if (UUID_RE.test(category)) query = query.eq("category_id", category);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);
  if (status === "featured") query = query.eq("is_featured", true);
  query = query.order(SORTS[sort], { ascending: sort !== "updated" }).order("slug");
  const from = (page - 1) * PER;

  const [listRes, catsRes, totalRes, inactiveRes, settings] = await Promise.all([
    query.range(from, from + PER - 1),
    supabase.from("categories").select("id, slug, i18n, sort").order("sort"),
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", false),
    getStoreSettings(),
  ]);

  const dbTotal = totalRes.count ?? 0;
  const cats = (catsRes.data ?? []) as { id: string; slug: string; i18n: Record<string, { name?: string }> | null }[];
  const vat = Number(settings.vat.LV) || 21;

  const rows: ProductListItem[] = ((listRes.data ?? []) as unknown as Row[]).map((p) => {
    const vs = [...(p.product_variants ?? [])].sort((a, b) => a.sort - b.sort || Number(a.size ?? 0) - Number(b.size ?? 0));
    return {
      id: p.id,
      slug: p.slug,
      name: p.i18n?.lv?.name ?? p.slug,
      category: p.categories?.i18n?.lv?.name ?? p.categories?.slug ?? null,
      sae: p.sae,
      iso_vg: p.iso_vg,
      base_sku: p.base_sku,
      image: p.images?.[0] ?? vs.find((v) => v.image)?.image ?? null,
      is_active: p.is_active,
      is_featured: p.is_featured,
      variants: vs.map((v) => ({
        id: v.id,
        sku: v.sku,
        size: v.size == null ? null : Number(v.size),
        unit: v.unit,
        price_net: Number(v.price_net),
        stock: v.stock,
        availability: isAvailability(v.availability) ? v.availability : "in_stock",
        lead_time_days: v.lead_time_days,
        low_stock_threshold: v.low_stock_threshold ?? 3,
        is_active: v.is_active,
      })),
    };
  });
  const tabCount = (f: StockFilter) => (f === "inactive" ? inactiveRes.count ?? 0 : byLevel.get(f)?.size ?? 0);
  const tabHref = (f: StockFilter | null) => `/admin/products${withParams(params, { stock: f, page: null })}`;
  const total = listRes.count ?? 0;
  const hasFilters = Boolean(q || category || status || stock);

  return (
    <>
      <PageHeader
        title="Produkti"
        description={`${dbTotal} produkti katalogā`}
        actions={
          <>
            {dbTotal > 0 && <InventoryCsvButtons />}
            {dbTotal > 0 && <CatalogImportButton />}
            <Link href="/admin/products/new" className={btn("primary")}>
              <Plus className="h-4 w-4" /> Jauns produkts
            </Link>
          </>
        }
      />

      {!totalRes.error && dbTotal === 0 && <CatalogImportHero productCount={dbTotal} />}

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <FilterBar
          values={{ q, category, status: status ?? "", sort: sort === "sort" ? "" : sort, stock: stock ?? "" }}
          fields={[
            { type: "search", name: "q", placeholder: "Nosaukums, SKU, SAE…" },
            {
              type: "select",
              name: "category",
              label: "Visas kategorijas",
              options: [...cats.map((c) => ({ value: c.id, label: c.i18n?.lv?.name ?? c.slug })), { value: "none", label: "— Bez kategorijas" }],
            },
            {
              type: "select",
              name: "status",
              label: "Visi statusi",
              options: [
                { value: "active", label: "Aktīvie" },
                { value: "inactive", label: "Paslēptie" },
                { value: "featured", label: "Izceltie" },
              ],
            },
            {
              type: "select",
              name: "sort",
              label: "Kārtot: secība",
              options: [
                { value: "name", label: "Kārtot: nosaukums" },
                { value: "updated", label: "Kārtot: pēdējie labotie" },
              ],
            },
          ]}
        />
        <nav className="flex gap-1 overflow-x-auto border-b border-line px-4 py-2 sm:px-5" aria-label="Pieejamības filtrs">
          {[null, ...STOCK_FILTERS].map((f) => {
            const active = stock === f;
            const warn = (f === "low_stock" || f === "out_of_stock") && tabCount(f) > 0;
            return (
              <Link
                key={f ?? "all"}
                href={tabHref(f)}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold transition",
                  active ? "bg-navy-700 text-white shadow-sm" : "text-muted hover:bg-navy-50 hover:text-navy-700",
                )}
              >
                {f ? STOCK_FILTER_LABEL[f] : "Visi"}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] tabular-nums",
                    active ? "bg-white/20 text-white" : warn ? (f === "out_of_stock" ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-700") : "bg-slate-100 text-muted",
                  )}
                >
                  {f ? tabCount(f) : dbTotal}
                </span>
              </Link>
            );
          })}
        </nav>
        {listRes.error ? (
          <div className="p-5">
            <ErrorNote message={errorMessage(listRes.error)} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title={hasFilters ? "Nekas netika atrasts" : "Produktu vēl nav"}
            description={hasFilters ? "Mēģiniet mainīt filtrus." : "Importējiet sākotnējo katalogu vai izveidojiet pirmo produktu."}
            action={
              !hasFilters && (
                <Link href="/admin/products/new" className={btn("dark")}>
                  <Plus className="h-4 w-4" /> Jauns produkts
                </Link>
              )
            }
          />
        ) : (
          <>
            <ProductTable key={stock ?? "all"} rows={rows} vat={vat} highlight={stock && stock !== "inactive" ? stock : null} />
            <Pagination page={page} total={total} pageSize={PER} href={(p) => `/admin/products${withParams(params, { page: p === 1 ? null : p })}`} />
          </>
        )}
      </div>
    </>
  );
}
