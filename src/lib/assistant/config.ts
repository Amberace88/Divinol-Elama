import "server-only";
import { createHash } from "node:crypto";
import { isDeveloperEmail } from "@/lib/admin/developer";
import { createPublicClient } from "@/lib/supabase/server";
import { anthropicConfigured } from "./anthropic";
import { isWorkersModel, workersAiAvailable } from "./workers-ai";

export type AssistantSettings = { public: boolean; model: string };

export const DEFAULT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
export const ASSISTANT_MODELS: { id: string; label: string }[] = [
  { id: "@cf/meta/llama-4-scout-17b-16e-instruct", label: "Cloudflare Llama 4 Scout — bez maksas (ieteicams)" },
  { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Cloudflare Llama 3.3 70B — bez maksas, lielāks" },
  { id: "@cf/qwen/qwen3-30b-a3b-fp8", label: "Cloudflare Qwen3 30B — bez maksas, taupīgākais" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — gudrākais (maksas, vajag ANTHROPIC_API_KEY)" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — ātrs (maksas, vajag ANTHROPIC_API_KEY)" },
];

/** Settings key 'assistant' ({public, model} — a public settings row). */
export async function getAssistantSettings(): Promise<AssistantSettings> {
  try {
    const client = createPublicClient();
    const { data } = await client.from("settings").select("value").eq("key", "assistant").maybeSingle();
    const v = (data?.value ?? {}) as Partial<AssistantSettings>;
    let model = process.env.ASSISTANT_MODEL?.trim() || v.model || DEFAULT_MODEL;
    // a paid Claude model without a key → fall back to the free Workers AI model
    if (!isWorkersModel(model) && !anthropicConfigured()) model = DEFAULT_MODEL;
    return { public: Boolean(v.public), model };
  } catch {
    return { public: false, model: process.env.ASSISTANT_MODEL?.trim() || DEFAULT_MODEL };
  }
}

/** Can the configured model answer here? Workers AI needs the Worker's AI binding, Claude needs ANTHROPIC_API_KEY. */
export async function modelAvailable(model: string) {
  return isWorkersModel(model) ? workersAiAvailable() : anthropicConfigured();
}

/** Who may use the assistant: everybody when switched on in the admin, otherwise only developer accounts. */
export async function assistantAllowed(settings: AssistantSettings, email: string | null | undefined) {
  if (!(await modelAvailable(settings.model))) return false;
  return settings.public || isDeveloperEmail(email);
}

export function ipHash(ip: string | null) {
  return ip ? createHash("sha256").update(`divinol-assistant:${ip}`).digest("hex").slice(0, 32) : null;
}

/** Limits per visitor (IP) — keeps the API bill predictable. */
export const LIMITS = { turnsPerHour: 40, turnsPerChat: 40, maxUserChars: 2000, maxToolRounds: 6, maxTokens: 1400 };
