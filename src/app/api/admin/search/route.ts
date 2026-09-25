import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { sanitizeSearch } from "@/lib/admin/server";

type ProductHit = { id: string; slug: string; base_sku: string | null; images: string[] | null; i18n: Record<string, { name?: string }> | null };

const noStore = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (session.status !== "ok") return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });

  const q = sanitizeSearch(req.nextUrl.searchParams.get("q"), 60);
  if (q.length < 2) return NextResponse.json({ orders: [], products: [], customers: [] }, { headers: noStore });
  const like = `%${q}%`;
  const sb = session.supabase;

  const [orders, products, variants, customers] = await Promise.all([
    sb
      .from("orders")
      .select("id, number, email, customer, total_gross, status")
      .or(`number.ilike.${like},email.ilike.${like},customer->>name.ilike.${like},customer->>company_name.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(6),
    sb
      .from("products")
      .select("id, slug, base_sku, images, i18n")
      .or(`slug.ilike.${like},base_sku.ilike.${like},sae.ilike.${like},i18n->lv->>name.ilike.${like},i18n->en->>name.ilike.${like}`)
      .order("sort")
      .limit(6),
    sb.from("product_variants").select("sku, products(id, slug, base_sku, images, i18n)").ilike("sku", like).limit(6),
    sb
      .from("profiles")
      .select("id, full_name, email, company_name")
      .or(`full_name.ilike.${like},email.ilike.${like},company_name.ilike.${like},reg_no.ilike.${like},vat_no.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const productMap = new Map<string, { id: string; name: string; slug: string; sku: string | null; image: string | null }>();
  const addProduct = (p: ProductHit | null | undefined, sku: string | null) => {
    if (!p || productMap.has(p.id)) return;
    productMap.set(p.id, {
      id: p.id,
      slug: p.slug,
      name: p.i18n?.lv?.name ?? p.slug,
      sku: sku ?? p.base_sku,
      image: p.images?.[0] ?? null,
    });
  };
  for (const v of (variants.data ?? []) as unknown as { sku: string | null; products: ProductHit | null }[]) addProduct(v.products, v.sku);
  for (const p of (products.data ?? []) as ProductHit[]) addProduct(p, null);

  type OrderHit = { id: string; number: string; email: string; customer: { name?: string; company_name?: string } | null; total_gross: number; status: string };
  type CustomerHit = { id: string; full_name: string | null; email: string; company_name: string | null };

  return NextResponse.json(
    {
      orders: ((orders.data ?? []) as OrderHit[]).map((o) => ({
        id: o.id,
        number: o.number,
        email: o.email,
        name: o.customer?.company_name || o.customer?.name || "",
        total: Number(o.total_gross),
        status: o.status,
      })),
      products: [...productMap.values()].slice(0, 8),
      customers: ((customers.data ?? []) as CustomerHit[]).map((c) => ({
        id: c.id,
        name: c.full_name ?? "",
        email: c.email,
        company: c.company_name,
      })),
    },
    { headers: noStore },
  );
}
