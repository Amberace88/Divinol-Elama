import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { toCsv } from "@/lib/admin/csv";
import { fmtDateTime, todayRiga } from "@/lib/admin/format";
import { labelOf, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, SHIPPING_METHOD } from "@/lib/admin/labels";
import { ORDER_LIST_SELECT, ordersQuery, parseOrderFilters, type OrderRow } from "@/lib/admin/queries";

const MAX_ROWS = 5000;

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (session.status !== "ok") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const f = parseOrderFilters(params);
  const rows: OrderRow[] = [];
  // PostgREST caps responses (default 1000 rows) → fetch in pages.
  for (let from = 0; from < MAX_ROWS; from += 1000) {
    const { data, error } = await ordersQuery(session.supabase, f, ORDER_LIST_SELECT).range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const batch = (data ?? []) as unknown as OrderRow[];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }

  const csv = toCsv(
    [
      "Numurs",
      "Datums",
      "Statuss",
      "Apmaksas statuss",
      "Apmaksas veids",
      "Tirgus",
      "Klients",
      "Uzņēmums",
      "Reģ. nr.",
      "PVN nr.",
      "E-pasts",
      "Tālrunis",
      "Piegāde",
      "Sūtījuma kods",
      "Preces bez PVN",
      "Piegāde bez PVN",
      "PVN",
      "Kopā ar PVN",
      "Reverse charge",
      "B2B",
      "Avots",
    ],
    rows.map((o) => [
      o.number,
      fmtDateTime(o.created_at),
      labelOf(ORDER_STATUS, o.status).label,
      labelOf(PAYMENT_STATUS, o.payment_status).label,
      PAYMENT_METHOD[o.payment_method] ?? o.payment_method,
      o.market,
      o.customer?.name ?? "",
      o.customer?.company_name ?? "",
      o.customer?.reg_no ?? "",
      o.customer?.vat_no ?? "",
      o.email,
      o.phone ?? "",
      SHIPPING_METHOD[o.shipping_method] ?? o.shipping_method,
      o.tracking_code ?? "",
      Number(o.subtotal_net),
      Number(o.shipping_net),
      Number(o.vat_amount),
      Number(o.total_gross),
      o.reverse_charge,
      Boolean(o.customer?.b2b),
      o.source === "admin" ? "Adminā" : "E-veikals",
    ]),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pasutijumi-${todayRiga()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
