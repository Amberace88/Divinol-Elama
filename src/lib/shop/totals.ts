import { round2, unitNet, type PriceContext } from "@/lib/commerce";

export type TotalsLine = { price_net: number; qty: number };

/** Order totals computed the same way as the `place_order` SQL function. */
export function computeTotals(
  lines: TotalsLine[],
  ctx: PriceContext,
  vatRate: number,
  shippingNet = 0,
  reverseCharge = false,
) {
  const subtotalNet = round2(lines.reduce((s, l) => s + round2(unitNet(l, ctx) * l.qty), 0));
  const rate = reverseCharge ? 0 : vatRate;
  const vat = round2(((subtotalNet + shippingNet) * rate) / 100);
  const total = round2(subtotalNet + shippingNet + vat);
  /** subtotal incl. VAT (0 % on reverse charge, like the server) — used for the free shipping threshold */
  const subtotalGross = round2(subtotalNet * (1 + rate / 100));
  return { subtotalNet, shippingNet, vatRate: rate, vat, total, subtotalGross };
}
