import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

/** Section card used across the account pages. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card overflow-hidden", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {title && <h2 className="text-base font-extrabold tracking-[-0.01em] text-navy-800">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] leading-6 text-muted">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("p-5 sm:p-6", bodyClassName)}>{children}</div>
    </section>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="h-display text-2xl text-navy-800 sm:text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm leading-6 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="grid h-14 w-14 -skew-x-6 place-items-center rounded-2xl bg-navy-50 text-navy-600">
        <span className="skew-x-6">{icon}</span>
      </span>
      <p className="mt-4 font-bold text-navy-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm leading-6 text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const ORDER_TONES: Record<string, string> = {
  new: "bg-navy-50 text-navy-700 ring-navy-100",
  confirmed: "bg-sky-50 text-sky-800 ring-sky-100",
  processing: "bg-brand-50 text-brand-700 ring-brand-200",
  shipped: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  cancelled: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  // invoice / payment states
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  unpaid: "bg-brand-50 text-brand-700 ring-brand-200",
  overdue: "bg-danger/10 text-danger ring-danger/20",
  void: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  refunded: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  partially_refunded: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export function StatusPill({ status, label, className }: { status: string; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ring-1 ring-inset",
        ORDER_TONES[status] ?? ORDER_TONES.new,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {label}
    </span>
  );
}

export function LoadError({ text }: { text: string }) {
  return <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{text}</div>;
}

/** Link to the invoice PDF route (`/api/invoices/<id>/pdf`, not localized). */
export function InvoicePdfLink({ id, label, number, compact }: { id: string; label: string; number?: string; compact?: boolean }) {
  return (
    <a
      href={`/api/invoices/${id}/pdf`}
      target="_blank"
      rel="noopener"
      aria-label={number ? `${label} — ${number}` : label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg font-bold text-navy-700 ring-1 ring-line transition hover:bg-navy-50 hover:ring-navy-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-300",
        compact ? "h-8 px-2.5 text-[12px]" : "h-9 px-3 text-[13px]",
      )}
    >
      <Download className="h-4 w-4" aria-hidden />
      {label}
    </a>
  );
}
