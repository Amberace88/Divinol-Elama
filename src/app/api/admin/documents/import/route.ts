import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { revalidateAdmin, revalidateCatalog } from "@/lib/admin/server";

const MAX_BYTES = 25 * 1024 * 1024;
const SLUG_RE = /^[a-z0-9-]{2,120}$/;

/**
 * Admin-only bulk import of a product TDS/SDS PDF (used when copying documents from the supplier portal).
 * POST raw PDF bytes to /api/admin/documents/import?slug=<product-slug>&kind=tds|sds[&lang=lv]
 * Stores the file in the public `documents` bucket with the admin's own session (normal RLS) and sets products.tds_url / sds_url.
 */
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (session.status !== "ok") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const kind = req.nextUrl.searchParams.get("kind") ?? "";
  const lang = (req.nextUrl.searchParams.get("lang") ?? "").toLowerCase().replace(/[^a-z]/g, "").slice(0, 2);
  if (!SLUG_RE.test(slug) || (kind !== "tds" && kind !== "sds")) return NextResponse.json({ error: "bad_params" }, { status: 400 });

  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength < 100 || buf.byteLength > MAX_BYTES) return NextResponse.json({ error: "bad_size" }, { status: 400 });
  if (new TextDecoder().decode(buf.slice(0, 5)) !== "%PDF-") return NextResponse.json({ error: "not_pdf" }, { status: 400 });

  const { supabase } = session;
  const { data: product } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle<{ id: string }>();
  if (!product) return NextResponse.json({ error: "product_not_found" }, { status: 404 });

  const path = `products/${slug}/${Date.now()}-${kind}${lang ? `-${lang}` : ""}.pdf`;
  const { error: upErr } = await supabase.storage.from("documents").upload(path, buf, {
    contentType: "application/pdf",
    cacheControl: "31536000",
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const url = supabase.storage.from("documents").getPublicUrl(path).data.publicUrl;
  const { error: dbErr } = await supabase
    .from("products")
    .update(kind === "tds" ? { tds_url: url } : { sds_url: url })
    .eq("id", product.id);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  revalidateCatalog();
  revalidateAdmin();
  return NextResponse.json({ ok: true, url });
}
