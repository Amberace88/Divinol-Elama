import type { LucideIcon } from "lucide-react";
import { fmtNumber, fmtPct } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "../ui";

export type BarRow = {
  key: string;
  label: React.ReactNode;
  /** Value that drives the bar length (also the first numeric column). */
  value: number;
  /** Extra numeric columns after the main value. */
  extra?: (number | string)[];
};

/**
 * Plausible-style ranked list: a light bar behind each row, proportional to `value`.
 * Designed to sit in a <Panel bodyClassName="p-0">.
 */
export function BarList({
  head,
  rows,
  share,
  empty,
  className,
}: {
  /** [label column, main value column, ...extra columns] */
  head: string[];
  rows: BarRow[];
  /** Show each row's share of the total as an extra column. */
  share?: boolean;
  empty: { icon: LucideIcon; title: string; description?: string };
  className?: string;
}) {
  if (rows.length === 0) return <EmptyState icon={empty.icon} title={empty.title} description={empty.description} className="py-10" />;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const col = "w-[4.5rem] shrink-0 text-right";
  return (
    <div className={className}>
      <div className="flex items-center gap-3 border-b border-line bg-slate-50/95 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
        <span className="min-w-0 flex-1">{head[0]}</span>
        {head.slice(1).map((h) => (
          <span key={h} className={col}>
            {h}
          </span>
        ))}
        {share && <span className={cn(col, "w-12")}>%</span>}
      </div>
      <ul className="space-y-0.5 px-3 py-2.5">
        {rows.map((r) => (
          <li key={r.key} className="relative flex min-h-9 items-center gap-3 rounded-lg px-2 text-[13px]">
            <span
              className="absolute inset-y-0.5 left-0 rounded-lg bg-navy-50 transition-[width] duration-500"
              style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%` }}
              aria-hidden
            />
            <span className="relative min-w-0 flex-1 truncate py-1.5 font-semibold text-ink">{r.label}</span>
            <span className={cn(col, "relative font-bold tabular-nums text-ink")}>{fmtNumber(r.value)}</span>
            {r.extra?.map((v, i) => (
              <span key={i} className={cn(col, "relative tabular-nums text-muted")}>
                {typeof v === "number" ? fmtNumber(v) : v}
              </span>
            ))}
            {share && <span className={cn(col, "relative w-12 tabular-nums text-muted")}>{fmtPct((r.value / total) * 100, 0)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
