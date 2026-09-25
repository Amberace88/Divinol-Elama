import type { Locale } from "@/i18n/routing";

export type I18nText = Partial<Record<Locale, string>>;

export type ProductI18n = {
  name: string;
  type: string;
  short: string;
  description: string;
  meta_title: string;
  meta_description: string;
};

export type Category = {
  id?: string;
  slug: string;
  icon: string;
  image?: string | null;
  sort: number;
  i18n: Partial<Record<Locale, { name: string; description: string; seo_text?: string }>>;
};

export type Variant = {
  id?: string;
  sku: string | null;
  size: number | null;
  unit: "l" | "kg" | "pcs" | string;
  /** Net price (excl. VAT) in EUR */
  price_net: number;
  /** Derived in DB from `availability` (true only for "in_stock"). Storefront badge: true → “Noliktavā”, false → “Pēc pasūtījuma”. */
  in_stock: boolean;
  availability?: "in_stock" | "on_order" | "out_of_stock" | "discontinued";
  /** Delivery lead time in days for on-order items (optional). */
  lead_time_days?: number | null;
  stock?: number | null;
  image: string | null;
};

export type Product = {
  id?: string;
  slug: string;
  base_sku: string | null;
  category: string;
  sae: string | null;
  iso_vg: string | null;
  specs: string[];
  oem_approvals: string[];
  performance: string[];
  images: string[];
  variants: Variant[];
  i18n: Partial<Record<Locale, ProductI18n>>;
  is_featured?: boolean;
  tds_url?: string | null;
  sds_url?: string | null;
};

export type Market = "LV" | "EE" | "LT";

export type CartLine = {
  slug: string;
  sku: string | null;
  variantKey: string;
  qty: number;
};
