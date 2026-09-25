import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import type { Link } from "@/i18n/navigation";

type Href = React.ComponentProps<typeof Link>["href"];

/** Navy page heading used by the catalog pages (server component). */
export function CatalogHero({
  eyebrow,
  title,
  intro,
  icon,
  crumbs,
  crumbsLabel,
  stats,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  icon?: string;
  crumbs: { name: string; href?: Href }[];
  crumbsLabel: string;
  stats?: string[];
}) {
  return (
    <section className="relative overflow-hidden bg-navy-700 text-white">
      <div aria-hidden className="absolute inset-0 grid-bg" />
      <div
        aria-hidden
        className="absolute -right-24 -top-10 h-[140%] w-72 -skew-x-[20deg] bg-gradient-to-b from-brand-400/25 via-brand-400/5 to-transparent"
      />
      <div aria-hidden className="absolute -right-4 top-0 h-full w-10 -skew-x-[20deg] bg-brand-400/80" />
      <div className="container-x relative py-10 sm:py-14">
        <Breadcrumbs items={crumbs} label={crumbsLabel} tone="dark" />
        <div className="mt-6 flex items-start gap-5">
          {icon && (
            <span className="hidden size-16 shrink-0 place-items-center rounded-2xl bg-brand-400 text-navy-900 shadow-glow sm:grid">
              <CategoryIcon name={icon} className="size-8" aria-hidden />
            </span>
          )}
          <div className="max-w-3xl">
            <p className="eyebrow text-brand-300!">{eyebrow}</p>
            <h1 className="h-display mt-2 text-3xl sm:text-4xl lg:text-5xl">{title}</h1>
            {intro && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/70 sm:text-base">{intro}</p>}
            {stats && stats.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {stats.map((s) => (
                  <li key={s} className="rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-bold text-white/85 ring-1 ring-white/15">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
