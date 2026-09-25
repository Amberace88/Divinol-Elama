"use client";

import { Mail, Send } from "lucide-react";
import { sendTestEmail } from "@/lib/admin/actions/email";
import { cn } from "@/lib/utils";
import { Spinner, useActionRunner } from "../client-ui";
import { btn } from "../styles";

export type EmailStatus = {
  apiKey: boolean;
  fromConfigured: boolean;
  from: string;
  replyTo: string;
  replyToConfigured: boolean;
  notify: string;
  notifyConfigured: boolean;
  adminEmail: string | null;
};

function State({ ok, okLabel = "Iestatīts", offLabel = "Nav iestatīts" }: { ok: boolean; okLabel?: string; offLabel?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-semibold ring-1",
        ok ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-orange-50 text-orange-700 ring-orange-200",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-orange-500")} />
      {ok ? okLabel : offLabel}
    </span>
  );
}

/** Iestatījumi → E-pasti: Resend configuration status (values never shown) + "send test e-mail". */
export function EmailSettingsCard({ status }: { status: EmailStatus }) {
  const { run, pending } = useActionRunner();
  const rows: [string, React.ReactNode][] = [
    ["RESEND_API_KEY", <State key="k" ok={status.apiKey} />],
    ["EMAIL_FROM", <State key="f" ok={status.fromConfigured} offLabel="Noklusējums" />],
    ["Sūtītājs", <code key="fa" className="text-[13px] break-all text-ink">{status.from}</code>],
    ["Atbildes adrese", <span key="r" className="text-[13px] break-all text-ink">{status.replyTo}{!status.replyToConfigured && <span className="text-muted"> (no iestatījumiem)</span>}</span>],
    ["Paziņojumi veikalam", <span key="n" className="text-[13px] break-all text-ink">{status.notify}{!status.notifyConfigured && <span className="text-muted"> (no iestatījumiem)</span>}</span>],
  ];

  return (
    <section id="email" className="scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <header className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 -skew-x-6 place-items-center rounded-lg bg-navy-50 text-navy-600">
          <Mail className="h-4 w-4 skew-x-6" />
        </span>
        <div>
          <h2 className="text-[15px] font-bold text-ink">E-pasti</h2>
          <p className="text-[13px] text-muted">
            Pasūtījumu, piegādes, rēķinu un B2B paziņojumi klientiem un veikalam (Resend). Vides mainīgos maina Netlify iestatījumos.
          </p>
        </div>
      </header>
      <dl className="grid gap-x-6 gap-y-2.5 p-5 sm:grid-cols-[180px_minmax(0,1fr)]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[13px] font-semibold text-muted">{k}</dt>
            <dd className="min-w-0">{v}</dd>
          </div>
        ))}
      </dl>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-slate-50/60 px-5 py-3">
        <span className="text-[12px] text-muted">
          {status.apiKey
            ? `Parauga pasūtījuma apstiprinājums tiks nosūtīts uz ${status.adminEmail ?? "jūsu e-pastu"}.`
            : "Kamēr RESEND_API_KEY nav iestatīts, e-pasti netiek sūtīti (pasūtījumi strādā kā parasti)."}
        </span>
        <button
          type="button"
          className={btn("dark")}
          disabled={pending || !status.apiKey}
          onClick={() => run(() => sendTestEmail(), { loading: "Sūta testa e-pastu…" })}
        >
          {pending ? <Spinner /> : <Send className="h-4 w-4" />} Nosūtīt testa e-pastu
        </button>
      </footer>
    </section>
  );
}
