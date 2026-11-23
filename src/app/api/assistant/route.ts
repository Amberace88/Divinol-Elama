import { type NextRequest } from "next/server";
import { z } from "zod";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ApiMessage } from "@/lib/assistant/anthropic";
import { runChat } from "@/lib/assistant/run";
import { assistantAllowed, getAssistantSettings, ipHash, LIMITS } from "@/lib/assistant/config";
import { buildSystemPrompt } from "@/lib/assistant/knowledge";
import type { ToolContext } from "@/lib/assistant/tools";
import type { Market } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Viewer = { id: string; email: string | null; name: string | null; b2b: boolean; discount: number } | null;

async function viewer(): Promise<Viewer> {
  if (!isSupabaseConfigured) return null;
  try {
    const sb = await createClient();
    const { data } = await sb.auth.getUser();
    const u = data.user;
    if (!u) return null;
    const { data: p } = await sb.from("profiles").select("full_name, b2b_status, discount_percent").eq("id", u.id).maybeSingle();
    const b2b = p?.b2b_status === "approved";
    return { id: u.id, email: u.email ?? null, name: (p?.full_name as string | null) ?? null, b2b, discount: b2b ? Number(p?.discount_percent ?? 0) : 0 };
  } catch {
    return null;
  }
}

/** GET → is the assistant available for this visitor? (the widget renders nothing otherwise) */
export async function GET() {
  const [settings, v] = await Promise.all([getAssistantSettings(), viewer()]);
  const enabled = assistantAllowed(settings, v?.email);
  return Response.json({ enabled, preview: enabled && !settings.public }, { headers: { "Cache-Control": "private, no-store" } });
}

const bodySchema = z.object({
  chatId: z.string().uuid().nullable().optional(),
  locale: z.string(),
  market: z.enum(["LV", "EE", "LT"]),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .min(1)
    .max(60),
  cart: z.array(z.object({ slug: z.string().max(200), key: z.string().max(100), qty: z.number().int().min(1).max(999) })).max(60).default([]),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const body = parsed.data;
  const locale: Locale = hasLocale(routing.locales, body.locale) ? body.locale : routing.defaultLocale;
  const market = body.market as Market;

  const [settings, v] = await Promise.all([getAssistantSettings(), viewer()]);
  if (!assistantAllowed(settings, v?.email)) return Response.json({ error: "disabled" }, { status: 403 });
  if (!isServiceRoleConfigured()) return Response.json({ error: "unavailable" }, { status: 503 });

  const last = body.messages[body.messages.length - 1];
  if (last.role !== "user" || !last.content.trim() || last.content.length > LIMITS.maxUserChars) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  // ── limits per IP / chat ──
  const db = createServiceClient();
  const ip = req.headers.get("x-nf-client-connection-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const hash = ipHash(ip);
  if (hash) {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { data: recent } = await db.from("assistant_chats").select("turns, updated_at").eq("ip_hash", hash).gte("updated_at", since);
    const turns = (recent ?? []).reduce((s, r) => s + Number(r.turns ?? 0), 0);
    if (turns >= LIMITS.turnsPerHour) return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  let chatId = body.chatId ?? null;
  let prevTurns = 0;
  if (chatId) {
    const { data } = await db.from("assistant_chats").select("turns").eq("id", chatId).maybeSingle();
    if (!data) chatId = null;
    else prevTurns = Number(data.turns ?? 0);
    if (prevTurns >= LIMITS.turnsPerChat) return Response.json({ error: "chat_limit" }, { status: 429 });
  }

  const ctx: ToolContext = {
    locale,
    market,
    price: { market, b2b: Boolean(v?.b2b), discountPercent: v?.discount ?? 0 },
    user: v ? { id: v.id, email: v.email, name: v.name } : null,
    cart: body.cart,
  };
  const system = await buildSystemPrompt({ locale, market, b2b: Boolean(v?.b2b), discount: v?.discount ?? 0, userName: v?.name ?? null, signedIn: Boolean(v) });

  // Only the last 20 messages travel to the model; the conversation must start with the user.
  let history: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of body.messages.slice(-20)) {
    const content = m.content.trim();
    if (!content) continue;
    const prev = history[history.length - 1];
    if (prev && prev.role === m.role) prev.content += `\n\n${content}`; // the API needs alternating roles
    else history.push({ role: m.role, content });
  }
  while (history.length && history[0].role !== "user") history = history.slice(1);
  if (!history.length || history[history.length - 1].role !== "user") return Response.json({ error: "bad_request" }, { status: 400 });
  const messages: ApiMessage[] = history.map((m) => ({ role: m.role, content: m.content }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
      const { answer, usage, toolsUsed } = await runChat({ model: settings.model, system, messages, ctx, locale, signal: req.signal, send });

      // ── log the conversation (text only) ──
      try {
        const log = [...history.map((m) => ({ role: m.role, content: m.content })), { role: "assistant", content: answer }];
        const row = {
          user_id: v?.id ?? null,
          ip_hash: hash,
          locale,
          market,
          messages: log,
          turns: prevTurns + 1,
          updated_at: new Date().toISOString(),
        };
        if (chatId) {
          const { data: cur } = await db.from("assistant_chats").select("tools_used, input_tokens, output_tokens, cache_read_tokens").eq("id", chatId).maybeSingle();
          await db
            .from("assistant_chats")
            .update({
              ...row,
              tools_used: [...new Set([...((cur?.tools_used as string[]) ?? []), ...toolsUsed])],
              input_tokens: Number(cur?.input_tokens ?? 0) + usage.input,
              output_tokens: Number(cur?.output_tokens ?? 0) + usage.output,
              cache_read_tokens: Number(cur?.cache_read_tokens ?? 0) + usage.cacheRead,
            })
            .eq("id", chatId);
        } else {
          const { data } = await db
            .from("assistant_chats")
            .insert({ ...row, tools_used: [...toolsUsed], input_tokens: usage.input, output_tokens: usage.output, cache_read_tokens: usage.cacheRead })
            .select("id")
            .single();
          chatId = (data?.id as string) ?? null;
        }
      } catch (e) {
        console.error("[assistant] log", e);
      }
      send({ t: "done", chatId });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
