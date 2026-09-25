import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/admin/labels";

/** Shared, server-safe building blocks for the admin panel. */

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-muted transition hover:text-navy-700"
          >
            <span aria-hidden>←</span> {back.label}
          </Link>
        )}
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("rounded-2xl border border-line bg-white shadow-card", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-line/80 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

const toneClass: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-600 ring-slate-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  yellow: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
  navy: "bg-navy-50 text-navy-700 ring-navy-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
};
const dotClass: Record<Tone, string> = {
  gray: "bg-slate-400",
  blue: "bg-sky-500",
  yellow: "bg-brand-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
  purple: "bg-violet-500",
  navy: "bg-navy-500",
  orange: "bg-orange-500",
};

export function Pill({ tone = "gray", children, dot = true, className }: { tone?: Tone; children: React.ReactNode; dot?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold ring-1 ring-inset",
        toneClass[tone],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[tone])} aria-hidden />}
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {Icon && (
        <div className="relative mb-4">
          <div className="absolute inset-0 -skew-x-12 rounded-2xl bg-brand-400/25 blur-md" aria-hidden />
          <div className="relative grid h-12 w-12 -skew-x-6 place-items-center rounded-2xl bg-navy-700 text-brand-400 shadow-lift">
            <Icon className="h-5 w-5 skew-x-6" aria-hidden />
          </div>
        </div>
      )}
      <p className="text-[15px] font-bold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200/70", className)} aria-hidden />;
}

export function KeyValue({ items, className }: { items: [React.ReactNode, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-4 gap-y-2.5 text-[13px]", className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-[minmax(0,130px)_1fr] items-baseline gap-3">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words font-medium text-ink">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Table wrapper with horizontal scroll on small screens. */
export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-[13px]">{children}</table>
    </div>
  );
}

export const th =
  "sticky top-0 z-[1] border-b border-line bg-slate-50/95 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted backdrop-blur first:pl-5 last:pr-5";
export const td = "border-b border-line/70 px-4 py-3 align-middle first:pl-5 last:pr-5";
export const trHover = "group transition-colors hover:bg-navy-50/40 focus-within:bg-navy-50/50";

/** Sortable column header rendered as a link (server-side sorting). */
export function SortTh({
  label,
  field,
  current,
  dir,
  href,
  className,
}: {
  label: string;
  field: string;
  current: string;
  dir: "asc" | "desc";
  href: (field: string, dir: "asc" | "desc") => string;
  className?: string;
}) {
  const active = current === field;
  const next = active && dir === "desc" ? "asc" : "desc";
  return (
    <th className={cn(th, className)} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={href(field, next)} className={cn("inline-flex items-center gap-1 hover:text-navy-700", active && "text-navy-700")} scroll={false}>
        {label}
        <span aria-hidden className={cn("text-[10px]", !active && "opacity-30")}>
          {active ? (dir === "asc" ? "▲" : "▼") : "▼"}
        </span>
      </Link>
    </th>
  );
}

export function Pagination({ page, total, pageSize, href }: { page: number; total: number; pageSize: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-line bg-white px-2.5 text-[13px] font-semibold text-ink transition hover:border-navy-300 hover:bg-navy-50";
  const nums: number[] = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i);
  return (
    <nav className="flex flex-col items-center justify-between gap-3 px-5 py-3 text-[13px] text-muted sm:flex-row" aria-label="Lapas">
      <span>
        {from}–{to} no {total}
      </span>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={href(page - 1)} className={btn} aria-label="Iepriekšējā lapa">
            ‹
          </Link>
        ) : (
          <span className={cn(btn, "pointer-events-none opacity-40")}>‹</span>
        )}
        {nums.map((n) => (
          <Link
            key={n}
            href={href(n)}
            aria-current={n === page ? "page" : undefined}
            className={cn(btn, n === page && "border-navy-700 bg-navy-700 text-white hover:bg-navy-700")}
          >
            {n}
          </Link>
        ))}
        {page < pages ? (
          <Link href={href(page + 1)} className={btn} aria-label="Nākamā lapa">
            ›
          </Link>
        ) : (
          <span className={cn(btn, "pointer-events-none opacity-40")}>›</span>
        )}
      </div>
    </nav>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
      <strong className="font-bold">Neizdevās ielādēt datus.</strong> {message}
    </div>
  );
}

/** Small segmented control rendered with links (e.g. period switch). */
export function Segmented({ items }: { items: { href: string; label: string; active: boolean }[] }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-white p-1 shadow-card" role="tablist">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          role="tab"
          aria-selected={it.active}
          scroll={false}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[13px] font-bold transition",
            it.active ? "bg-navy-700 text-white shadow-sm" : "text-muted hover:bg-navy-50 hover:text-navy-700",
          )}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}

export const inputSm =
  "h-9 w-full rounded-lg border border-line bg-white px-3 text-[13px] text-ink outline-none transition placeholder:text-muted/70 focus:border-navy-400 focus:ring-4 focus:ring-navy-100";
