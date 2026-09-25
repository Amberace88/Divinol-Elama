import { cn } from "@/lib/utils";

/** Class helpers shared by server and client admin components (must NOT be a client module). */
type BtnVariant = "primary" | "dark" | "outline" | "ghost" | "danger" | "subtle";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-brand-400 text-navy-900 hover:bg-brand-300 shadow-[0_6px_18px_-10px_rgb(255_193_14/0.9)]",
  dark: "bg-navy-700 text-white hover:bg-navy-600",
  outline: "border border-line bg-white text-ink hover:border-navy-300 hover:bg-navy-50/60",
  ghost: "text-navy-700 hover:bg-navy-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
  subtle: "bg-slate-100 text-ink hover:bg-slate-200",
};

/** Compact admin button classes (for <button> and <Link>). */
export function btn(variant: BtnVariant = "dark", size: "sm" | "md" = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-bold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy-200",
    size === "sm" ? "h-8 px-2.5 text-[12px]" : "h-9 px-3.5 text-[13px]",
    btnVariants[variant],
    className,
  );
}

export const inputCls =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-[14px] text-ink outline-none transition placeholder:text-muted/60 focus:border-navy-400 focus:ring-4 focus:ring-navy-100 disabled:bg-slate-50 disabled:text-muted aria-[invalid=true]:border-red-400";
export const textareaCls =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none transition placeholder:text-muted/60 focus:border-navy-400 focus:ring-4 focus:ring-navy-100";
export const selectCls = cn(inputCls, "pr-8");
