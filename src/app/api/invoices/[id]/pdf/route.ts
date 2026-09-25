import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { renderInvoicePdf, type InvoiceData } from "@/lib/admin/invoice-pdf";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Invoice PDF for the invoice owner or an admin. Loaded with the SESSION client, so RLS
 * ("invoices own read": user_id = auth.uid() or is_admin()) decides access; anything else is a 404.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id) || !isSupabaseConfigured) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("number, type, status, issued_at, due_at, paid_at, buyer, seller, lines, subtotal_net, vat_rate, vat_amount, total_gross, reverse_charge, notes, orders(number)")
    .eq("id", id)
    .maybeSingle();
  if (error || !invoice) return new NextResponse("Not found", { status: 404 });

  // Default footer note (settings.invoice is admin-only; silently skipped for customers).
  const { data: invoiceSettings } = await supabase.from("settings").select("value").eq("key", "invoice").maybeSingle();
  const inv = invoice as unknown as Omit<InvoiceData, "order_number" | "default_notes"> & { orders: { number: string } | null };

  try {
    const pdf = await renderInvoicePdf({
      ...inv,
      lines: Array.isArray(inv.lines) ? inv.lines : [],
      buyer: inv.buyer ?? {},
      seller: inv.seller ?? {},
      order_number: inv.orders?.number ?? null,
      default_notes: (invoiceSettings?.value as { notes?: string } | null)?.notes ?? null,
    });
    const filename = `${inv.number.replace(/[^\w.-]+/g, "_")}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (e) {
    console.error("[invoice pdf]", e);
    return new NextResponse("PDF generation failed", { status: 500 });
  }
}
