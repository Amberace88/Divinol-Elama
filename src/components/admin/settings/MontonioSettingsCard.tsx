import { CreditCard } from "lucide-react";
import type { MontonioMethods } from "@/lib/payments/montonio";
import { cn } from "@/lib/utils";

export type MontonioCardStatus = {
  env: "sandbox" | "production";
  accessKey: boolean;
  secretKey: boolean;
  serviceRole: boolean;
  configured: boolean;
  methods: MontonioMethods | null;
  error: string | null;
  webhookUrl: string;
};

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

const COUNTRY: Record<string, string> = { LV: "Latvija", EE: "Igaunija", LT: "Lietuva" };

/** Iestatījumi → Tiešsaistes maksājumi (Montonio): configuration status + enabled methods. Never shows key values. */
export function MontonioSettingsCard({ status, developer = false }: { status: MontonioCardStatus; developer?: boolean }) {
  const m = status.methods;
  const rows: [string, React.ReactNode][] = [
    ["Statuss", <State key="s" ok={status.configured} okLabel="Pieslēgts — klienti var maksāt tiešsaistē" offLabel="Nav pieslēgts — kasē tikai pārskaitījums / rēķins" />],
  ];
  if (developer) {
    rows.push(
      ["Vide", <State key="e" ok warn={status.env === "sandbox"} okLabel={status.env === "production" ? "Production (īsti maksājumi)" : "Sandbox (testa maksājumi)"} />],
      ["MONTONIO_ACCESS_KEY", <State key="a" ok={status.accessKey} />],
      ["MONTONIO_SECRET_KEY", <State key="k" ok={status.secretKey} />],
      ["SUPABASE_SERVICE_ROLE_KEY", <State key="r" ok={status.serviceRole} />],
      ["Paziņojumu adrese", <code key="w" className="break-all text-[12px] text-ink">{status.webhookUrl}</code>],
    );
  } else if (status.configured) {
    rows.push(["Režīms", <State key="e" ok warn={status.env === "sandbox"} okLabel={status.env === "production" ? "Īsti maksājumi" : "Testa režīms"} />]);
  }
  if (m) {
    rows.push([
      "Kartes",
      <span key="c" className="flex flex-wrap gap-1.5">
        <State ok={m.card.enabled} okLabel="Visa / Mastercard" offLabel="Nav ieslēgtas" />
        {m.applePay && <State ok okLabel="Apple Pay" />}
        {m.googlePay && <State ok okLabel="Google Pay" />}
      </span>,
    ]);
    for (const c of ["LV", "EE", "LT"]) {
      const banks = m.banks[c] ?? [];
      rows.push([
        `Bankas · ${COUNTRY[c]}`,
        banks.length ? (
          <span key={c} className="flex flex-wrap items-center gap-1.5">
            {banks.map((b) => (
              <span key={b.code} title={`${b.name} (${b.code})`} className="grid h-8 min-w-14 place-items-center rounded-md bg-white px-2 ring-1 ring-line">
                {b.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote Montonio logos
                  <img src={b.logoUrl} alt={b.name} loading="lazy" className="max-h-5 max-w-20 object-contain" />
                ) : (
                  <span className="text-[11px] font-semibold text-ink">{b.name}</span>
                )}
              </span>
            ))}
          </span>
        ) : (
          <span key={c} className="text-[13px] text-muted">Nav pieejamu banku</span>
        ),
      ]);
    }
  }

  return (
    <section id="montonio" className="scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <header className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-600">
          <CreditCard className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-[15px] font-bold text-ink">Tiešsaistes maksājumi (Montonio)</h2>
          <p className="text-[13px] text-muted">
            {developer
              ? "Bankas saites (Swedbank, SEB, Citadele, Luminor u.c.), kartes, Apple Pay un Google Pay. Atslēgas — Montonio Partner System → Stores → API Keys; vides mainīgie Netlify iestatījumos. Paziņojumu adrese tiek nosūtīta ar katru maksājumu automātiski — Montonio pusē nekas nav jāiestata."
              : "Bankas saites (Swedbank, SEB, Citadele, Luminor u.c.), kartes, Apple Pay un Google Pay. Pieslēgumu iestata izstrādātājs."}
          </p>
        </div>
      </header>
      <dl className="grid gap-x-6 gap-y-2.5 p-5 sm:grid-cols-[200px_minmax(0,1fr)]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[13px] font-semibold text-muted">{k}</dt>
            <dd className="min-w-0">{v}</dd>
          </div>
        ))}
      </dl>
      {!developer && status.error && (
        <footer className="border-t border-line bg-slate-50/60 px-5 py-3 text-[12px]">
          <p className="font-semibold text-red-700">Maksājumu pieslēgumā ir kļūda — lūdzu, sazinieties ar izstrādātāju.</p>
        </footer>
      )}
      {developer && (status.error || (status.accessKey && status.secretKey && !status.serviceRole)) && (
        <footer className="border-t border-line bg-slate-50/60 px-5 py-3 text-[12px]">
          {status.error && <p className="font-semibold text-red-700">Montonio API kļūda: {status.error}. Pārbaudiet atslēgas un MONTONIO_ENV (sandbox atslēgas der tikai sandbox vidē).</p>}
          {status.accessKey && status.secretKey && !status.serviceRole && (
            <p className="text-orange-700">
              Trūkst SUPABASE_SERVICE_ROLE_KEY — bez tās veikals nevar droši atzīmēt apmaksu no Montonio paziņojuma, tāpēc tiešsaistes maksājumi kasē netiek rādīti.
            </p>
          )}
        </footer>
      )}
    </section>
  );
}
