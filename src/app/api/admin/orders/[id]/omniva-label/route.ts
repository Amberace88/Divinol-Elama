import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { getOmnivaLabel, OmnivaError } from "@/lib/shipping/omniva";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (session.status !== "ok") return new NextResponse("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const { data: order } = await session.supabase.from("orders").select("number, tracking_code").eq("id", id).maybeSingle<{ number: string; tracking_code: string | null }>();
  if (!order?.tracking_code) return new NextResponse("Nav sūtījuma koda", { status: 404 });
  try {
    const pdf = await getOmnivaLabel(order.tracking_code);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="omniva-${order.number}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return new NextResponse(e instanceof OmnivaError ? e.message : "Omniva kļūda", { status: 502 });
  }
}
