import { getTranslations } from "next-intl/server";
import { Check, CircleDot, FileText, PackageCheck, Truck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "./format";

const STEPS = ["new", "confirmed", "processing", "shipped", "completed"] as const;

/** Horizontal status stepper (new → completed). */
export async function OrderProgress({ status, locale }: { status: string; locale: string }) {
  const t = await getTranslations({ locale, namespace: "account" });
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700">
        <XCircle className="h-5 w-5 shrink-0" />
        {t("order.cancelledNote")}
      </div>
    );
  }
  const current = Math.max(0, STEPS.indexOf(status as (typeof STEPS)[number]));
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label={t("order.progress")}>
      {STEPS.map((s, i) => {
        const done = i < current || (i === current && s === "completed");
        const active = i === current && !done;
        return (
          <li key={s} className="min-w-0" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "block h-1.5 -skew-x-12 rounded-sm transition-colors",
                done ? "bg-navy-700" : active ? "bg-brand-400" : "bg-line",
              )}
            />
            <span
              className={cn(
                "mt-2 block truncate text-[11px] font-bold sm:text-xs",
                done ? "text-navy-700" : active ? "text-ink" : "text-muted/80",
              )}
            >
              {t(`status.${s}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export type OrderEvent = { id: string; type: string; message: string | null; created_at: string };

const KNOWN_EVENTS = ["created", "invoice", "status", "confirmed", "processing", "shipped", "completed", "cancelled", "paid", "payment", "tracking", "note"];
const STATUS_WORDS = ["new", "confirmed", "processing", "shipped", "completed", "cancelled"];

function eventIcon(type: string) {
  if (type === "invoice" || type === "paid" || type === "payment") return FileText;
  if (type === "shipped" || type === "tracking") return Truck;
  if (type === "completed") return PackageCheck;
  if (type === "cancelled") return XCircle;
  if (type === "created") return Check;
  return CircleDot;
}

/** Vertical list of order_events with readable labels. */
export async function OrderEvents({ events, locale }: { events: OrderEvent[]; locale: string }) {
  const t = await getTranslations({ locale, namespace: "account" });
  return (
    <ol className="relative grid gap-5 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-line">
      {events.map((e, i) => {
        const Icon = eventIcon(e.type);
        const known = KNOWN_EVENTS.includes(e.type);
        const statusWord = e.message && STATUS_WORDS.includes(e.message.trim()) ? e.message.trim() : null;
        let title: string;
        let detail: string | null = null;
        if (e.type === "invoice") {
          title = t("order.events.invoice", { number: e.message ?? "" });
        } else if (e.type === "status" && statusWord) {
          title = t("order.events.statusTo", { status: t(`status.${statusWord}`) });
        } else {
          title = known ? t(`order.events.${e.type}`) : t("order.events.other");
          // "created" carries a fixed Latvian system text – skip it; show admin-written notes otherwise.
          detail = e.type === "created" || statusWord ? null : e.message;
        }
        const last = i === events.length - 1;
        return (
          <li key={e.id} className="relative flex gap-3.5">
            <span
              className={cn(
                "relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-white",
                last ? "bg-navy-700 text-white" : "bg-navy-50 text-navy-600",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-sm font-bold text-ink">{title}</p>
              {detail && <p className="mt-0.5 text-[13px] leading-6 break-words text-muted">{detail}</p>}
              <p className="mt-0.5 text-xs text-muted/90">{formatDate(e.created_at, locale, { time: true })}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
