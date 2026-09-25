"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type InquiryType = "contact" | "b2b" | "quote" | "oil_finder";

export type InquiryPayload = {
  type: InquiryType;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  locale: string;
  extra?: Record<string, unknown>;
};

export class InquiryError extends Error {
  constructor(public code: "unavailable" | "invalid_email" | "failed") {
    super(code);
  }
}

/** Sends an inquiry through the `submit_inquiry` RPC (security definer, callable by anon). */
export async function submitInquiry(payload: InquiryPayload) {
  if (!isSupabaseConfigured) throw new InquiryError("unavailable");
  const clean = Object.fromEntries(
    Object.entries(payload).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]),
  ) as InquiryPayload;
  const { error } = await createClient().rpc("submit_inquiry", { payload: clean });
  if (error) {
    if (/invalid_email/.test(error.message)) throw new InquiryError("invalid_email");
    throw new InquiryError("failed");
  }
}

/** Reads a FormData entry as trimmed string. */
export function field(fd: FormData, name: string) {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}
