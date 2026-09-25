import Image from "next/image";
import { BadgeCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type HeroBottle = { slug: string; name: string; image: string; label: string };

/** Static, aligned product showcase for the hero — no rotation, parallax or looping motion. */
export function HeroBottles({
  bottles,
  title,
  note,
  className,
}: {
  bottles: HeroBottle[];
  title: string;
  note: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-3xl bg-white/[0.06] p-3 ring-1 ring-white/12 sm:p-4", className)}>
      <div className="flex items-center justify-between gap-3 px-1.5 pb-3 pt-1">
        <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/60">{title}</span>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/75">
          <BadgeCheck className="size-4 text-brand-400" aria-hidden />
          {note}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-3">
        {bottles.slice(0, 4).map((b, i) => (
          <li key={b.slug}>
            <Link
              href={{ pathname: "/product/[slug]", params: { slug: b.slug } }}
              className="group flex h-full flex-col rounded-2xl bg-white p-3 ring-1 ring-black/5 transition-colors hover:ring-brand-400"
            >
              <span className="relative block aspect-square overflow-hidden rounded-xl bg-canvas">
                <Image
                  src={b.image}
                  alt={b.name}
                  fill
                  priority={i < 2}
                  sizes="(min-width:1024px) 220px, 45vw"
                  className="object-contain p-3 mix-blend-multiply"
                />
              </span>
              <span className="mt-3 flex items-start justify-between gap-2 px-0.5">
                <span className="line-clamp-2 text-[12.5px] font-bold leading-snug text-ink">{b.name.replace(/^Divinol\s+/i, "")}</span>
                <span className="shrink-0 rounded-md bg-navy-50 px-1.5 py-0.5 text-[10.5px] font-bold text-navy-700 ring-1 ring-navy-100">{b.label}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
