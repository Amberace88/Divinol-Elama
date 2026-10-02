import { CreditCard, ExternalLink } from "lucide-react";
import type { StripeAdminStatus } from "@/lib/payments/stripe";
import { cn } from "@/lib/utils";

export type StripeCardStatus = StripeAdminStatus & { webhookUrl: string };

const EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
];

function State({ ok, okLabel = "Iestatīts", offLabel = "Nav iestatīts", warn }: { ok: boolean; okLabel?: string; offLabel?: string; warn?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-semibold ring-1",
        ok ? (warn ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200") : "bg-orange-50 text-orange-700 ring-orange-200",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", ok ? (warn ? "bg-amber-500" : "bg-emerald-500") : "bg-orange-500")} />
      {ok ? okLabel : offLabel}
    </span>
  );
}

/** Iestatījumi → Tiešsaistes maksājumi (Stripe): configuration + the connected Stripe account. Never shows key values. */
export function StripeSettingsCard({ status, developer = false }: { status: StripeCardStatus; developer?: boolean }) {
  const live = status.mode === "live";
  const ready = status.configured && !status.error && status.webhookSecret;
  const dash = live ? "https://dashboard.stripe.com" : "https://dashboard.stripe.com/test";
  const rows: [string, React.ReactNode][] = [
    [
      "Statuss",
      <State
        key="s"
        ok={status.configured && !status.error}
        warn={status.configured && !status.webhookSecret}
        okLabel={status.webhookSecret ? "Pieslēgts — klienti var maksāt ar karti, Apple Pay un Google Pay" : "Pieslēgts, bet trūkst webhook — apmaksa tiek apstiprināta tikai, kad klients atgriežas veikalā"}
        offLabel="Nav pieslēgts — kasē tikai pārskaitījums / rēķins"
      />,
    ],
  ];
  if (status.secretKey) {
    rows.push(["Režīms", <State key="m" ok warn={!live} okLabel={live ? "Īsti maksājumi (live)" : "Testa režīms — nauda netiek iekasēta"} />]);
  }
  if (status.account) {
    rows.push([
      "Stripe konts",
      <span key="a" className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink">
        <span className="font-semibold">{status.account.name ?? status.account.id}</span>
        {status.account.country && <span className="text-muted">· {status.account.country}</span>}
        <State ok={status.account.chargesEnabled} okLabel="Maksājumi atļauti" offLabel="Maksājumi vēl nav atļauti" />
        <State ok={status.account.payoutsEnabled} okLabel="Izmaksas uz banku" offLabel="Izmaksas nav aktivizētas" warn={!status.account.payoutsEnabled} />
      </span>,
    ]);
  }
  if (developer) {
    rows.push(
      ["STRIPE_SECRET_KEY", <State key="k" ok={status.secretKey} okLabel={status.mode === "live" ? "Iestatīts (live)" : "Iestatīts (test)"} />],
      ["STRIPE_WEBHOOK_SECRET", <State key="w" ok={status.webhookSecret} />],
      ["SUPABASE_SERVICE_ROLE_KEY", <State key="r" ok={status.serviceRole} />],
      ["Webhook adrese", <code key="u" className="break-all text-[12px] text-ink">{status.webhookUrl}</code>],
      [
        "Webhook notikumi",
        <span key="e" className="flex flex-wrap gap-1">
          {EVENTS.map((e) => (
            <code key={e} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11.5px] text-ink">
              {e}
            </code>
          ))}
        </span>,
      ],
    );
  }

  return (
    <section id="stripe" className="scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <header className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#635bff]/10 text-[#635bff]">
          <CreditCard className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold text-ink">Tiešsaistes maksājumi (Stripe)</h2>
          <p className="text-[13px] text-muted">
            Kartes (Visa, Mastercard u.c.), Apple Pay, Google Pay un citas Stripe paneļa ieslēgtās metodes. Klients maksā drošā Stripe lapā; pēc apmaksas
            pasūtījums automātiski kļūst “Apmaksāts”, tiek izrakstīts rēķins un nosūtīti e-pasti.
          </p>
        </div>
        {status.account && (
          <a href={dash} target="_blank" rel="noreferrer" className="hidden shrink-0 items-center gap-1 text-[12.5px] font-semibold text-navy-600 hover:underline sm:inline-flex">
            Stripe panelis <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </header>
      <dl className="grid gap-x-6 gap-y-2.5 p-5 sm:grid-cols-[200px_minmax(0,1fr)]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[13px] font-semibold text-muted">{k}</dt>
            <dd className="min-w-0">{v}</dd>
          </div>
        ))}
      </dl>
      {status.error && (
        <footer className="border-t border-line bg-slate-50/60 px-5 py-3 text-[12px]">
          <p className="font-semibold text-red-700">
            {developer ? `Stripe API kļūda: ${status.error}` : "Maksājumu pieslēgumā ir kļūda — lūdzu, sazinieties ar izstrādātāju."}
          </p>
        </footer>
      )}
      {developer && !ready && (
        <footer className="border-t border-line bg-slate-50/60 px-5 py-3 text-[12.5px] text-ink">
          <p className="mb-1.5 font-semibold">Pieslēgšana:</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>Stripe → Developers → API keys → Secret key → Netlify vides mainīgais STRIPE_SECRET_KEY.</li>
            <li>
              Stripe → Developers → Webhooks → Add endpoint: <code className="text-ink">{status.webhookUrl}</code>, notikumi augstāk → Signing secret →
              STRIPE_WEBHOOK_SECRET.
            </li>
            <li>Supabase → Project Settings → API keys → service_role → SUPABASE_SERVICE_ROLE_KEY.</li>
            <li>Stripe → Settings → Payment methods: ieslēgt Cards, Apple Pay, Google Pay (un pēc vēlmes Link u.c.). Pēc tam Netlify → Deploys → Trigger deploy.</li>
          </ol>
        </footer>
      )}
    </section>
  );
}
