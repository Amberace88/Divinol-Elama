import { requireAdmin } from "@/lib/admin/auth";
import { sp, type SP } from "@/lib/admin/params";
import { UUID_RE } from "@/lib/admin/server";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { ManualOrderForm, type ManualOrderConfig } from "@/components/admin/orders/ManualOrderForm";
import { PageHeader } from "@/components/admin/ui";
import type { OrderCustomerOption } from "@/lib/admin/actions/manual-order";

export const metadata = { title: "Jauns pasūtījums / rēķins" };

const CUSTOMER_COLS =
  "id, email, full_name, phone, customer_type, company_name, reg_no, vat_no, legal_address, market, preferred_locale, b2b_status, discount_percent, payment_terms_days";

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const customerId = sp(params, "customer");
  const from = sp(params, "from") === "invoices" ? "invoices" : "orders";

  const [settingsRes, customerRes, addressRes] = await Promise.all([
    supabase.from("settings").select("key, value").in("key", ["vat", "shipping", "invoice"]),
    UUID_RE.test(customerId) ? supabase.from("profiles").select(CUSTOMER_COLS).eq("id", customerId).maybeSingle() : Promise.resolve({ data: null }),
    UUID_RE.test(customerId)
      ? supabase
          .from("addresses")
          .select("street, city, postal_code, country")
          .eq("user_id", customerId)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [] }),
  ]);

  const map = Object.fromEntries(((settingsRes.data ?? []) as { key: string; value: Record<string, unknown> }[]).map((r) => [r.key, r.value]));
  const invoice = (map.invoice ?? {}) as { due_days_default?: number; auto_final_invoice?: boolean };
  const config: ManualOrderConfig = {
    vat: { ...DEFAULT_SETTINGS.vat, ...((map.vat as Partial<ManualOrderConfig["vat"]>) ?? {}) },
    shipping: (map.shipping as unknown as ManualOrderConfig["shipping"]) ?? DEFAULT_SETTINGS.shipping,
    dueDaysDefault: Number.isFinite(Number(invoice.due_days_default)) ? Number(invoice.due_days_default) : 7,
    autoFinalInvoice: invoice.auto_final_invoice !== false,
  };

  const raw = customerRes.data as Omit<OrderCustomerOption, "address"> | null;
  const addr = ((addressRes.data ?? []) as OrderCustomerOption["address"][])[0] ?? null;
  const customer: OrderCustomerOption | null = raw
    ? { ...raw, discount_percent: Number(raw.discount_percent) || 0, payment_terms_days: Number(raw.payment_terms_days) || 0, address: addr }
    : null;

  return (
    <>
      <PageHeader
        back={from === "invoices" ? { href: "/admin/invoices", label: "Rēķini" } : { href: "/admin/orders", label: "Pasūtījumi" }}
        eyebrow="Manuāls pasūtījums"
        title={from === "invoices" ? "Jauns rēķins" : "Jauns pasūtījums"}
        description="Pasūtījumi un rēķini klientiem pa tālruni, e-pastu vai B2B. Summas, PVN un atlikumi tiek aprēķināti tāpat kā e-veikalā; rēķins tiek piesaistīts pasūtījumam."
      />
      <ManualOrderForm config={config} initialCustomer={customer} defaultDocument={from === "invoices" ? "invoice" : null} />
    </>
  );
}
