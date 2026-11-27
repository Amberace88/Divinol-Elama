import "server-only";
import type { Locale } from "@/i18n/routing";
import type { ApiMessage } from "./anthropic";
import { LIMITS } from "./config";
import { runTool, TOOL_STATUS, type ToolContext } from "./tools";
import { workersText } from "./workers-ai";

/**
 * Free Workers AI models do not call tools reliably, so the server does the lookups itself:
 * 1) the model only plans what to look up (small JSON), 2) the server searches the catalogue / order,
 * 3) the model writes the reply using ONLY those results. Product facts can't be invented this way.
 */

type Plan = { searches?: string[]; order_number?: string | null; order_email?: string | null; need_vehicle_info?: boolean; shipping?: boolean };

const PLANNER = `You plan catalogue lookups for an oil shop assistant (Divinol lubricants). Read the conversation and output ONLY a JSON object, no other text:
{"searches": [..], "order_number": null, "order_email": null, "need_vehicle_info": false, "shipping": false}
- "searches": 0–4 short catalogue search strings that would find the right products: manufacturer approvals (e.g. "VW 507.00", "MB 229.52", "BMW LL-04", "dexos2", "Ford WSS-M2C 948-B"), viscosities ("5W-30", "10W-40", "75W-90"), product types ("ATF", "grease", "antifreeze G12", "hydraulic HLP 46", "2T") or product names/SKUs the customer mentioned. Use your knowledge of which approval/viscosity a vehicle needs (e.g. VW Golf 7 1.6 TDI 2016 → "VW 507.00", "5W-30 C3"). Empty list for greetings or questions not about products.
- "need_vehicle_info": true only if the customer wants an oil for a vehicle but did not give enough to know the engine (make+model+engine or year+fuel).
- "shipping": true if the customer asks about delivery, parcel lockers, courier, pickup or delivery prices/times.
- order_number / order_email: fill only if the customer asks about an order and gave them.`;

function parsePlan(text: string): Plan {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try {
    return JSON.parse(m[0]) as Plan;
  } catch {
    return {};
  }
}

function flat(messages: ApiMessage[]) {
  return messages
    .filter((m) => typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content as string }));
}

export async function runWorkersChat(opts: {
  model: string;
  system: { type: "text"; text: string }[];
  messages: ApiMessage[];
  ctx: ToolContext;
  locale: Locale;
  send: (event: Record<string, unknown>) => void;
}) {
  const { send, ctx } = opts;
  const usage = { input: 0, output: 0, cacheRead: 0 };
  const toolsUsed = new Set<string>();
  let answer = "";
  try {
    const convo = flat(opts.messages).slice(-10);
    const plan = await workersText(opts.model, [{ role: "system", content: PLANNER }, ...convo], 200);
    usage.input += plan.input;
    usage.output += plan.output;
    const p = parsePlan(plan.text);

    const facts: string[] = [];
    const searches = (p.searches ?? []).filter((s) => typeof s === "string" && s.trim()).slice(0, 4);
    if (searches.length) {
      send({ t: "status", d: TOOL_STATUS.search_products?.[opts.locale] ?? "…" });
      toolsUsed.add("search_products");
      const seen = new Set<string>();
      const products: unknown[] = [];
      const cards: unknown[] = [];
      for (const q of searches) {
        const out = await runTool("search_products", { query: q, limit: 4 }, ctx);
        const r = out.result as { products?: { slug: string }[]; note?: string };
        for (const prod of r.products ?? []) {
          if (seen.has(prod.slug)) continue;
          seen.add(prod.slug);
          products.push({ ...prod, matched_search: q });
        }
        for (const c of out.cards ?? []) if (!cards.some((x) => (x as { slug: string }).slug === (c as { slug: string }).slug)) cards.push(c);
        if (r.note && !facts.includes(r.note)) facts.push(r.note);
      }
      if (cards.length) send({ t: "cards", items: cards.slice(0, 4) });
      facts.push(
        products.length
          ? `CATALOGUE RESULTS for ${JSON.stringify(searches)} — the ONLY products, links, packs and prices you may mention:\n${JSON.stringify(products.slice(0, 8))}`
          : `CATALOGUE RESULTS for ${JSON.stringify(searches)}: nothing found. Do not name any product; say we could not find a match and offer to ask a colleague.`,
      );
    }
    if (p.shipping) {
      toolsUsed.add("shipping_options");
      send({ t: "status", d: TOOL_STATUS.shipping_options?.[opts.locale] ?? "…" });
      const out = await runTool("shipping_options", { market: ctx.market }, ctx);
      facts.push(`DELIVERY OPTIONS for ${ctx.market} (customer's current cart; prices incl. VAT unless B2B):\n${JSON.stringify(out.result)}`);
    }
    if (p.order_number || p.order_email) {
      toolsUsed.add("order_status");
      const out = await runTool("order_status", { order_number: p.order_number ?? "", email: p.order_email ?? "" }, ctx);
      facts.push(`ORDER LOOKUP RESULT:\n${JSON.stringify(out.result)}`);
    }
    if (!searches.length) facts.push("No catalogue lookup was made for this message — do NOT name any specific product, link or price. If the customer needs a product, ask the one question you need (vehicle make, model, engine/year) or what they need it for.");
    if (p.need_vehicle_info) facts.push("The vehicle/engine is not clear yet: ask ONE short question for the missing detail before recommending.");

    const system = `${opts.system.map((s) => s.text).join("\n\n")}

## Facts for this reply (looked up just now by the shop system)
${facts.join("\n\n")}

Answer the customer's last message now, following "How you talk": no greeting, no self-introduction, no mention of bots/AI, no filler closer, 1–4 short sentences. Use product names, links (exactly the "url"), packs, prices and availability ONLY from the facts above. Never mention tools, searches or "the system". You cannot put items in the cart yourself in this chat — if they want to buy, point them to the product link/card ("atveriet produktu un spiediet „Ielikt grozā”").`;
    const res = await workersText(opts.model, [{ role: "system", content: system }, ...convo], LIMITS.maxTokens);
    usage.input += res.input;
    usage.output += res.output;
    answer = res.text || "…";
    send({ t: "text", d: answer });
  } catch (e) {
    console.error("[assistant/workers]", e);
    send({ t: "error", d: "failed" });
  }
  return { answer, usage, toolsUsed };
}
