import Link from "next/link";
import { AlertTriangle, PackageOpen } from "lucide-react";
import type { requireAdmin } from "@/lib/admin/auth";
import { packLabelOf } from "@/lib/admin/format";
import { STOCK_LEVEL, type StockLevel } from "@/lib/admin/inventory";
import { cn } from "@/lib/utils";
import { EmptyState, Panel, Pill } from "../ui";

type Supa = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

export type InventorySummary = {
  counts: Record<"low_stock" | "out_of_stock" | "on_order", number>;
  items: { id: string; product_id: string; name: string; pack: string; sku: string | null; stock: number | null; level: StockLevel }[];
};

type Row = {
  id: string;
  product_id: string;
  sku: string | null;
  size: number | string | null;
  unit: string;
  stock: number | null;
  stock_level: StockLevel;
  products: { is_active: boolean; i18n: Record<string, { name?: string }> | null; slug: string } | null;
};

/** Variants that need attention (low / out of stock / on order) among active products. */
export async function loadInventorySummary(supabase: Supa): Promise<InventorySummary | null> {
  const { data, error } = await supabase
    .from("product_variants")
    .select("id, product_id, sku, size, unit, stock, stock_level, products(is_active, i18n, slug)")
    .in("stock_level", ["low_stock", "out_of_stock", "on_order"])
    .eq("is_active", true)
    .limit(1000);
  if (error) return null;
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.products?.is_active);
  const counts = { low_stock: 0, out_of_stock: 0, on_order: 0 };
  for (const r of rows) if (r.stock_level in counts) counts[r.stock_level as keyof typeof counts]++;
  const rank: Partial<Record<StockLevel, number>> = { out_of_stock: 0, low_stock: 1 };
  const items = rows
    .filter((r) => r.stock_level === "out_of_stock" || r.stock_level === "low_stock")
    .sort((a, b) => (rank[a.stock_level] ?? 9) - (rank[b.stock_level] ?? 9) || (a.stock ?? 0) - (b.stock ?? 0))
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      product_id: r.product_id,
      name: r.products?.i18n?.lv?.name ?? r.products?.slug ?? "—",
      pack: packLabelOf(r.size, r.unit),
      sku: r.sku,
      stock: r.stock,
      level: r.stock_level,
    }));
  return { counts, items };
}

export function InventoryPanel({ data }: { data: InventorySummary | null }) {
  const tiles: { key: keyof InventorySummary["counts"]; tone: string }[] = [
    { key: "low_stock", tone: "text-brand-700" },
    { key: "out_of_stock", tone: "text-red-700" },
    { key: "on_order", tone: "text-sky-700" },
  ];
  return (
    <Panel
      title="Zems atlikums / Nav noliktavā"
      description="Aktīvo produktu varianti, kam jāpievērš uzmanība"
      bodyClassName="p-0"
      actions={
        <Link href="/admin/products?stock=low_stock" className="text-[12px] font-bold text-navy-600 hover:underline">
          Atlikumi →
        </Link>
      }
    >
      <div className="grid grid-cols-3 divide-x divide-line/70 border-b border-line/70">
        {tiles.map((t) => (
          <Link
            key={t.key}
            href={`/admin/products?stock=${t.key}`}
            className="px-3 py-3 text-center transition hover:bg-navy-50/40 focus-visible:bg-navy-50 focus-visible:outline-none"
          >
            <span className={cn("block text-[20px] font-extrabold tabular-nums", data && data.counts[t.key] > 0 ? t.tone : "text-ink")}>{data ? data.counts[t.key] : "—"}</span>
            <span className="block text-[11px] font-semibold text-muted">{STOCK_LEVEL[t.key].label}</span>
          </Link>
        ))}
      </div>
      {!data || data.items.length === 0 ? (
        <EmptyState icon={PackageOpen} title="Viss kārtībā" description="Nav variantu ar zemu atlikumu vai bez atlikuma (vai atlikums netiek uzskaitīts)." />
      ) : (
        <ul className="divide-y divide-line/70">
          {data.items.map((v) => (
            <li key={v.id}>
              <Link
                href={`/admin/products?stock=${v.level}`}
                className="flex items-center gap-3 px-5 py-3 text-[13px] transition hover:bg-navy-50/40 focus-visible:bg-navy-50 focus-visible:outline-none"
              >
                <AlertTriangle className={v.level === "out_of_stock" ? "h-4 w-4 text-red-500" : "h-4 w-4 text-brand-600"} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">
                    {v.name}
                    {v.pack && <span className="font-normal text-muted"> · {v.pack}</span>}
                  </p>
                  <p className="font-mono text-[11px] text-muted">{v.sku ?? "bez SKU"}</p>
                </div>
                <Pill tone={STOCK_LEVEL[v.level].tone}>{v.stock == null ? STOCK_LEVEL[v.level].label : `${v.stock} gab.`}</Pill>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
