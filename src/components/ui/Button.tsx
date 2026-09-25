import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "dark" | "outline" | "ghost" | "light" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-400 text-navy-900 hover:bg-brand-300 shadow-[0_8px_24px_-10px_rgb(255_193_14/0.8)] hover:shadow-[0_12px_32px_-10px_rgb(255_193_14/0.9)]",
  dark: "bg-navy-700 text-white hover:bg-navy-600",
  outline: "border border-navy-200 bg-surface text-navy-700 hover:border-navy-400 hover:bg-navy-50",
  ghost: "text-navy-700 hover:bg-navy-50",
  light: "bg-white/10 text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20",
  danger: "bg-danger text-white hover:bg-danger/90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] rounded-lg gap-1.5",
  md: "h-11 px-5 text-sm rounded-xl gap-2",
  lg: "h-14 px-7 text-[15px] rounded-2xl gap-2.5",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "group/btn relative inline-flex select-none items-center justify-center overflow-hidden font-bold tracking-[-0.01em] transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(function Button({ variant = "primary", size = "md", className, children, ...props }, ref) {
  return (
    <button ref={ref} className={buttonClass(variant, size, className)} {...props}>
      {children}
    </button>
  );
});
