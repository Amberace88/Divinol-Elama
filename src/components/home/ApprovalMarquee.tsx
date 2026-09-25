import { BadgeCheck } from "lucide-react";
import { MARQUEE_APPROVALS } from "@/lib/shop/featured";

export function ApprovalMarquee({ label }: { label: string }) {
  const items = [...MARQUEE_APPROVALS, ...MARQUEE_APPROVALS];
  return (
    <section aria-label={label} className="relative border-b border-line bg-white py-5">
      <p className="sr-only">{MARQUEE_APPROVALS.join(", ")}</p>
      <div className="group flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]" aria-hidden>
        <ul className="flex w-max shrink-0 animate-marquee items-center gap-3 pr-3 group-hover:[animation-play-state:paused]">
          {items.map((a, i) => (
            <li
              key={`${a}-${i}`}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-canvas px-4 py-2 text-[13px] font-bold text-navy-700"
            >
              <BadgeCheck className="size-4 text-brand-500" />
              {a}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
