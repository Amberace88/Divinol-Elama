import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { sp, spEnum, type SP } from "@/lib/admin/params";
import { errorMessage } from "@/lib/admin/server";
import { getStoreSettings } from "@/lib/settings";
import { NewProductsReview, type ReviewProduct } from "@/components/admin/products/NewProductsReview";
import { ImportNewBatch } from "@/components/admin/products/ImportNewBatch";
import { isDeveloperEmail } from "@/lib/admin/developer";
import { BATCHES, LATEST_BATCH, handoverState, hiddenProductIds } from "@/lib/admin/handover";
import { HandoverBar } from "@/components/admin/products/HandoverBar";
import { ErrorNote, PageHeader, Segmented } from "@/components/admin/ui";

export const metadata = { title: "Jaunie produkti" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  slug: string;
  base_sku: string | null;
  sae: string | null;
  images: string[] | null;
  is_active: boolean;
  badges: string[] | null;
  specs: string[] | null;
  oem_approvals: string[] | null;
  performance: string[] | null;
  tds_url: string | null;
  created_at: string;
  i18n: Record<string, { name?: string; type?: string; short?: string; description?: string }> | null;
  categories: { slug: string; i18n: Record<string, { name?: string }> | null } | null;
  product_variants: { id: string; sku: string | null; size: number | string | null; unit: string; price_net: number | string; image: string | null; is_active: boolean; availability: string; sort: number }[];
};

const PERIODS = [
  { v: "7", label: "7 dienas" },
  { v: "30", label: "30 dienas" },
  { v: "90", label: "90 dienas" },
] as const;

