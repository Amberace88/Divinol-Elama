import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { toCsv } from "@/lib/admin/csv";
import { fmtDate, todayRiga } from "@/lib/admin/format";
import { INVOICE_STATUS, INVOICE_TYPE, labelOf } from "@/lib/admin/labels";
import { invoicesQuery, parseInvoiceFilters } from "@/lib/admin/queries";

const MAX_ROWS = 20000;
const SELECT = "number, type, status, issued_at, due_at, paid_at, buyer, subtotal_net, vat_rate, vat_amount, total_gross, reverse_charge, orders(number)";

type Row = {
  number: string;
  type: string;
  status: string;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  buyer: {
    name?: string;
    company_name?: string;
    reg_no?: string;
    vat_no?: string;
    email?: string;
    customer_type?: string;
    address?: { country?: string } | string | null;
  } | null;
  subtotal_net: number | string;
  vat_rate: number | string;
  vat_amount: number | string;
  total_gross: number | string;
  reverse_charge: boolean;
  orders: { number: string } | null;
};

/**
 * Invoice register for the accountant (Excel-friendly CSV, lv-LV): the same filters as /admin/invoices,
 * the period is the issue date (No / Līdz). Credit notes are exported with negative amounts.
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (session.status !== "ok") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const f = parseInvoiceFilters(params);
  const today = todayRiga();
  const rows: Row[] = [];
  for (let from = 0; from < MAX_ROWS; from += 1000) {
    const { data, error } = await invoicesQuery(session.supabase, f, SELECT, today)
      .order("issued_at", { ascending: true })
      .order("number", { ascending: true })
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const batch = (data ?? []) as unknown as Row[];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }

  const csv = toCsv(
    [
      "Numurs",
      "Veids",
      "Izrakstīšanas datums",
      "Apmaksas termiņš",
      "Statuss",
      "Apmaksas datums",
      "Pircējs",
      "Kontaktpersona",
      "Reģ. nr.",
      "PVN nr.",
      "Valsts",
      "E-pasts",
      "Pasūtījums",
      "Summa bez PVN",
      "PVN %",
      "PVN",
      "Kopā ar PVN",
      "Reverse charge",
    ],
    rows.map((r) => {
      const sign = r.type === "credit_note" ? -1 : 1;
      const b = r.buyer ?? {};
      const country = typeof b.address === "object" && b.address ? (b.address.country ?? "") : "";
      return [
        r.number,
        labelOf(INVOICE_TYPE, r.type).label,
        fmtDate(r.issued_at),
        r.due_at ? fmtDate(r.due_at) : "",
        labelOf(INVOICE_STATUS, r.status).label,
        r.paid_at ? fmtDate(r.paid_at) : "",
        b.company_name || b.name || "",
        b.company_name ? (b.name ?? "") : "",
        b.reg_no ?? "",
        b.vat_no ?? "",
        country,
        b.email ?? "",
        r.orders?.number ?? "",
        Number(r.subtotal_net) * sign,
        Number(r.vat_rate),
        Number(r.vat_amount) * sign,
        Number(r.total_gross) * sign,
        r.reverse_charge,
      ];
    }),
  );

  const period = f.from || f.to ? `${f.from ?? "sakums"}_${f.to ?? today}` : today;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rekini-${period}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
