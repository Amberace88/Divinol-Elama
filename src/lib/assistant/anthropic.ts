import "server-only";

/**
 * Minimal streaming client for the Anthropic Messages API (no SDK dependency).
 * One call = one model turn; text deltas are passed to `onText` as they arrive, tool_use blocks are
 * collected and returned so the caller can run the tools and continue the loop.
 */

export type TextBlock = { type: "text"; text: string };
export type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
export type ToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;
export type ApiMessage = { role: "user" | "assistant"; content: string | ContentBlock[] };

export type ToolDef = { name: string; description: string; input_schema: Record<string, unknown> };

export type TurnResult = {
  content: (TextBlock | ToolUseBlock)[];
  stopReason: string | null;
  usage: { input: number; output: number; cacheRead: number };
};

const API_URL = `${(process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`;

export function anthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export async function streamTurn(opts: {
  model: string;
  system: { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[];
  messages: ApiMessage[];
  tools: ToolDef[];
  toolChoice?: { type: "auto" | "any" | "none" };
  maxTokens: number;
  onText: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<TurnResult> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");
  // the last tool definition carries the cache breakpoint → system prompt + tools are cached between turns
  const tools = opts.tools.map((t, i) => (i === opts.tools.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t));
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: opts.messages,
      tools,
      ...(opts.toolChoice ? { tool_choice: opts.toolChoice } : {}),
      stream: true,
    }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`anthropic ${res.status}: ${body.slice(0, 300)}`);
  }

  const blocks: ((TextBlock | ToolUseBlock) & { _json?: string })[] = [];
  let stopReason: string | null = null;
  const usage = { input: 0, output: 0, cacheRead: 0 };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, nl);
      buf = buf.slice(nl + 2);
      const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(dataLine.slice(5).trim());
      } catch {
        continue;
      }
      switch (ev.type) {
        case "message_start": {
          const u = (ev.message as { usage?: Record<string, number> })?.usage ?? {};
          usage.input += Number(u.input_tokens ?? 0);
          usage.cacheRead += Number(u.cache_read_input_tokens ?? 0);
          break;
        }
        case "content_block_start": {
          const b = ev.content_block as { type: string; id?: string; name?: string; text?: string };
          const idx = Number(ev.index);
          if (b.type === "tool_use") blocks[idx] = { type: "tool_use", id: b.id!, name: b.name!, input: {}, _json: "" };
          else blocks[idx] = { type: "text", text: b.text ?? "" };
          break;
        }
        case "content_block_delta": {
          const d = ev.delta as { type: string; text?: string; partial_json?: string };
          const b = blocks[Number(ev.index)];
          if (!b) break;
          if (d.type === "text_delta" && b.type === "text" && d.text) {
            b.text += d.text;
            opts.onText(d.text);
          } else if (d.type === "input_json_delta" && b.type === "tool_use") {
            b._json = (b._json ?? "") + (d.partial_json ?? "");
          }
          break;
        }
        case "content_block_stop": {
          const b = blocks[Number(ev.index)];
          if (b?.type === "tool_use") {
            try {
              b.input = b._json ? JSON.parse(b._json) : {};
            } catch {
              b.input = {};
            }
          }
          break;
        }
        case "message_delta": {
          const d = ev.delta as { stop_reason?: string };
          if (d?.stop_reason) stopReason = d.stop_reason;
          const u = ev.usage as { output_tokens?: number } | undefined;
          if (u?.output_tokens) usage.output += u.output_tokens;
          break;
        }
        case "error": {
          const e = ev.error as { message?: string } | undefined;
          throw new Error(`anthropic stream: ${e?.message ?? "error"}`);
        }
      }
    }
  }
  const content = blocks
    .filter(Boolean)
    .map((b) => {
      const { _json, ...rest } = b as ToolUseBlock & { _json?: string };
      void _json;
      return rest as TextBlock | ToolUseBlock;
    })
    .filter((b) => b.type !== "text" || (b as TextBlock).text.length > 0);
  return { content, stopReason, usage };
}
