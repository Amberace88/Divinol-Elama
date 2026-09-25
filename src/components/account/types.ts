import type { Market } from "@/lib/types";

export type B2BStatus = "none" | "pending" | "approved" | "rejected";

export type AccountProfile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  customer_type: "private" | "business";
  company_name: string | null;
  reg_no: string | null;
  vat_no: string | null;
  legal_address: string | null;
  b2b_status: B2BStatus;
  discount_percent: number;
  payment_terms_days: number;
  market: Market;
  preferred_locale: string;
  marketing_consent: boolean;
  created_at: string | null;
};

export const PROFILE_COLUMNS =
  "id, email, full_name, phone, role, customer_type, company_name, reg_no, vat_no, legal_address, b2b_status, discount_percent, payment_terms_days, market, preferred_locale, marketing_consent, created_at";

export type OrderRow = {
  id: string;
  number: string;
  created_at: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_gross: number | string;
};

export type InvoiceRow = {
  id: string;
  number: string;
  order_id: string | null;
  type: "proforma" | "invoice" | "credit_note" | string;
  status: "issued" | "paid" | "void" | string;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  total_gross: number | string;
};

export const INVOICE_COLUMNS = "id, number, order_id, type, status, issued_at, due_at, paid_at, total_gross";

export type AddressRow = {
  id: string;
  label: string | null;
  name: string;
  phone: string | null;
  company: string | null;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  is_default: boolean;
};

export const ADDRESS_COLUMNS = "id, label, name, phone, company, street, city, postal_code, country, is_default";

export type ActionResult = { ok: true } | { ok: false; error: string };
