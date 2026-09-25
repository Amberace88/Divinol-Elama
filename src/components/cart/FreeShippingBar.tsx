"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Truck, PartyPopper } from "lucide-react";
import { useMoney } from "@/components/ui/useMoney";
import { cn } from "@/lib/utils";

export function FreeShippingBar({ left, progress, className }: { left: number | null; progress: number; className?: string }) {
  const t = useTranslations("cart");
  const money = useMoney();
  if (left == null) return null;
  const done = left <= 0;
  return (
    <div className={cn("rounded-xl p-3.5", done ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-canvas ring-1 ring-line", className)}>
      <p className={cn("flex items-center gap-2 text-[13px] font-semibold", done ? "text-emerald-800" : "text-ink/80")}>
        {done ? <PartyPopper className="size-4" aria-hidden /> : <Truck className="size-4 text-navy-500" aria-hidden />}
        {done
          ? t("freeShippingOk")
          : t.rich("freeShippingLeft", { amount: money(left), b: (c) => <b>{c}</b> })}
      </p>
      <div
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface ring-1 ring-inset ring-black/5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label={t("freeShippingTitle")}
      >
        <motion.div
          className={cn(
            "relative h-full overflow-hidden rounded-full",
            done ? "bg-emerald-500" : "bg-gradient-to-r from-brand-400 to-brand-500",
          )}
          initial={false}
          animate={{ width: `${Math.max(4, progress * 100)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        >
        </motion.div>
      </div>
    </div>
  );
}
