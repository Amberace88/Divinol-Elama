"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, Copy, PackageCheck, UserRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { usePricing } from "@/components/providers/PriceProvider";
import { buttonClass } from "@/components/ui/Button";

export function SuccessBadge() {
  return (
    <motion.span
      initial={{ scale: 0.4, rotate: -30, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 16 }}
      className="relative mx-auto grid size-20 place-items-center rounded-3xl bg-emerald-500 text-white shadow-[0_20px_40px_-12px_rgb(16_185_129/0.6)]"
    >
      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.25, type: "spring" }}>
        <Check className="size-10" strokeWidth={3.5} aria-hidden />
      </motion.span>
      <span aria-hidden className="absolute -right-3 -top-3 h-8 w-4 -skew-x-[20deg] rounded-sm bg-brand-400" />
    </motion.span>
  );
}

export function CopyValue({ value }: { value: string }) {
  const t = useTranslations("checkout.success");
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setOk(true);
          window.setTimeout(() => setOk(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-bold text-navy-600 ring-1 ring-line transition hover:bg-canvas"
    >
      {ok ? <Check className="size-3.5 text-emerald-600" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {ok ? t("copied") : t("copy")}
    </button>
  );
}

export function SuccessActions() {
  const t = useTranslations("checkout.success");
  const { profile } = usePricing();
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap justify-center gap-2">
        {profile && (
          <Link href="/account/orders" className={buttonClass("dark", "lg")}>
            <PackageCheck className="size-5 text-brand-400" aria-hidden />
            {t("toAccount")}
          </Link>
        )}
        <Link href="/catalog" className={buttonClass(profile ? "outline" : "primary", "lg")}>
          {t("toCatalog")}
          <ArrowRight className="size-5" aria-hidden />
        </Link>
      </div>
      {!profile && (
        <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-center text-[13px] text-muted">
          <UserRound className="size-4" aria-hidden />
          {t("createAccount")}
          <Link href="/register" className="font-bold text-navy-600 underline underline-offset-2">
            {t("register")}
          </Link>
        </p>
      )}
    </div>
  );
}
