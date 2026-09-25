import { requireAdmin } from "@/lib/admin/auth";
import { errorMessage } from "@/lib/admin/server";
import { CategoryManager, type CategoryItem } from "@/components/admin/categories/CategoryManager";
import { ErrorNote, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Kategorijas" };

export default async function CategoriesPage() {
  const { supabase } = await requireAdmin();
  const [catsRes, prodRes] = await Promise.all([
    supabase.from("categories").select("id, slug, icon, image, sort, is_active, i18n").order("sort").order("slug"),
    supabase.from("products").select("category_id").limit(5000),
  ]);
  const counts = new Map<string, number>();
  for (const p of (prodRes.data ?? []) as { category_id: string | null }[]) {
    if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
  }
  const categories: CategoryItem[] = ((catsRes.data ?? []) as Omit<CategoryItem, "products">[]).map((c) => ({
    ...c,
    i18n: c.i18n ?? {},
    products: counts.get(c.id) ?? 0,
  }));

  return (
    <>
      <PageHeader
        title="Kategorijas"
        description="Kārtojiet ar vilkšanu vai bultiņām — secība tiek saglabāta automātiski un atspoguļojas veikala izvēlnē."
      />
      {catsRes.error ? <ErrorNote message={errorMessage(catsRes.error)} /> : <CategoryManager categories={categories} />}
    </>
  );
}
