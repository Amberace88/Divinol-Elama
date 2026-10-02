import { requireAdmin } from "@/lib/admin/auth";
import { errorMessage } from "@/lib/admin/server";
import { BASE_VAT } from "@/lib/commerce";
import { PROMO_TYPES, type PromoType } from "@/lib/promo";
import { ErrorNote, PageHeader } from "@/components/admin/ui";
import { PromotionsManager, type PromoRow } from "@/components/admin/promo/PromotionsManager";

export const metadata = { title: "Akcijas un nozīmītes" };

type Db = {
  id: string;
  slug: string;
  i18n: Record<string, { name?: string }> | null;
  images: string[] | null;
  is_active: boolean;
  is_featured: boolean;
  badges: string[] | null;
  promo_type: string | null;
  promo_percent: number | string | null;
  promo_starts_at: string | null;
  promo_ends_at: string | null;
  categories: { id: string; slug: string; i18n: Record<string, { name?: string }> | null } | null;
  product_variants: { price_net: number | string; cost_net: number | string | null; is_active: boolean; image: string | null }[] | null;
};

export default async function PromotionsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, i18n, images, is_active, is_featured, badges, promo_type, promo_percent, promo_starts_at, promo_ends_at, categories(id, slug, i18n), product_variants(price_net, cost_net, is_active, image)",
    )
    .order("sort")
    .order("slug")
    .limit(2000);

  const k = 1 + BASE_VAT / 100;
  const rows: PromoRow[] = ((data ?? []) as unknown as Db[]).map((p) => {
    const vs = (p.product_variants ?? []).filter((v) => v.is_active);
    const nets = vs.map((v) => Number(v.price_net)).filter((n) => n > 0);
    const minNet = nets.length ? Math.min(...nets) : null;
    // lowest margin across packs (purchase cost entered) — used to warn about loss-making discounts
    const margins = vs
      .filter((v) => v.cost_net != null && Number(v.price_net) > 0)
      .map((v) => 1 - Number(v.cost_net) / Number(v.price_net));
    return {
      id: p.id,
      slug: p.slug,
      name: p.i18n?.lv?.name ?? p.slug,
      image: p.images?.[0] ?? vs.find((v) => v.image)?.image ?? null,
      category: p.categories ? { id: p.categories.id, name: p.categories.i18n?.lv?.name ?? p.categories.slug } : null,
      is_active: p.is_active,
      is_featured: p.is_featured,
      badges: p.badges ?? [],
      promo:
        p.promo_type && (PROMO_TYPES as readonly string[]).includes(p.promo_type)
          ? { type: p.promo_type as PromoType, percent: p.promo_percent == null ? null : Number(p.promo_percent), starts_at: p.promo_starts_at, ends_at: p.promo_ends_at }
          : null,
      minGross: minNet == null ? null : Math.round(minNet * k * 100) / 100,
      minMargin: margins.length ? Math.min(...margins) * 100 : null,
    };
  });

  return (
    <>
      <PageHeader
        title="Akcijas un nozīmītes"
        description="Atlaides, izpārdošanas un nozīmītes (Jaunums, Pirktākais u.c.) — vienam vai daudziem produktiem uzreiz. Veikalā tās redzamas produktu kartītēs, produkta lapā, sākumlapas sadaļā „Akcijas” un filtrā."
      />
      {error ? <ErrorNote message={errorMessage(error)} /> : <PromotionsManager rows={rows} />}
    </>
  );
}
