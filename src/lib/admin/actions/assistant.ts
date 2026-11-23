"use server";

import { z } from "zod";
import { ASSISTANT_MODELS } from "@/lib/assistant/config";
import { isDeveloperEmail } from "../developer";
import { ActionError, adminAction, must, revalidateAdmin } from "../server";

/** Iestatījumi → AI palīgs: who sees it (developer only / everybody) and which model answers. Developer accounts only. */
export async function saveAssistantSettings(input: { public: boolean; model: string }) {
  return adminAction(async ({ supabase, user }) => {
    if (!isDeveloperEmail(user.email)) throw new ActionError("Tikai izstrādātājam");
    const v = z.object({ public: z.boolean(), model: z.string().refine((m) => ASSISTANT_MODELS.some((x) => x.id === m), "Nederīgs modelis") }).parse(input);
    must(await supabase.from("settings").upsert({ key: "assistant", value: v, is_public: false }, { onConflict: "key" }));
    revalidateAdmin();
    return v;
  }, (v) => (v.public ? "AI palīgs redzams visiem apmeklētājiem" : "AI palīgs redzams tikai izstrādātājam"));
}
