"use server";

import { deferEmail } from "@/lib/email/send";
import { notifyInvoiceIssued, notifyManualOrder } from "@/lib/email/notify";
import { issuesToFieldErrors } from "../schemas";
import { ActionError, adminAction, must, revalidateAdmin, sanitizeSearch } from "../server";
import { MANUAL_ORDER_ERRORS, manualOrderSchema, normalizeVatNo, type ManualOrderResult } from "../manual-order";

// ───────────────────────── lookups for the form ─────────────────────────

export type OrderCustomerOption = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  customer_type: string;
  company_name: string | null;
  reg_no: string | null;
  vat_no: string | null;
  legal_address: string | null;
  market: string;
  preferred_locale: string;
  b2b_status: string;
  discount_percent: number;
  payment_terms_days: number;
  address: { street: string; city: string; postal_code: string; country: string } | null;
};

const CUSTOMER_COLS =
  "id, email, full_name, phone, customer_type, company_name, reg_no, vat_no, legal_address, market, preferred_locale, b2b_status, discount_percent, payment_terms_days";

type Supabase = Parameters<Parameters<typeof adminAction>[0]>[0]["supabase"];

async function withAddresses(supabase: Supabase, rows: Omit<OrderCustomerOption, "address">[]): Promise<OrderCustomerOption[]> {
  if (rows.length === 0) return [];
  const { data } = await supabase
    .from("addresses")
    .select("user_id, street, city, postal_code, country, is_default, created_at")
    .in(
      "user_id",
      rows.map((r) => r.id),
    )
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  const byUser = new Map<string, OrderCustomerOption["address"]>();
  for (const a of (data ?? []) as { user_id: string; street: string; city: string; postal_code: string; country: string }[]) {
    if (!byUser.has(a.user_id)) byUser.set(a.user_id, { street: a.street, city: a.city, postal_code: a.postal_code, country: a.country });
  }
  return rows.map((r) => ({
    ...r,
    discount_percent: Number(r.discount_percent) || 0,
    payment_terms_days: Number(r.payment_terms_days) || 0,
    address: byUser.get(r.id) ?? null,
  }));
}

