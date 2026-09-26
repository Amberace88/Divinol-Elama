import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Service-role Supabase client (bypasses RLS). Server-only and used ONLY where there is no user session but the
 * server itself has proven the request: the Montonio webhook (signed JWT), the payment return page (HMAC-signed
 * link) and the checkout action right after `place_order`. The payment RPCs (payment_attach / payment_apply_status /
 * payment_switch_to_transfer, migration 0011) are executable by this role only.
 *
 * Env: SUPABASE_SERVICE_ROLE_KEY (Supabase → Project Settings → API keys → service_role / secret key).
 */
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

export function isServiceRoleConfigured() {
  return Boolean(SUPABASE_URL && KEY());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: SupabaseClient<any, any, any> | null = null;

export function createServiceClient() {
  if (!isServiceRoleConfigured()) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  if (!client) {
    client = createClient(SUPABASE_URL, KEY(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
