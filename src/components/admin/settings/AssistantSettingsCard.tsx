"use client";

import { useState } from "react";
import { Bot, ChevronDown, ExternalLink } from "lucide-react";
import { saveAssistantSettings } from "@/lib/admin/actions/assistant";
import { cn } from "@/lib/utils";
import { Switch, useActionRunner } from "../client-ui";
import { btn } from "../styles";

export type AssistantChatRow = {
  id: string;
  created_at: string;
  updated_at: string;
  locale: string | null;
  market: string | null;
  turns: number;
  tools_used: string[];
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  signed_in: boolean;
  messages: { role: string; content: string }[];
};

export type AssistantStatus = {
  keyConfigured: boolean;
  settings: { public: boolean; model: string };
  models: { id: string; label: string }[];
  stats: { chats7d: number; turns7d: number; tokens7d: number };
  chats: AssistantChatRow[];
};

const TOOL_LV: Record<string, string> = {
  search_products: "meklēšana",
  get_product: "produkts",
  recommend_oil: "eļļas izvēle",
  pack_calculator: "iepakojumi",
  view_cart: "grozs",
  shipping_options: "piegāde",
  add_to_cart: "ielika grozā",
  order_status: "pasūtījums",
  contact_shop: "ziņa veikalam",
};

const fmt = (iso: string) => new Date(iso).toLocaleString("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Iestatījumi → AI palīgs (developer only): status, visibility switch, model and the latest conversations. */
export function AssistantSettingsCard({ status }: { status: AssistantStatus }) {
  const { run, pending } = useActionRunner();
  const [pub, setPub] = useState(status.settings.public);
  const [model, setModel] = useState(status.settings.model);
  const [openId, setOpenId] = useState<string | null>(null);
  const ready = status.keyConfigured;
  const dirty = pub !== status.settings.public || model !== status.settings.model;

  return (
    <section id="assistant" className="scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <header className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-100 text-navy-700">
          <Bot className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold text-ink">AI palīgs veikalā</h2>
          <p className="text-[13px] text-muted">
            Čata palīgs veikala lapā: eļļas izvēle pēc auto, produkti, cenas, piegāde, ielikšana grozā, pasūtījuma statuss un ziņa veikalam. Atbildes tikai no veikala datiem.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-semibold ring-1",
            ready ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-orange-50 text-orange-700 ring-orange-200",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", ready ? "bg-emerald-500" : "bg-orange-500")} />
          {ready ? "Pieslēgts" : "Nav pieslēgts"}
        </span>
      </header>

      <div className="space-y-4 px-5 py-4 text-[13px]">
        {!status.keyConfigured && (
          <p className="rounded-xl bg-orange-50 p-3 text-orange-800">
            Izvēlētais modelis šeit nav pieejams. Bezmaksas Cloudflare modeļi strādā tikai, kad lapa darbojas uz Cloudflare (Worker ar <code className="font-bold">AI</code> sasaisti); Claude modeļiem vajag <code className="font-bold">ANTHROPIC_API_KEY</code>.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-ink">Redzams visiem apmeklētājiem</p>
            <p className="text-muted">{pub ? "Palīga poga redzama visiem veikalā." : "Tagad redz tikai izstrādātāja konts (priekšskatījums)."}</p>
          </div>
          <Switch checked={pub} onChange={setPub} label="Redzams visiem" disabled={pending} />
        </div>
        <label className="block">
          <span className="mb-1 block font-semibold text-ink">Modelis</span>
          <select value={model} onChange={(e) => setModel(e.target.value)} className="h-9 w-full rounded-lg border border-line bg-white px-2.5 text-[13px] sm:w-auto">
            {status.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn("dark")} disabled={!dirty || pending} onClick={() => run(() => saveAssistantSettings({ public: pub, model }))}>
            Saglabāt
          </button>
          <a href="/" target="_blank" rel="noreferrer" className={btn("outline")}>
            <ExternalLink className="h-4 w-4" /> Izmēģināt veikalā
          </a>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            ["Sarunas (7 d.)", status.stats.chats7d],
            ["Jautājumi (7 d.)", status.stats.turns7d],
            ["Tokeni (7 d.)", status.stats.tokens7d.toLocaleString("lv-LV")],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[11.5px] text-muted">{k}</p>
              <p className="text-[17px] font-extrabold text-ink">{v}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-2 font-semibold text-ink">Pēdējās sarunas</p>
          {status.chats.length === 0 ? (
            <p className="text-muted">Vēl nav sarunu.</p>
          ) : (
            <ul className="divide-y divide-line/70 rounded-xl border border-line">
              {status.chats.map((c) => {
                const first = c.messages.find((m) => m.role === "user")?.content ?? "—";
                const isOpen = openId === c.id;
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => setOpenId(isOpen ? null : c.id)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-navy-50/40">
                      <span className="w-24 shrink-0 text-[12px] text-muted">{fmt(c.updated_at)}</span>
                      <span className="min-w-0 flex-1 truncate text-ink">{first}</span>
                      <span className="hidden shrink-0 text-[11.5px] text-muted sm:inline">
                        {(c.locale ?? "").toUpperCase()} · {c.turns} jaut.{c.signed_in ? " · klients" : ""}
                      </span>
                      <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && (
                      <div className="space-y-2 bg-slate-50/70 px-3.5 py-3">
                        {c.tools_used.length > 0 && (
                          <p className="text-[11.5px] text-muted">Rīki: {c.tools_used.map((t) => TOOL_LV[t] ?? t).join(", ")}</p>
                        )}
                        {c.messages.map((m, i) => (
                          <div key={i} className={cn("rounded-lg px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap", m.role === "user" ? "bg-navy-700 text-white" : "bg-white text-ink ring-1 ring-line")}>
                            {m.content || "—"}
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
