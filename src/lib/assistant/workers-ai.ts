import "server-only";
import type { ApiMessage, TextBlock, ToolDef, ToolUseBlock, TurnResult } from "./anthropic";

/**
 * Cloudflare Workers AI (free daily allowance) through the Worker's `AI` binding.
 * Same contract as `streamTurn` in ./anthropic so the agent loop does not care which provider answers:
 * Anthropic-style messages/tools in → text + tool_use blocks out. The whole reply is passed to `onText` at once.
 */

type AiBinding = { run: (model: string, input: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<unknown> };

async function binding(): Promise<AiBinding | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return ((env as unknown as { AI?: AiBinding }).AI ?? null) as AiBinding | null;
  } catch {
    return null;
  }
}

export function isWorkersModel(model: string) {
  return model.startsWith("@cf/");
}

export async function workersAiAvailable() {
  return (await binding()) != null;
}

type OaMsg =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; name?: string; content: string };

function toOpenAi(system: { text: string }[], messages: ApiMessage[]): OaMsg[] {
  const out: OaMsg[] = [{ role: "system", content: system.map((s) => s.text).join("\n\n") }];
  const names = new Map<string, string>();
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (m.role === "assistant") {
      const text = m.content.filter((b): b is TextBlock => b.type === "text").map((b) => b.text).join("");
      const calls = m.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
      calls.forEach((c) => names.set(c.id, c.name));
      out.push({
        role: "assistant",
        content: text,
        ...(calls.length ? { tool_calls: calls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) } })) } : {}),
      });
    } else {
      for (const b of m.content) {
        if (b.type === "tool_result") out.push({ role: "tool", tool_call_id: b.tool_use_id, name: names.get(b.tool_use_id), content: b.content });
        else if (b.type === "text") out.push({ role: "user", content: b.text });
      }
    }
  }
  return out;
}

function parseArgs(a: unknown): Record<string, unknown> {
  if (a && typeof a === "object") return a as Record<string, unknown>;
  if (typeof a === "string") {
    try {
      const v = JSON.parse(a);
      return v && typeof v === "object" ? v : {};
    } catch {
      return {};
    }
  }
  return {};
}

type RawCall = { id?: string; name?: string; arguments?: unknown; function?: { name?: string; arguments?: unknown } };

export async function workersTurn(opts: {
  model: string;
  system: { type: "text"; text: string }[];
  messages: ApiMessage[];
  tools: ToolDef[];
  toolChoice?: { type: "auto" | "any" | "none" };
  maxTokens: number;
  onText: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<TurnResult> {
  const ai = await binding();
  if (!ai) throw new Error("Workers AI binding missing");
  const noTools = opts.toolChoice?.type === "none";
  const raw = (await ai.run(opts.model, {
    messages: toOpenAi(opts.system, opts.messages),
    ...(noTools ? {} : { tools: opts.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.input_schema })) }),
    max_tokens: opts.maxTokens,
    temperature: 0.3,
  })) as Record<string, unknown>;

  // two response shapes exist: legacy {response, tool_calls} and OpenAI-style {choices:[{message}]}
  const choice = (raw.choices as { message?: { content?: string | null; tool_calls?: RawCall[] }; finish_reason?: string }[] | undefined)?.[0];
  let text = String(choice?.message?.content ?? (typeof raw.response === "string" ? raw.response : "") ?? "");
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim(); // reasoning models
  const rawCalls: RawCall[] = [... (choice?.message?.tool_calls ?? (raw.tool_calls as RawCall[] | undefined) ?? [])] as RawCall[];
  if (!noTools && !rawCalls.length) {
    const known = new Set(opts.tools.map((t) => t.name));
    const json = text.match(/\{\s*"(?:name|type)"[\s\S]*\}/);
    if (json) {
      try {
        const o = JSON.parse(json[0]) as { name?: string; parameters?: unknown; arguments?: unknown };
        if (o.name && known.has(o.name)) {
          rawCalls.push({ name: o.name, arguments: o.parameters ?? o.arguments ?? {} });
          text = text.replace(json[0], "").trim();
        }
      } catch {
        /* not a call */
      }
    }
    for (const m of text.matchAll(/\[?`?([a-z_]+)\(([^)]*)\)`?\]?/g)) {
      if (!known.has(m[1])) continue;
      const args: Record<string, unknown> = {};
      for (const kv of m[2].matchAll(/(\w+)\s*=\s*("([^"]*)"|[^,\s]+)/g)) args[kv[1]] = kv[3] ?? (kv[2] === "true" ? true : kv[2] === "false" ? false : isNaN(Number(kv[2])) ? kv[2] : Number(kv[2]));
      rawCalls.push({ name: m[1], arguments: args });
    }
    // when the model wrote calls as text, drop that text (it is not meant for the customer)
    if (rawCalls.length) text = "";
  }
  const calls: ToolUseBlock[] = noTools
    ? []
    : rawCalls
        .map((c, i) => ({ type: "tool_use" as const, id: c.id || `call_${Date.now().toString(36)}_${i}`, name: c.function?.name ?? c.name ?? "", input: parseArgs(c.function?.arguments ?? c.arguments) }))
        .filter((c) => opts.tools.some((t) => t.name === c.name));

  const content: (TextBlock | ToolUseBlock)[] = [];
  if (text) {
    content.push({ type: "text", text });
    opts.onText(text);
  }
  content.push(...calls);
  const u = (raw.usage ?? {}) as { prompt_tokens?: number; completion_tokens?: number };
  return { content, stopReason: calls.length ? "tool_use" : "end_turn", usage: { input: Number(u.prompt_tokens ?? 0), output: Number(u.completion_tokens ?? 0), cacheRead: 0 } };
}
