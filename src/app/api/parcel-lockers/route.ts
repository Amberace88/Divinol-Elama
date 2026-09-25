import { NextResponse, type NextRequest } from "next/server";
import { listPickupPoints } from "@/lib/shipping/registry";
import { getCheckoutLockerProviders } from "@/lib/shipping/checkout";
import type { Market } from "@/lib/types";

/**
 * GET /api/parcel-lockers?country=LV[&provider=omniva]
 * Pickup points of one locker provider (default Omniva — backward compatible response shape `{ provider, country, lockers }`).
 * Only providers enabled for checkout in the admin (Sūtījumi → Tarifi → Pārvadātāji) are served.
 */
export async function GET(req: NextRequest) {
  const country = (req.nextUrl.searchParams.get("country") ?? "LV").toUpperCase() as Market;
  const provider = (req.nextUrl.searchParams.get("provider") ?? "omniva").toLowerCase();
  if (!["LV", "EE", "LT"].includes(country)) return NextResponse.json({ error: "invalid_country" }, { status: 400 });
  const enabled = await getCheckoutLockerProviders();
  if (!enabled.some((p) => p.id === provider)) return NextResponse.json({ provider, country, lockers: [], error: "provider_unavailable" }, { status: 404 });
  try {
    const points = await listPickupPoints(provider, country);
    const lockers = points.map(({ id, name, city, address, lat, lng }) => ({ id, name, city, address, lat, lng }));
    return NextResponse.json(
      { provider, country, lockers },
      { headers: { "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400" } },
    );
  } catch {
    return NextResponse.json({ provider, country, lockers: [], error: "unavailable" }, { status: 503 });
  }
}
