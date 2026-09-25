import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtDateTime } from "@/lib/admin/format";
import { dbToForm, PRODUCT_SELECT, type DbProduct } from "@/lib/admin/product-form";
import { UUID_RE } from "@/lib/admin/server";
import { BASE_VAT } from "@/lib/commerce";
import { ProductEditor } from "@/components/admin/products/ProductEditor";
import { Pill, PageHeader } from "@/components/admin/ui";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Produkts ${id.slice(0, 8)}` };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const [{ data: product }, { data: cats }] = await Promise.all([
    supabase.from("products").select(PRODUCT_SELECT).eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, slug, i18n").order("sort"),
  ]);
  if (!product) notFound();
  const p = product as unknown as DbProduct;
  const categories = ((cats ?? []) as { id: string; slug: string; i18n: Record<string, { name?: string }> | null }[]).map((c) => ({
    id: c.id,
    name: c.i18n?.lv?.name ?? c.slug,
  }));

  return (
    <>
      <PageHeader
        back={{ href: "/admin/products", label: "Produkti" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {p.i18n?.lv?.name ?? p.slug}
            {!p.is_active && <Pill tone="gray">Paslēpts</Pill>}
            {p.is_featured && <Pill tone="yellow">Izcelts</Pill>}
          </span>
        }
        description={`Pēdējās izmaiņas: ${fmtDateTime(p.updated_at)}`}
      />
      {/* Remount after every save so freshly inserted variant IDs are picked up. */}
      <ProductEditor key={p.updated_at} initial={dbToForm(p)} categories={categories} vat={BASE_VAT} />
    </>
  );
}
