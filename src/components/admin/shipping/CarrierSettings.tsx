"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleSlash, ExternalLink, KeyRound } from "lucide-react";
import { updateCarrier } from "@/lib/admin/actions/shipping";
import type { Carrier, CarrierCapabilities } from "@/lib/shipping/types";
import { cn } from "@/lib/utils";
import { Spinner, Switch, useActionRunner } from "../client-ui";
import { btn, inputCls } from "../styles";
import { CarrierLogo } from "@/components/shipping/CarrierLogo";

/** Carrier settings: on/off, offered in checkout, tracking link template, API credential status (names only, never values). */
export function CarrierSettings({ carriers, caps, developer = false }: { carriers: Carrier[]; caps: Record<string, CarrierCapabilities>; developer?: boolean }) {
  return (
    <div className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-3">
      {carriers.map((c) => (
        <CarrierCard key={c.code + c.tracking_url_template} c={c} cap={caps[c.code]} developer={developer} />
      ))}
    </div>
  );
}

function CarrierCard({ c, cap, developer }: { c: Carrier; cap?: CarrierCapabilities; developer: boolean }) {
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const [tpl, setTpl] = useState(c.tracking_url_template ?? "");
  const save = (patch: Parameters<typeof updateCarrier>[1]) => run(() => updateCarrier(c.code, patch), { onSuccess: () => router.refresh() });
  const hasApiDef = (cap?.envVars.length ?? 0) > 0;

  return (
    <section className={cn("flex flex-col rounded-2xl border bg-white p-4 shadow-card", c.enabled ? "border-line" : "border-line opacity-70")}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <CarrierLogo code={c.code} name={c.name} size="md" />
          <div>
          <h3 className="text-[15px] font-bold text-ink">{c.name}</h3>
          <p className="mt-0.5 text-[12px]">
            {cap?.api ? (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> API pieslēgts — automātiski sūtījumi un uzlīmes
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-muted">
                <CircleSlash className="h-3.5 w-3.5" /> Manuālais režīms
              </span>
            )}
          </p>
          </div>
        </div>
        <Switch checked={c.enabled} label={c.enabled ? "Atslēgt pārvadātāju" : "Ieslēgt pārvadātāju"} disabled={pending} onChange={(v) => save({ enabled: v })} />
      </header>

      {developer && hasApiDef && (
        <div className="mb-3 rounded-xl bg-slate-50 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
            <KeyRound className="h-3.5 w-3.5" /> Netlify vides mainīgie
          </p>
          <ul className="space-y-1">
            {cap!.envVars.map((v) => {
              const set = cap!.envSet.includes(v);
              return (
                <li key={v} className="flex items-center justify-between gap-2 text-[12px]">
                  <code className="font-mono text-ink/80">{v}</code>
                  <span className={cn("font-bold", set ? "text-emerald-700" : "text-orange-700")}>{set ? "✓ iestatīts" : "nav iestatīts"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ul className="mb-3 space-y-1 text-[12.5px] text-ink/80">
        <li>Pakomātu saraksts: {cap?.pickupPoints ? "pieejams" : "nav pieejams"}</li>
        <li>Automātiska izsekošana: {cap?.tracking ? "jā" : "nē (statusu maina manuāli)"}</li>
        {cap?.note && <li className="text-muted">{cap.note}</li>}
      </ul>

      <label className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-[13px]">
        <span>
          <span className="font-semibold text-ink">Piedāvāt klientiem pie pakomātiem</span>
          <span className="block text-[11.5px] text-muted">Cena klientam — no veikala iestatījumiem („Pakomāts”)</span>
        </span>
        <Switch
          size="sm"
          checked={c.checkout_enabled}
          disabled={pending || !cap?.pickupPoints || !c.enabled}
          label="Piedāvāt klientiem"
          onChange={(v) => save({ checkout_enabled: v })}
        />
      </label>

      {!developer && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12.5px]">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-semibold ring-1", cap?.api ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", cap?.api ? "bg-emerald-500" : "bg-slate-400")} />
            {cap?.api ? "Pieslēgts" : "Nav pieslēgts"}
          </span>
          <span className="text-muted">{cap?.api ? "Uzlīmes un kodi tiek veidoti automātiski" : "Sūtījumus noformē pārvadātāja portālā"}</span>
        </p>
      )}

      {developer && (
      <form
        className="mt-auto flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save({ tracking_url_template: tpl });
        }}
      >
        <label className="flex-1">
          <span className="mb-1 block text-[11.5px] font-bold text-muted">Izsekošanas saite ({"{code}"} = sūtījuma kods)</span>
          <input className={cn(inputCls, "h-9 text-[12px]")} value={tpl} onChange={(e) => setTpl(e.target.value)} placeholder="https://…{code}" />
        </label>
        <button type="submit" className={btn("outline", "sm", "mb-0.5")} disabled={pending || tpl === (c.tracking_url_template ?? "")}>
          {pending ? <Spinner /> : null} Saglabāt
        </button>
      </form>
      )}

      {developer && cap?.docs.length ? (
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]">
          {cap.docs.map((d) => (
            <a key={d} href={d} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-navy-600 hover:underline">
              {new URL(d).hostname.replace(/^www\./, "")} <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </p>
      ) : null}
    </section>
  );
}
