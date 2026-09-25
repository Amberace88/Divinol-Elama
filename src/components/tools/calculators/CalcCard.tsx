import type { LucideIcon } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

/** Shell for one calculator: anchor target, heading, inputs (left) and a navy result panel (right). */
export function CalcCard({
  id,
  icon: Icon,
  index,
  title,
  text,
  inputs,
  result,
  footer,
}: {
  id: string;
  icon: LucideIcon;
  index: number;
  title: string;
  text: string;
  inputs: React.ReactNode;
  result: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Reveal>
      <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32 rounded-3xl border border-line bg-surface shadow-card">
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex items-start gap-4">
              <span className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-navy-700 text-brand-400">
                <Icon className="size-6" aria-hidden />
                <span className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-brand-400 text-[10px] font-extrabold text-navy-900">
                  {index}
                </span>
              </span>
              <div>
                <h2 id={`${id}-title`} className="h-display text-2xl text-navy-700 sm:text-[1.75rem]">
                  {title}
                </h2>
                <p className="mt-1.5 text-[15px] leading-6 text-muted">{text}</p>
              </div>
            </div>
            <div className="mt-8 grid gap-7">{inputs}</div>
          </div>
          <div className={cn("relative isolate overflow-hidden bg-navy-800 p-6 text-white sm:p-8 lg:rounded-tr-[calc(1.75rem-1px)] lg:p-10", footer ? "" : "rounded-b-[calc(1.75rem-1px)] lg:rounded-bl-none")}>
            <div aria-hidden className="grid-bg absolute inset-0 -z-10 opacity-50" />
            <div aria-hidden className="absolute -top-24 -right-24 -z-10 size-72 rounded-full bg-brand-400/15 blur-3xl" />
            <div aria-live="polite">{result}</div>
          </div>
        </div>
        {footer && <div className="rounded-b-[calc(1.75rem-1px)] border-t border-line bg-canvas/70 px-6 py-4 text-[13px] leading-5 text-muted sm:px-8 lg:px-10">{footer}</div>}
      </section>
    </Reveal>
  );
}

export function ResultLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/55">{children}</p>;
}

export function BigValue({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("h-display mt-1 text-4xl leading-none text-brand-400 sm:text-5xl", className)}>{children}</p>;
}
