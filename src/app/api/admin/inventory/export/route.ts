import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { toCsv } from "@/lib/admin/csv";
import { packLabelOf, todayRiga } from "@/lib/admin/format";
import { AVAILABILITY_LABEL, fmtDecimal, grossOf, isAvailability } from "@/lib/admin/inventory";
import { INVENTORY_CSV_HEADER } from "@/lib/admin/inventory-csv";
import { getStoreSettings } from "@/lib/settings";

type Row = {
  id: string;
  sku: string | null;
  size: number | string | null;
  unit: string;
  price_net: number | string;
  stock: number | null;
  availability: string;
  sort: number;
  products: { i18n: Record<string, { name?: string }> | null; slug: string } | null;
};

/** Prices & stock for Elama's accounting system (Excel-friendly: `;`, decimal comma, UTF-8 BOM). */
export async function GET() {
  const session = await getAdminSession();
  if (session.status !== "ok") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rows: Row[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await session.supabase
      .from("product_variants")
      .select("id, sku, size, unit, price_net, stock, availability, sort, products(i18n, slug)")
      .order("id")
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const batch = (data ?? []) as unknown as Row[];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }

  const settings = await getStoreSettings();
  const vat = Number(settings.vat.LV) || 21;
  const name = (r: Row) => r.products?.i18n?.lv?.name ?? r.products?.slug ?? "";
  rows.sort((a, b) => name(a).localeCompare(name(b), "lv") || a.sort - b.sort || Number(a.size ?? 0) - Number(b.size ?? 0));

  const header: string[] = [...INVENTORY_CSV_HEADER];
  header[4] = `Cena ar PVN (LV ${vat}%)`;
  const csv = toCsv(
    header,
    rows.map((r) => {
      const net = Number(r.price_net);
      return [
        r.sku ?? "",
        name(r),
        packLabelOf(r.size, r.unit),
        fmtDecimal(net, 4, 2),
        fmtDecimal(grossOf(net, vat), 2, 2),
        r.stock ?? "",
        isAvailability(r.availability) ? AVAILABILITY_LABEL[r.availability] : r.availability,
        r.id,
      ];
    }),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cenas-atlikumi-${todayRiga()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
