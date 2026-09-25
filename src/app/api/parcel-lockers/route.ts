import { NextResponse, type NextRequest } from "next/server";
import { getOmnivaLockers } from "@/lib/shipping/omniva";
import type { Market } from "@/lib/types";

export async function GET(req: NextRequest) {
  const country = (req.nextUrl.searchParams.get("country") ?? "LV").toUpperCase() as Market;
  if (!["LV", "EE", "LT"].includes(country)) return NextResponse.json({ error: "invalid_country" }, { status: 400 });
  try {
    const lockers = await getOmnivaLockers(country);
    return NextResponse.json(
      { provider: "omniva", country, lockers },
      { headers: { "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400" } },
    );
  } catch {
    return NextResponse.json({ provider: "omniva", country, lockers: [], error: "unavailable" }, { status: 503 });
  }
}
