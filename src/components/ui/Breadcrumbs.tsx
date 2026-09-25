import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Href = React.ComponentProps<typeof Link>["href"];

export function Breadcrumbs({
  items,
  label,
  tone = "light",
  className,
}: {
  items: { name: string; href?: Href }[];
  label: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("text-[13px]", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {it.href && !last ? (
                <Link
                  href={it.href}
                  className={cn(
                    "font-medium transition",
                    tone === "dark" ? "text-white/60 hover:text-white" : "text-muted hover:text-navy-700",
                  )}
                >
                  {it.name}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={cn("line-clamp-1 font-semibold", tone === "dark" ? "text-white" : "text-ink")}
                >
                  {it.name}
                </span>
              )}
              {!last && <ChevronRight aria-hidden className={cn("size-3.5", tone === "dark" ? "text-white/35" : "text-muted/60")} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
