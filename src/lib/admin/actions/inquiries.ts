"use server";

import { z } from "zod";
import { INQUIRY_STATUS } from "../labels";
import { ActionError, adminAction, must, revalidateAdmin, UUID_RE } from "../server";

export async function setInquiryStatus(inquiryId: string, status: string) {
  return adminAction(async ({ supabase }) => {
    z.string().regex(UUID_RE, "Nederīgs ID").parse(inquiryId);
    if (!INQUIRY_STATUS[status]) throw new ActionError("Nederīgs statuss");
    must(await supabase.from("inquiries").update({ status }).eq("id", inquiryId));
    revalidateAdmin();
    return null;
  }, `Statuss: ${INQUIRY_STATUS[status]?.label ?? status}`);
}