/** Customer search for the manual order form (name / company / e-mail / reg. no. / VAT no. / phone). */
export async function searchOrderCustomers(query: string) {
  return adminAction(async ({ supabase }) => {
    const q = sanitizeSearch(query, 60);
    if (q.length < 2) return [] as OrderCustomerOption[];
    const rows = must(
      await supabase
        .from("profiles")
        .select(CUSTOMER_COLS)
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%,reg_no.ilike.%${q}%,vat_no.ilike.%${q}%,phone.ilike.%${q}%`)
        .order("b2b_status", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(10),
    ) as Omit<OrderCustomerOption, "address">[];
    return withAddresses(supabase, rows);
  });
}

export type OrderProductOption = {
  product_id: string;
  name: string;
  sae: string | null;
  base_sku: string | null;
  image: string | null;
  is_active: boolean;
  variants: {
    id: string;
    sku: string | null;
    size: number | null;
    unit: string;
    price_net: number;
    stock: number | null;
    availability: string;
    is_active: boolean;
    image: string | null;
  }[];
};

type ProductRow = {
  id: string;
  sae: string | null;
  base_sku: string | null;
  images: string[] | null;
  is_active: boolean;
  i18n: Record<string, { name?: string }> | null;
  product_variants: OrderProductOption["variants"] | null;
};

const PRODUCT_COLS = "id, sae, base_sku, images, is_active, i18n, product_variants(id, sku, size, unit, price_net, stock, availability, is_active, image, sort)";

/** Catalog search for the manual order form (name / SAE / base SKU / variant SKU). */
export async function searchOrderProducts(query: string) {
  return adminAction(async ({ supabase }) => {
    const q = sanitizeSearch(query, 60);
    if (q.length < 2) return [] as OrderProductOption[];
    const [byText, bySku] = await Promise.all([
      supabase.from("products").select(PRODUCT_COLS).or(`i18n->lv->>name.ilike.%${q}%,sae.ilike.%${q}%,base_sku.ilike.%${q}%,slug.ilike.%${q}%`).order("sort").limit(15),
      supabase.from("product_variants").select("product_id").ilike("sku", `%${q}%`).limit(15),
    ]);
    const rows = [...((must(byText) ?? []) as unknown as ProductRow[])];
    const have = new Set(rows.map((r) => r.id));
    const extra = [...new Set(((must(bySku) ?? []) as { product_id: string }[]).map((r) => r.product_id))].filter((id) => !have.has(id));
    if (extra.length) rows.push(...((must(await supabase.from("products").select(PRODUCT_COLS).in("id", extra)) ?? []) as unknown as ProductRow[]));
    return rows
      .map<OrderProductOption>((p) => ({
        product_id: p.id,
        name: p.i18n?.lv?.name || p.base_sku || "—",
        sae: p.sae,
        base_sku: p.base_sku,
        image: p.images?.[0] ?? null,
        is_active: p.is_active,
        variants: [...(p.product_variants ?? [])]
          .filter((v) => v.availability !== "discontinued" || v.stock)
          .sort((a, b) => Number(a.size ?? 0) - Number(b.size ?? 0))
          .map((v) => ({ ...v, price_net: Number(v.price_net), size: v.size == null ? null : Number(v.size) })),
      }))
      .filter((p) => p.variants.length > 0)
      .sort((a, b) => Number(b.is_active) - Number(a.is_active))
      .slice(0, 20);
  });
}

// ───────────────────────── create ─────────────────────────

type RpcResult = {
  id: string;
  number: string;
  invoice_number: string | null;
  final_invoice_number: string | null;
  total_gross: number | string;
};

const addr = (a: { street: string; city: string; postal_code: string; country: string } | null) =>
  a && (a.street || a.city || a.postal_code) ? a : null;

export async function createManualOrder(input: unknown) {
  return adminAction(
    async ({ supabase }) => {
      const parsed = manualOrderSchema.safeParse(input);
      if (!parsed.success) throw new ActionError("Pārbaudiet iezīmētos laukus", issuesToFieldErrors(parsed.error.issues));
      const o = parsed.data;
      const business = o.customer.customer_type === "business";

      const payload = {
        user_id: o.user_id,
        email: o.email.toLowerCase(),
        phone: o.phone,
        market: o.market,
        locale: o.locale,
        customer: {
          customer_type: o.customer.customer_type,
          name: o.customer.name,
          company_name: business ? o.customer.company_name : "",
          reg_no: business ? o.customer.reg_no : "",
          vat_no: business ? normalizeVatNo(o.customer.vat_no) : "",
          legal_address: o.customer.legal_address,
        },
        billing_address: addr(o.billing_address),
        shipping_address: o.shipping_method === "courier" || o.shipping_method === "freight" ? addr(o.shipping_address) : null,
        shipping_point: o.shipping_method === "parcel_locker" && o.shipping_point?.name ? { name: o.shipping_point.name } : null,
        shipping_method: o.shipping_method,
        shipping_net: o.shipping_net,
        payment_method: o.payment_method,
        payment_status: o.payment_status,
        status: o.status,
        document: o.document,
        due_days: o.due_days,
        discount_percent: o.discount_percent,
        reverse_charge: o.reverse_charge,
        notes: o.notes,
        admin_notes: o.admin_notes,
        items: o.items.map((l) =>
          l.kind === "product"
            ? { variant_id: l.variant_id, qty: l.qty, unit_price_net: l.unit_price_net, name: l.name }
            : { name: l.name, sku: l.sku, unit: l.unit, qty: l.qty, unit_price_net: l.unit_price_net },
        ),
      };

      const { data, error } = await supabase.rpc("admin_create_order", { payload });
      if (error) {
        const code = (error.message ?? "").split(":")[0].trim();
        if (MANUAL_ORDER_ERRORS[code]) throw new ActionError(MANUAL_ORDER_ERRORS[code]);
        throw error;
      }
      const res = data as RpcResult;

      if (o.send_email && o.email) {
        deferEmail("manual order", () => notifyManualOrder(supabase, res.id, res.invoice_number));
        const finalNumber = res.final_invoice_number;
        if (finalNumber) deferEmail("invoice issued", () => notifyInvoiceIssued(supabase, finalNumber));
      }
      revalidateAdmin();
      return {
        id: res.id,
        number: res.number,
        invoice_number: res.invoice_number,
        final_invoice_number: res.final_invoice_number,
        total_gross: Number(res.total_gross) || 0,
      } satisfies ManualOrderResult;
    },
    (d) => `Pasūtījums ${d.number} izveidots${[d.invoice_number, d.final_invoice_number].filter(Boolean).length ? ` · ${[d.invoice_number, d.final_invoice_number].filter(Boolean).join(", ")}` : ""}`,
  );
}
