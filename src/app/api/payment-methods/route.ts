import { NextResponse, type NextRequest } from "next/server";
import { isMontonioConfigured, listPaymentMethods } from "@/lib/payments/montonio";

/**
 * GET /api/payment-methods?country=LV → online payment options for the checkout (Montonio):
 * { enabled, banks: [{ code, name, logoUrl }], card: { enabled, logoUrl }, applePay, googlePay }.
 * Montonio's list is cached for 1 h on the server (unstable_cache) and 10 min at the CDN.
 */
export async function GET(req: NextRequest) {
  const country = (req.nextUrl.searchParams.get("country") ?? "LV").toUpperCase();
  if (!["LV", "EE", "LT"].includes(country)) return NextResponse.json({ error: "invalid_country" }, { status: 400 });
  if (!isMontonioConfigured()) {
    return NextResponse.json({ enabled: false, country, banks: [], card: { enabled: false, logoUrl: null }, applePay: false, googlePay: false });
  }
  try {
    const m = await listPaymentMethods();
    const banks = m.banks[country] ?? [];
    return NextResponse.json(
      {
        enabled: banks.length > 0 || m.card.enabled,
        country,
        banks,
        card: m.card,
        applePay: m.applePay,
        googlePay: m.googlePay,
      },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
    );
  } catch (e) {
    console.error("[payment-methods] Montonio", e);
    return NextResponse.json(
      { enabled: false, country, banks: [], card: { enabled: false, logoUrl: null }, applePay: false, googlePay: false, error: "unavailable" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
