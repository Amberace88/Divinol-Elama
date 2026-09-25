import Link from "next/link";
import { PackageSearch, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { PAGE_SIZE, sp, spEnum, spInt, withParams, type SP } from "@/lib/admin/params";
import { errorMessage, sanitizeSearch, UUID_RE } from "@/lib/admin/server";
import { getStoreSettings } from "@/lib/settings";
import { FilterBar } from "@/components/admin/FilterBar";
import { CatalogImportButton, CatalogImportHero } from "@/components/admin/products/CatalogImport";
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
  product_variants: { id: string; price_net: number | string; stock: number | null; in_stock: boolean; is_active: boolean; image: string | null }[];
};

const SORTS = { sort: "sort", name: "i18n->lv->>name", updated: "updated_at" } as const;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = await searchParams;
  const q = sanitizeSearch(sp(params, "q"));
  const category = sp(params, "category");
  const status = spEnum(params, "status", ["active", "inactive", "featured"] as const, null);
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

  let query = supabase
    .from("products")
    .select(
      "id, slug, base_sku, sae, iso_vg, images, is_active, is_featured, i18n, categories(slug, i18n), product_variants(id, price_net, stock, in_stock, is_active, image)",
      { count: "exact" },
    );
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

  const [listRes, catsRes, totalRes, settings] = await Promise.all([
    query.range(from, from + PER - 1),
    supabase.from("categories").select("id, slug, i18n, sort").order("sort"),
    supabase.from("products").select("id", { count: "exact", head: true }),
    getStoreSettings(),
  ]);

  const dbTotal = totalRes.count ?? 0;
  const cats = (catsRes.data ?? []) as { id: string; slug: string; i18n: Record<string, { name?: string }> | null }[];
  const vat = Number(settings.vat.LV) || 21;

  const rows: ProductListItem[] = ((listRes.data ?? []) as unknown as Row[]).map((p) => {
    const vs = (p.product_variants ?? []).filter((v) => v.is_active);
    const prices = vs.map((v) => Number(v.price_net)).filter((n) => Number.isFinite(n));
    const tracked = vs.filter((v) => v.stock != null);
    const stockTotal = tracked.length ? tracked.reduce((s, v) => s + Number(v.stock), 0) : null;
    let stock: ProductListItem["stock"] = "untracked";
    if (vs.length && vs.every((v) => !v.in_stock || (v.stock != null && v.stock <= 0))) stock = "out";
    else if (tracked.some((v) => Number(v.stock) <= 3)) stock = "low";
    else if (tracked.length) stock = "ok";
    return {
      id: p.id,
      slug: p.slug,
      name: p.i18n?.lv?.name ?? p.slug,
      category: p.categories?.i18n?.lv?.name ?? p.categories?.slug ?? null,
      sae: p.sae,
      iso_vg: p.iso_vg,
      base_sku: p.base_sku,
      image: p.images?.[0] ?? vs.find((v) => v.image)?.image ?? null,
      variants: (p.product_variants ?? []).length,
      minNet: prices.length ? Math.min(...prices) : null,
      maxNet: prices.length ? Math.max(...prices) : null,
      stock,
      stockTotal,
      is_active: p.is_active,
      is_featured: p.is_featured,
    };
  });
  const total = listRes.count ?? 0;
  const hasFilters = Boolean(q || category || status);

  return (
    <>
      <PageHeader
        title="Produkti"
        description={`${dbTotal} produkti katalogā`}
        actions={
          <>
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
          values={{ q, category, status: status ?? "", sort: sort === "sort" ? "" : sort }}
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
            <ProductTable rows={rows} vat={vat} />
            <Pagination page={page} total={total} pageSize={PER} href={(p) => `/admin/products${withParams(params, { page: p === 1 ? null : p })}`} />
          </>
        )}
      </div>
    </>
  );
}
