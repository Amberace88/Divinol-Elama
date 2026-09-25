import { requireAdmin } from "@/lib/admin/auth";
import { emptyForm } from "@/lib/admin/product-form";
import { BASE_VAT } from "@/lib/commerce";
import { ProductEditor } from "@/components/admin/products/ProductEditor";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Jauns produkts" };

export default async function NewProductPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("categories").select("id, slug, i18n").order("sort");
  const categories = ((data ?? []) as { id: string; slug: string; i18n: Record<string, { name?: string }> | null }[]).map((c) => ({
    id: c.id,
    name: c.i18n?.lv?.name ?? c.slug,
  }));
  return (
    <>
      <PageHeader back={{ href: "/admin/products", label: "Produkti" }} title="Jauns produkts" />
      <ProductEditor initial={emptyForm()} categories={categories} vat={BASE_VAT} />
    </>
  );
}
