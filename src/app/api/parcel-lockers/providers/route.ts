import { NextResponse, type NextRequest } from "next/server";
import { getCheckoutLockerProviders } from "@/lib/shipping/checkout";
import { listPickupPoints } from "@/lib/shipping/registry";
import type { Market } from "@/lib/types";

/** GET /api/parcel-lockers/providers?country=LV → locker providers offered at checkout that have points in that country. */
export async function GET(req: NextRequest) {
  const country = (req.nextUrl.searchParams.get("country") ?? "LV").toUpperCase() as Market;
  if (!["LV", "EE", "LT"].includes(country)) return NextResponse.json({ error: "invalid_country" }, { status: 400 });
  const enabled = await getCheckoutLockerProviders();
  const checked = await Promise.all(
    enabled.map(async (p) => {
      try {
        const n = (await listPickupPoints(p.id, country)).length;
        return n > 0 ? { ...p, count: n } : null;
      } catch {
        // feed down: still offer Omniva (the historical default) so checkout keeps working with free-text input
        return p.id === "omniva" ? { ...p, count: 0 } : null;
      }
    }),
  );
  return NextResponse.json(
    { country, providers: checked.filter(Boolean) },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  );
}