function sinceDays(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

/** Produkti → Jaunie: everything added recently, shown like the shop shows it, with what is still missing (price, photo …). */
export default async function RecentProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = await searchParams;
  const days = spEnum(params, "days", ["7", "30", "90"] as const, "30");
  const view = spEnum(params, "view", ["all", "draft", "live"] as const, "all");
  const q = sp(params, "q").toLowerCase();

  const { supabase, user } = await requireAdmin();
  const developer = isDeveloperEmail(user.email);
  const allBatchArts = BATCHES.flatMap((b) => b.arts);
  const since = sinceDays(Number(days));
  const [res, settings, batchRes] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, slug, base_sku, sae, images, is_active, badges, specs, oem_approvals, performance, tds_url, created_at, i18n, categories(slug, i18n), product_variants(id, sku, size, unit, price_net, image, is_active, availability, sort)",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .order("slug"),
    getStoreSettings(),
    developer ? supabase.from("products").select("base_sku").in("base_sku", allBatchArts) : Promise.resolve({ data: null }),
  ]);
  const [hiddenIds, handed] = await Promise.all([hiddenProductIds(supabase, user.email), developer ? handoverState(supabase) : Promise.resolve({} as Record<string, string>)]);
  const hiddenSet = new Set(hiddenIds);
  const haveArts = new Set(((batchRes.data ?? []) as { base_sku: string }[]).map((r) => r.base_sku));
  const latestArts = new Set(LATEST_BATCH.arts);
  const vat = Number(settings.vat.LV) || 21;

  const all: ReviewProduct[] = ((res.data ?? []) as unknown as Row[]).filter((p) => !hiddenSet.has(p.id)).map((p) => {
    const lv = p.i18n?.lv ?? {};
    const vs = [...p.product_variants].sort((a, b) => a.sort - b.sort || Number(a.size ?? 0) - Number(b.size ?? 0));
    const image = p.images?.[0] ?? vs.find((v) => v.image)?.image ?? null;
    const variants = vs.map((v) => ({ id: v.id, sku: v.sku, size: v.size == null ? null : Number(v.size), unit: v.unit, price_net: Number(v.price_net), is_active: v.is_active }));
    const langs = ["lv", "et", "lt", "en", "ru"].filter((l) => p.i18n?.[l]?.name && p.i18n?.[l]?.description);
    return {
      id: p.id,
      slug: p.slug,
      sku: p.base_sku,
      name: lv.name ?? p.slug,
      type: lv.type ?? null,
      short: lv.short ?? null,
      description: lv.description ?? null,
      category: p.categories?.i18n?.lv?.name ?? p.categories?.slug ?? null,
      sae: p.sae,
      image,
      is_active: p.is_active,
      specs: p.specs ?? [],
      approvals: p.oem_approvals ?? [],
      performance: p.performance ?? [],
      tds: Boolean(p.tds_url),
      langs,
      created_at: p.created_at,
      latest: p.base_sku && latestArts.has(p.base_sku) ? LATEST_BATCH.date : null,
      variants,
      checks: {
        price: variants.some((v) => v.is_active && v.price_net > 0) && variants.filter((v) => v.is_active).every((v) => v.price_net > 0),
        photo: Boolean(image),
        text: Boolean(lv.description && lv.short),
        langs: langs.length === 5,
      },
    };
  });

  const filtered = all.filter(
    (p) =>
      (view === "all" || (view === "draft" ? !p.is_active : p.is_active)) &&
      (!q || `${p.name} ${p.sku ?? ""} ${p.sae ?? ""} ${p.category ?? ""}`.toLowerCase().includes(q)),
  );
  const drafts = all.filter((p) => !p.is_active).length;
  const href = (patch: Record<string, string>) => {
    const s = new URLSearchParams({ days, view, ...(q ? { q } : {}), ...patch });
    if (s.get("days") === "30") s.delete("days");
    if (s.get("view") === "all") s.delete("view");
    const str = s.toString();
    return `/admin/products/recent${str ? `?${str}` : ""}`;
  };

  return (
    <>
      <PageHeader
        back={{ href: "/admin/products", label: "Produkti" }}
        eyebrow="Pārbaudei"
        title={
          <span className="flex items-center gap-2.5">
            <Sparkles className="h-6 w-6 text-brand-500" aria-hidden /> Jaunie produkti
          </span>
        }
        description={`${all.length} produkti pievienoti pēdējās ${days} dienās${drafts ? ` · ${drafts} vēl nav publicēti veikalā` : ""}. Pārbaudiet aprakstu, ievadiet cenas un publicējiet.`}
        actions={<Segmented items={PERIODS.map((p) => ({ href: href({ days: p.v }), label: p.label, active: days === p.v }))} />}
      />
      {developer &&
        [...BATCHES].reverse().map((b) => {
          const n = b.arts.filter((a) => haveArts.has(a) && a !== "52020").length;
          return n > 0 ? (
            <div key={b.id} className="mb-3 last:mb-5">
              <HandoverBar batchId={b.id} label={`${b.label} · ${b.date}`} handedAt={handed[b.id] ?? null} count={n} />
            </div>
          ) : null;
        })}
      {developer &&
        batchRes.data &&
        BATCHES.map((b) => {
          const have = b.arts.filter((x) => haveArts.has(x)).length;
          return have < b.arts.length ? (
            <div key={b.id} className="mb-5">
              <ImportNewBatch batchId={b.id} label={`${b.label} · ${b.date}`} total={b.arts.length} imported={have} />
            </div>
          ) : null;
        })}
      {res.error ? (
        <ErrorNote message={errorMessage(res.error)} />
      ) : (
        <NewProductsReview
          products={filtered}
          vat={vat}
          view={view}
          q={q}
          counts={{ all: all.length, draft: drafts, live: all.length - drafts }}
          hrefs={{ all: href({ view: "all" }), draft: href({ view: "draft" }), live: href({ view: "live" }) }}
        />
      )}
      {!res.error && all.length === 0 && (
        <p className="mt-6 text-center text-[13px] text-muted">
          Šajā periodā jaunu produktu nav. <Link href={href({ days: "90" })} className="font-semibold text-navy-600 hover:underline">Rādīt 90 dienas</Link>
        </p>
      )}
    </>
  );
}
