import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { UUID_RE } from "@/lib/admin/server";
import { mergeLabels } from "@/lib/shipping/pdf";
import { markLabelsPrinted, SHIPMENT_COLS, shipmentLabelPdf, type ShipmentRow } from "@/lib/shipping/service";

/**
 * GET /api/admin/shipments/labels?ids=<uuid>,<uuid>…
 * Returns one merged PDF with the labels of the given shipments (stored PDF or fetched on demand from the carrier API,
 * then cached in the private "shipping-labels" bucket) and marks them "label_printed".
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (session.status !== "ok") return new NextResponse("Forbidden", { status: 403 });
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s))
    .slice(0, 50);
  if (ids.length === 0) return new NextResponse("Nav norādīti sūtījumi", { status: 400 });

  const { data } = await session.supabase.from("shipments").select(SHIPMENT_COLS).in("id", ids);
  const rows = ((data ?? []) as ShipmentRow[]).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  const files: Buffer[] = [];
  const errors: string[] = [];
  const printed: string[] = [];
  for (const s of rows) {
    try {
      files.push(await shipmentLabelPdf(session.supabase, s));
      printed.push(s.id);
    } catch (e) {
      errors.push(`${s.tracking_number ?? s.id.slice(0, 8)}: ${e instanceof Error ? e.message : "kļūda"}`);
    }
  }
  if (files.length === 0) return new NextResponse(errors.join("\n") || "Uzlīmes nav atrastas", { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const pdf = await mergeLabels(files.map((data) => ({ data })));
  await markLabelsPrinted(session.supabase, printed);
  const name = rows.length === 1 ? `uzlime-${rows[0].tracking_number ?? rows[0].id.slice(0, 8)}` : `uzlimes-${new Date().toISOString().slice(0, 10)}`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store",
      ...(errors.length ? { "X-Label-Errors": encodeURIComponent(errors.join(" | ").slice(0, 500)) } : {}),
    },
  });
}
