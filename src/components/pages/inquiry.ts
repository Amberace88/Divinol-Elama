"use client";

import { submitInquiryAction } from "@/lib/email/actions";
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

/** Sends an inquiry through a Server Action (`submit_inquiry` RPC + shop e-mail notification). */
export async function submitInquiry(payload: InquiryPayload) {
  if (!isSupabaseConfigured) throw new InquiryError("unavailable");
  const clean = Object.fromEntries(
    Object.entries(payload).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]),
  ) as InquiryPayload;
  const res = await submitInquiryAction(clean as Parameters<typeof submitInquiryAction>[0]).catch(() => ({ ok: false as const, code: "failed" as const }));
  if (!res.ok) throw new InquiryError(res.code);
}

/** Reads a FormData entry as trimmed string. */
export function field(fd: FormData, name: string) {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}
