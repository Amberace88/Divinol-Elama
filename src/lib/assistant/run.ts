import "server-only";
import type { Locale } from "@/i18n/routing";
import { streamTurn, type ApiMessage, type ContentBlock, type ToolResultBlock } from "./anthropic";
import { LIMITS } from "./config";
import { isWorkersModel, workersTurn } from "./workers-ai";
import { runTool, TOOL_DEFS, TOOL_STATUS, type ToolContext } from "./tools";

type SystemBlocks = Parameters<typeof streamTurn>[0]["system"];

/**
 * The agent loop: model turn → run the requested tools → feed results back, until the model answers.
 * Everything the browser needs is pushed through `send` as it happens (text deltas, status, product cards, cart actions).
 */
export async function runChat(opts: {
  model: string;
  system: SystemBlocks;
  messages: ApiMessage[];
  ctx: ToolContext;
  locale: Locale;
  signal?: AbortSignal;
  send: (event: Record<string, unknown>) => void;
}) {
  const { messages, send } = opts;
  const usage = { input: 0, output: 0, cacheRead: 0 };
  const toolsUsed = new Set<string>();
  let answer = "";
  const workers = isWorkersModel(opts.model);
  let nudged = false;
  try {
    for (let round = 0; ; round++) {
      // last allowed round: the model must answer with what it has
      const final = round >= LIMITS.maxToolRounds;
      const turn = await (isWorkersModel(opts.model) ? workersTurn : streamTurn)({
        model: opts.model,
        system: opts.system,
        messages,
        tools: TOOL_DEFS,
        toolChoice: final ? { type: "none" } : undefined,
        maxTokens: LIMITS.maxTokens,
        signal: opts.signal,
        onText: (d) => {
          if (workers) return; // emitted below after the check
          answer += d;
          send({ t: "text", d });
        },
      });
      if (workers) {
        const text = turn.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
        const hasCalls = turn.content.some((b) => b.type === "tool_use");
        // smaller models sometimes "answer from memory": a price, a product link or a product name without having looked anything up
        if (!final && !nudged && !hasCalls && toolsUsed.size === 0 && /€|\/produkt|\]\(\/|Divinol\s+[A-Z]/.test(text)) {
          nudged = true;
          messages.push({ role: "assistant", content: text || "…" });
          messages.push({ role: "user", content: "[system] You named a product, link or price without checking the catalogue. Call recommend_oil or search_products (or get_product) now and answer only with what the tools return." });
          continue;
        }
        if (text) {
          answer += text;
          send({ t: "text", d: text });
        }
      }
      usage.input += turn.usage.input;
      usage.output += turn.usage.output;
      usage.cacheRead += turn.usage.cacheRead;
      messages.push({ role: "assistant", content: turn.content as ContentBlock[] });
      const calls = turn.content.filter((b) => b.type === "tool_use");
      if (final || turn.stopReason !== "tool_use" || !calls.length) break;
      if (answer && !answer.endsWith("\n")) {
        answer += "\n\n";
        send({ t: "text", d: "\n\n" });
      }
      const results: ToolResultBlock[] = [];
      for (const call of calls) {
        if (call.type !== "tool_use") continue;
        toolsUsed.add(call.name);
        send({ t: "status", d: TOOL_STATUS[call.name]?.[opts.locale] ?? "…" });
        try {
          const out = await runTool(call.name, call.input, opts.ctx);
          if (out.cards?.length) send({ t: "cards", items: out.cards });
          for (const a of out.actions ?? []) send({ t: "action", action: a });
          results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(out.result).slice(0, 24000), ...(out.isError ? { is_error: true } : {}) });
        } catch (e) {
          console.error("[assistant] tool", call.name, e);
          results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify({ error: "Tool failed." }), is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    if (!opts.signal?.aborted) {
      console.error("[assistant]", e);
      send({ t: "error", d: "failed" });
    }
  }
  return { answer, usage, toolsUsed };
}
