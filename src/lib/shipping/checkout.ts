import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { pickupFeedAvailable } from "./registry";

export type CheckoutLockerProvider = { id: string; name: string };

const DEFAULT: CheckoutLockerProvider[] = [{ id: "omniva", name: "Omniva" }];

/**
 * Locker providers offered to customers: carriers marked "checkout_enabled" in the admin that have a pickup-point feed
 * in this deployment. Customer price is the same for every provider — it comes from settings.shipping.methods.parcel_locker
 * (so place_order and the free-shipping threshold are unchanged).
 */
export const getCheckoutLockerProviders = unstable_cache(
  async (): Promise<CheckoutLockerProvider[]> => {
    if (!isSupabaseConfigured) return DEFAULT;
    try {
      const { data, error } = await createPublicClient()
        .from("shipping_carriers")
        .select("code, name, sort")
        .eq("enabled", true)
        .eq("checkout_enabled", true)
        .order("sort");
      if (error) return DEFAULT;
      const list = (data ?? []).filter((c) => pickupFeedAvailable(c.code)).map((c) => ({ id: c.code as string, name: c.name as string }));
      return list.length ? list : DEFAULT;
    } catch {
      return DEFAULT;
    }
  },
  ["checkout-locker-providers-v1"],
  { tags: ["shipping-carriers"], revalidate: 600 },
);
