import type { OrderEmailData } from "./order-parts";

/** Sample data for the admin "test e-mail" and the preview script. */
export function sampleOrder(overrides: Partial<OrderEmailData> = {}): OrderEmailData {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    number: "DIV-2026-00042",
    created_at: new Date().toISOString(),
    locale: "lv",
    email: "klients@example.com",
    phone: "+371 20000000",
    user_id: "00000000-0000-4000-8000-000000000001",
    status: "new",
    payment_status: "unpaid",
    customer: { name: "Jānis Bērziņš", company_name: null, reg_no: null, vat_no: null, customer_type: "private", b2b: false, discount_percent: 0 },
    market: "LV",
    payment_method: "bank_transfer",
    shipping_method: "parcel_locker",
    shipping_point: { provider: "omniva", id: "9999", name: "Rīga Spice pakomāts", city: "Rīga", address: "Lielirbes iela 29" },
    shipping_address: null,
    billing_address: null,
    items: [
      { name: "Divinol Syntholight 5W-30", pack_label: "4 L", sku: "49530-4", qty: 2, unit_price_net: 28.84, line_net: 57.68 },
      { name: "Divinol Multilight 10W-40", pack_label: "1 L", sku: "49110-1", qty: 3, unit_price_net: 6.9, line_net: 20.7 },
      { name: "Divinol Kühlerfrostschutz KFS 12++", pack_label: "1,5 L", sku: "29190-1.5", qty: 1, unit_price_net: 7.4, line_net: 7.4 },
    ],
    subtotal_net: 85.78,
    shipping_net: 2.89,
    vat_rate: 21,
    vat_amount: 18.62,
    total_gross: 107.29,
    reverse_charge: false,
    notes: "Lūdzu, piezvaniet pirms piegādes.",
    tracking_code: null,
    tracking_url: null,
    tracking_carrier: null,
    ...overrides,
  };
}

export function sampleB2BOrder(): OrderEmailData {
  return sampleOrder({
    number: "DIV-2026-00043",
    locale: "en",
    email: "purchasing@example.ee",
    market: "EE",
    customer: { name: "Mari Tamm", company_name: "Autoteenindus OÜ", reg_no: "12345678", vat_no: "EE101234567", customer_type: "business", b2b: true, discount_percent: 12 },
    payment_method: "invoice",
    shipping_method: "courier",
    shipping_point: null,
    shipping_address: { street: "Peterburi tee 46", city: "Tallinn", postal_code: "11415", country: "EE" },
    items: [
      { name: "Divinol Multilight 10W-40", pack_label: "20 L", sku: "49110-20", qty: 2, unit_price_net: 83.51, line_net: 167.02 },
      { name: "Divinol Hydrauliköl HLP 46", pack_label: "20 L", sku: "48130-20", qty: 1, unit_price_net: 71.28, line_net: 71.28 },
    ],
    subtotal_net: 238.3,
    shipping_net: 0,
    vat_rate: 0,
    vat_amount: 0,
    total_gross: 238.3,
    reverse_charge: true,
    notes: null,
  });
}
