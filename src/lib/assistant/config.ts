import "server-only";
import { createHash } from "node:crypto";
import { isDeveloperEmail } from "@/lib/admin/developer";
import { createPublicClient } from "@/lib/supabase/server";
import { anthropicConfigured } from "./anthropic";

export type AssistantSettings = { public: boolean; model: string };

export const DEFAULT_MODEL = "claude-sonnet-5";
export const ASSISTANT_MODELS: { id: string; label: string }[] = [
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — gudrākais (ieteicams)" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — ātrākais, lētākais" },
];

/** Settings key 'assistant' ({public, model} — a public settings row). */
export async function getAssistantSettings(): Promise<AssistantSettings> {
  try {
    const client = createPublicClient();
    const { data } = await client.from("settings").select("value").eq("key", "assistant").maybeSingle();
    const v = (data?.value ?? {}) as Partial<AssistantSettings>;
    return { public: Boolean(v.public), model: process.env.ASSISTANT_MODEL?.trim() || v.model || DEFAULT_MODEL };
  } catch {
    return { public: false, model: process.env.ASSISTANT_MODEL?.trim() || DEFAULT_MODEL };
  }
}

/** Who may use the assistant: everybody when switched on in the admin, otherwise only developer accounts. */
export function assistantAllowed(settings: AssistantSettings, email: string | null | undefined) {
  if (!anthropicConfigured()) return false;
  return settings.public || isDeveloperEmail(email);
}

export function ipHash(ip: string | null) {
  return ip ? createHash("sha256").update(`divinol-assistant:${ip}`).digest("hex").slice(0, 32) : null;
}

/** Limits per visitor (IP) — keeps the API bill predictable. */
export const LIMITS = { turnsPerHour: 40, turnsPerChat: 40, maxUserChars: 2000, maxToolRounds: 6, maxTokens: 1400 };
