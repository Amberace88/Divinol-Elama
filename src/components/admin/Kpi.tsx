import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight, type LucideIcon } from "lucide-react";
import { fmtPct } from "@/lib/admin/format";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  hint,
  accent,
}: {
  label: string;
  value: string;
  delta?: number | null;
  icon: LucideIcon;
  hint?: string;
  accent?: boolean;
}) {
  const up = delta != null && delta > 0.05;
  const down = delta != null && delta < -0.05;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift sm:p-5",
        accent ? "border-navy-800 bg-navy-700 text-white" : "border-line bg-white",
      )}
    >
      {accent && <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-400/25 blur-2xl" aria-hidden />}
      <div className="relative flex items-center justify-between gap-2">
        <p className={cn("text-[12px] font-bold uppercase tracking-[0.08em]", accent ? "text-white/60" : "text-muted")}>{label}</p>
        <span
          className={cn(
            "grid h-8 w-8 -skew-x-6 place-items-center rounded-lg",
            accent ? "bg-brand-400 text-navy-900" : "bg-navy-50 text-navy-600",
          )}
        >
          <Icon className="h-4 w-4 skew-x-6" aria-hidden />
        </span>
      </div>
      <p className={cn("relative mt-2 text-[22px] font-extrabold tracking-[-0.02em] tabular-nums sm:text-[26px]", accent ? "text-white" : "text-ink")}>
        {value}
      </p>
      <div className="relative mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold",
              up && (accent ? "bg-emerald-400/20 text-emerald-300" : "bg-emerald-50 text-emerald-700"),
              down && (accent ? "bg-red-400/20 text-red-300" : "bg-red-50 text-red-700"),
              !up && !down && (accent ? "bg-white/10 text-white/70" : "bg-slate-100 text-muted"),
            )}
          >
            {up && <ArrowUpRight className="h-3 w-3" aria-hidden />}
            {down && <ArrowDownRight className="h-3 w-3" aria-hidden />}
            {delta == null ? "jauns" : `${delta > 0 ? "+" : ""}${fmtPct(delta)}`}
          </span>
        )}
        {hint && <span className={accent ? "text-white/55" : "text-muted"}>{hint}</span>}
      </div>
    </div>
  );
}

export function ActionTile({
  label,
  value,
  href,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  href: string;
  icon: LucideIcon;
  tone?: "default" | "warn" | "danger";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border bg-white p-3.5 shadow-card transition hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-lift focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy-100",
        tone === "danger" ? "border-red-200" : tone === "warn" ? "border-brand-300" : "border-line",
      )}
    >
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
          tone === "danger" ? "bg-red-50 text-red-600" : tone === "warn" ? "bg-brand-50 text-brand-700" : "bg-navy-50 text-navy-600",
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-muted">{label}</span>
        <span className="block text-[17px] font-extrabold tabular-nums text-ink">{value}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-navy-600" aria-hidden />
    </Link>
  );
}
