import { BadgeCheck } from "lucide-react";
import { MARQUEE_APPROVALS } from "@/lib/shop/featured";

/** Static strip of OEM approvals / specifications (no looping motion). */
export function ApprovalMarquee({ label }: { label: string }) {
  return (
    <section aria-label={label} className="border-b border-line bg-page py-6">
      <div className="container-x flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
        <p className="shrink-0 text-[12px] font-bold uppercase tracking-[0.14em] text-muted lg:max-w-[180px]">{label}</p>
        <ul className="flex flex-wrap gap-2">
          {MARQUEE_APPROVALS.map((a) => (
            <li
              key={a}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-canvas px-3 py-1.5 text-[12.5px] font-bold text-navy-700"
            >
              <BadgeCheck className="size-3.5 text-brand-500" aria-hidden />
              {a}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
