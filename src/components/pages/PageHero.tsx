import { useTranslations } from "next-intl";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";
import type { Link } from "@/i18n/navigation";

type Href = React.ComponentProps<typeof Link>["href"];
export type Crumb = { name: string; href?: Href };

/**
 * Shared navy hero for content & tool pages: breadcrumb, eyebrow, the page's only <h1>, lead text,
 * optional actions (children) and an optional right-hand visual.
 */
export function PageHero({
  eyebrow,
  title,
  text,
  crumbs,
  visual,
  children,
  compact = false,
  className,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  /** trail after "Home" — the last item is the current page */
  crumbs: Crumb[];
  visual?: React.ReactNode;
  children?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations();
  const items: Crumb[] = [{ name: t("nav.home"), href: "/" }, ...crumbs];
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden bg-gradient-to-br from-navy-800 via-navy-700 to-navy-950 text-white",
        className,
      )}
    >
      {/* decorative layers */}
      <div aria-hidden className="grid-bg pointer-events-none absolute inset-0 -z-10 opacity-70 [mask-image:radial-gradient(ellipse_at_top_left,black_30%,transparent_75%)]" />
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-32 -z-10 size-[520px] rounded-full bg-brand-400/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 -z-10 size-[380px] rounded-full bg-navy-400/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute right-[8%] bottom-0 -z-10 hidden h-[140%] w-24 origin-bottom -skew-x-12 bg-gradient-to-t from-brand-400/25 via-brand-400/5 to-transparent lg:block" />

      <div
        className={cn(
          "container-x grid items-center gap-10",
          compact ? "py-10 sm:py-14" : "py-12 sm:py-16 lg:py-20",
          visual ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" : "",
        )}
      >
        <div className="max-w-3xl">
          <Breadcrumbs items={items} label={t("a11y.breadcrumbs")} tone="dark" className="mb-6 sm:mb-8" />
          <Reveal y={16}>
            <p className="eyebrow text-brand-300">{eyebrow}</p>
          </Reveal>
          <Reveal y={20} delay={0.05}>
            <h1
              className={cn(
                "h-display mt-3 leading-[1.05]",
                compact ? "text-3xl sm:text-4xl lg:text-[2.75rem]" : "text-4xl sm:text-5xl lg:text-6xl",
              )}
            >
              {title}
            </h1>
          </Reveal>
          {text && (
            <Reveal y={20} delay={0.1}>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">{text}</p>
            </Reveal>
          )}
          {children && (
            <Reveal y={20} delay={0.15}>
              <div className="mt-8">{children}</div>
            </Reveal>
          )}
        </div>
        {visual && (
          <Reveal y={28} delay={0.15} className="relative">
            {visual}
          </Reveal>
        )}
      </div>
      <div aria-hidden className="h-1.5 w-full bg-gradient-to-r from-brand-400 via-brand-300 to-transparent" />
    </section>
  );
}

/** Section heading used across content pages (eyebrow + h2 + optional lead). */
export function SectionHeading({
  eyebrow,
  title,
  text,
  align = "left",
  id,
  className,
  tone = "light",
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  align?: "left" | "center";
  id?: string;
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <div className={cn(align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl", className)}>
      {eyebrow && <p className={cn("eyebrow", align === "center" && "justify-center")}>{eyebrow}</p>}
      <h2
        id={id}
        className={cn(
          "h-display mt-2 text-3xl leading-tight sm:text-4xl",
          tone === "dark" ? "text-white" : "text-navy-700",
        )}
      >
        {title}
      </h2>
      {text && <p className={cn("mt-4 text-base leading-7", tone === "dark" ? "text-white/70" : "text-muted")}>{text}</p>}
    </div>
  );
}
