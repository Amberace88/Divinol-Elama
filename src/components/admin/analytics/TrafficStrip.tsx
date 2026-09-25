import Link from "next/link";
import { Activity, Eye, Percent, Users } from "lucide-react";
import { deltaPct, fmtNumber, fmtPct } from "@/lib/admin/format";
import { ratios, type Traffic } from "@/lib/admin/analytics";
import { cn } from "@/lib/utils";
import { LivePill } from "./LivePill";

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[11px] font-bold text-muted">jauns</span>;
  const good = value > 0.05;
  const bad = value < -0.05;
  return (
    <span className={cn("text-[11px] font-bold tabular-nums", good ? "text-emerald-700" : bad ? "text-red-600" : "text-muted")}>
      {value > 0 ? "+" : ""}
      {fmtPct(value)}
    </span>
  );
}

/** Compact traffic row for the admin overview (Pārskats). */
export function TrafficStrip({ traffic, days, periodLabel }: { traffic: Traffic | null; days: number; periodLabel: string }) {
  const cur = ratios(traffic?.totals);
  const prev = ratios(traffic?.previous);
  const items = [
    { label: "Apmeklētāji", value: fmtNumber(cur.visitors), delta: deltaPct(cur.visitors, prev.visitors), icon: Users },
    { label: "Lapu skatījumi", value: fmtNumber(cur.pageviews), delta: deltaPct(cur.pageviews, prev.pageviews), icon: Eye },
    { label: "Konversija", value: fmtPct(cur.conversion, 2), delta: deltaPct(cur.conversion, prev.conversion), icon: Percent },
  ];
  return (
    <section className="mt-3 rounded-2xl border border-line bg-white p-3.5 shadow-card sm:px-5" aria-label="Apmeklējums">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 lg:w-48 lg:shrink-0">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy-600">
            <Activity className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-ink">Apmeklējums</p>
            <p className="text-[12px] text-muted">{periodLabel} · bez sīkdatnēm</p>
          </div>
        </div>
        <dl className="grid flex-1 grid-cols-3 gap-2 sm:gap-4">
          {items.map((it) => (
            <div key={it.label} className="min-w-0 rounded-xl bg-slate-50/80 px-3 py-2">
              <dt className="flex items-center gap-1.5 truncate text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                <it.icon className="hidden h-3.5 w-3.5 sm:block" aria-hidden />
                {it.label}
              </dt>
              <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                <span className="text-[17px] font-extrabold tabular-nums text-ink">{traffic ? it.value : "—"}</span>
                {traffic && <Delta value={it.delta} />}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
          <LivePill initial={traffic?.realtime?.visitors ?? 0} />
          <Link href={`/admin/analytics?days=${days}`} className="px-1 text-[12px] font-bold text-navy-600 hover:underline">
            Skatīt apmeklējumu →
          </Link>
        </div>
      </div>
    </section>
  );
}
