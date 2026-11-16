"use server";

import { z } from "zod";
import { INQUIRY_STATUS } from "../labels";
import { ActionError, adminAction, must, revalidateAdmin, UUID_RE } from "../server";

export async function setInquiryStatus(inquiryId: string, status: string) {
  return adminAction(async ({ supabase }) => {
    z.string().regex(UUID_RE, "Nederīgs ID").parse(inquiryId);
    if (!INQUIRY_STATUS[status]) throw new ActionError("Nederīgs statuss");
    if (status === "spam") {
      // remember why (shown in the admin) — the sender's e-mail / phone is then blocked by submit_inquiry
      const { data: row } = await supabase.from("inquiries").select("payload").eq("id", inquiryId).maybeSingle();
      const payload = (row?.payload ?? {}) as Record<string, unknown>;
      must(await supabase.from("inquiries").update({ status, payload: payload.spam_reason ? payload : { ...payload, spam_reason: "manual" } }).eq("id", inquiryId));
    } else {
      must(await supabase.from("inquiries").update({ status }).eq("id", inquiryId));
    }
    revalidateAdmin();
    return null;
  }, `Statuss: ${INQUIRY_STATUS[status]?.label ?? status}`);
}
