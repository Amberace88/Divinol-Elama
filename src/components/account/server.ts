import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { PROFILE_COLUMNS, type AccountProfile } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AccountSession = { supabase: Supabase; user: User; profile: AccountProfile };

function fallbackProfile(user: User): AccountProfile {
  const m = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  return {
    id: user.id,
    email: user.email ?? "",
    full_name: m.full_name ?? null,
    phone: m.phone ?? null,
    role: "customer",
    customer_type: m.customer_type === "business" ? "business" : "private",
    company_name: m.company_name ?? null,
    reg_no: m.reg_no ?? null,
    vat_no: m.vat_no ?? null,
    legal_address: m.legal_address ?? null,
    b2b_status: "none",
    discount_percent: 0,
    payment_terms_days: 0,
    market: m.market === "EE" || m.market === "LT" ? m.market : "LV",
    preferred_locale: m.locale ?? "lv",
    marketing_consent: false,
    created_at: user.created_at ?? null,
  };
}

/** Session user + profile for the current request (deduplicated between layout and page). */
export const getAccount = cache(async (): Promise<AccountSession | null> => {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    const { data: profile } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", data.user.id).maybeSingle();
    const p = (profile as AccountProfile | null) ?? fallbackProfile(data.user);
    return {
      supabase,
      user: data.user,
      profile: {
        ...p,
        email: p.email || data.user.email || "",
        discount_percent: Number(p.discount_percent ?? 0),
        payment_terms_days: Number(p.payment_terms_days ?? 0),
      },
    };
  } catch {
    return null;
  }
});

/** Guard for account pages: redirects anonymous visitors to the login page. */
export async function requireAccount(locale: string, next = "/account"): Promise<AccountSession> {
  const account = await getAccount();
  if (!account) {
    return redirect({ href: { pathname: "/login", query: { next } }, locale });
  }
  return account;
}
