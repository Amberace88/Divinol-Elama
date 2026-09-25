import { Filter } from "lucide-react";
import { fmtNumber, fmtPct } from "@/lib/admin/format";
import { EmptyState } from "../ui";

export type FunnelStep = { label: string; value: number; hint?: string };

/** Horizontal conversion funnel with step-to-step and overall conversion. */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const top = steps[0]?.value ?? 0;
  if (!top) {
    return (
      <EmptyState
        icon={Filter}
        title="Piltuvei vēl nav datu"
        description="Kad apmeklētāji skatīs produktus, pievienos tos grozam un noformēs pasūtījumus, šeit redzēsiet, kurā solī viņi aiziet."
      />
    );
  }
  return (
    <ol className="space-y-3.5">
      {steps.map((s, i) => {
        const prev = i === 0 ? s.value : steps[i - 1].value;
        const stepPct = i === 0 ? 100 : prev ? (s.value / prev) * 100 : 0;
        const overall = (s.value / top) * 100;
        return (
          <li key={s.label}>
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px]">
              <span className="grid h-5 w-5 shrink-0 -skew-x-6 place-items-center rounded-md bg-navy-700 text-[11px] font-extrabold text-brand-400">
                <span className="skew-x-6">{i + 1}</span>
              </span>
              <span className="font-semibold text-ink">{s.label}</span>
              {s.hint && <span className="text-[12px] text-muted">{s.hint}</span>}
              <span className="ml-auto font-extrabold tabular-nums text-ink">{fmtNumber(s.value)}</span>
              <span className="w-16 text-right text-[12px] tabular-nums text-muted">{fmtPct(overall, 1)}</span>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full -skew-x-12 rounded-full bg-gradient-to-r from-navy-700 to-navy-500 transition-[width] duration-700"
                style={{ width: `${Math.max(s.value ? 2 : 0, overall)}%` }}
              />
            </div>
            {i > 0 && (
              <p className="mt-1 text-[11.5px] text-muted">
                <span className={stepPct >= 50 ? "font-bold text-emerald-700" : stepPct >= 15 ? "font-bold text-brand-700" : "font-bold text-red-600"}>
                  {fmtPct(stepPct, 1)}
                </span>{" "}
                no iepriekšējā soļa
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
