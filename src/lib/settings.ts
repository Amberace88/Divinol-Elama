import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";
import { FREE_SHIPPING_THRESHOLD, VAT_RATES } from "./commerce";
import type { Market } from "./types";

export type CompanySettings = {
  name: string;
  reg_no: string;
  vat_no: string;
  address: string;
  warehouse: string;
  phone: string;
  email: string;
  bank_name?: string;
  iban?: string;
  swift?: string;
  hours?: string;
};

export type ShippingConfig = {
  free_threshold: Record<Market, number>;
  methods: Record<
    string,
    { price_net: number | null; markets: Market[]; max_item?: number; free_over?: boolean; enabled?: boolean; surcharge?: Partial<Record<Market, number>> }
  >;
};

export type StoreSettings = {
  company: CompanySettings;
  vat: Record<Market, number>;
  shipping: ShippingConfig;
};

export const SETTINGS_TAG = "settings";

export const DEFAULT_SETTINGS: StoreSettings = {
  company: {
    name: 'SIA "Elama"',
    reg_no: "40103512445",
    vat_no: "LV40103512445",
    address: '"Priežkalni 2", Jumpravas pag., Ogres nov., LV-5022',
    warehouse: "Ventspils iela 51, Rīga, LV-1002",
    phone: "+371 26556099",
    email: "elama@elama.lv",
  },
  vat: VAT_RATES,
  shipping: {
    free_threshold: FREE_SHIPPING_THRESHOLD,
    methods: {
      pickup: { price_net: 0, markets: ["LV"], enabled: true },
      parcel_locker: { price_net: 2.89, markets: ["LV", "EE", "LT"], max_item: 20, free_over: true, enabled: true },
      courier: { price_net: 5.79, surcharge: { LV: 0, EE: 4.13, LT: 4.13 }, markets: ["LV", "EE", "LT"], max_item: 25, free_over: true, enabled: true },
      freight: { price_net: null, markets: ["LV", "EE", "LT"], enabled: true },
    },
  },
};

export const getStoreSettings = unstable_cache(
  async (): Promise<StoreSettings> => {
    if (!isSupabaseConfigured) return DEFAULT_SETTINGS;
    try {
      const { data } = await createPublicClient().from("settings").select("key, value").in("key", ["company", "vat", "shipping"]);
      const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
      return {
        company: { ...DEFAULT_SETTINGS.company, ...(map.company ?? {}) },
        vat: { ...DEFAULT_SETTINGS.vat, ...(map.vat ?? {}) },
        shipping: map.shipping ?? DEFAULT_SETTINGS.shipping,
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
  ["store-settings-v1"],
  { tags: [SETTINGS_TAG], revalidate: 3600 },
);
