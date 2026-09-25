import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  text,
  align = "left",
  tone = "light",
  action,
  className,
  id,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
  action?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-5",
        align === "center" && "flex-col items-center text-center",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && <p className={cn("eyebrow", tone === "dark" && "text-brand-300!")}>{eyebrow}</p>}
        <h2 id={id} className={cn("h-display mt-3 text-3xl sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]", tone === "dark" ? "text-white" : "text-ink")}>
          {title}
        </h2>
        {text && <p className={cn("mt-4 text-[15px] leading-relaxed sm:text-base", tone === "dark" ? "text-white/65" : "text-muted")}>{text}</p>}
      </div>
      {action}
    </div>
  );
}
