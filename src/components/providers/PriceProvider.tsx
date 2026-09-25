"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import type { Market } from "@/lib/types";
import { DEFAULT_PRICE_CONTEXT, type PriceContext } from "@/lib/commerce";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  b2b_status: string;
  discount_percent: number;
  market: Market;
  customer_type: string;
  company_name: string | null;
};

type Ctx = PriceContext & {
  setMarket: (m: Market) => void;
  profile: Profile | null;
  loading: boolean;
  refresh: () => void;
};

const PriceCtx = createContext<Ctx | null>(null);

function marketForLocale(locale: string): Market {
  return locale === "et" ? "EE" : locale === "lt" ? "LT" : "LV";
}

export function PriceProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const [market, setMarketState] = useState<Market>(marketForLocale(locale));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )market=(LV|EE|LT)/)?.[1] as Market | undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with cookie after hydration
    if (m) setMarketState(m);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = createClient();
    let active = true;
    const load = async () => {
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) {
        if (active) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await sb
        .from("profiles")
        .select("id, email, full_name, role, b2b_status, discount_percent, market, customer_type, company_name")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (active) {
        setProfile((data as Profile) ?? null);
        setLoading(false);
      }
    };
    load();
    const { data: sub } = sb.auth.onAuthStateChange(() => load());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [tick]);

  const setMarket = useCallback((m: Market) => {
    document.cookie = `market=${m}; path=/; max-age=31536000; samesite=lax`;
    setMarketState(m);
  }, []);

  const value = useMemo<Ctx>(() => {
    const b2b = profile?.b2b_status === "approved";
    return {
      ...DEFAULT_PRICE_CONTEXT,
      market,
      b2b,
      discountPercent: b2b ? Number(profile?.discount_percent ?? 0) : 0,
      setMarket,
      profile,
      loading,
      refresh: () => setTick((t) => t + 1),
    };
  }, [market, profile, loading, setMarket]);

  return <PriceCtx.Provider value={value}>{children}</PriceCtx.Provider>;
}

export function usePricing() {
  const ctx = useContext(PriceCtx);
  if (!ctx) throw new Error("usePricing must be used inside PriceProvider");
  return ctx;
}
