"use client";

import { useTranslations } from "next-intl";
import { Clock, Flame, Hourglass, Leaf, Snowflake, Sparkles, Star, Tag, ThumbsUp, Wrench } from "lucide-react";
import { BADGE_KEYS, daysLeft, type ActivePromo, type BadgeKey } from "@/lib/promo";
import { cn } from "@/lib/utils";

const BADGE_STYLE: Record<BadgeKey, { icon: typeof Star; cls: string }> = {
  new: { icon: Sparkles, cls: "bg-emerald-500 text-white" },
  bestseller: { icon: Flame, cls: "bg-amber-400 text-navy-900" },
  recommended: { icon: ThumbsUp, cls: "bg-navy-700 text-white" },
  limited: { icon: Hourglass, cls: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200" },
  seasonal: { icon: Snowflake, cls: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200" },
  bio: { icon: Leaf, cls: "bg-lime-50 text-lime-800 ring-1 ring-inset ring-lime-200" },
  pro: { icon: Wrench, cls: "bg-slate-800 text-white" },
};

const PROMO_STYLE = {
  sale: "bg-rose-600 text-white shadow-[0_8px_18px_-8px_rgb(225_29_72/0.8)]",
  clearance: "bg-orange-500 text-white shadow-[0_8px_18px_-8px_rgb(249_115_22/0.8)]",
  special: "bg-brand-400 text-navy-900 shadow-[0_8px_18px_-8px_rgb(255_193_14/0.9)]",
} as const;

export function validBadges(badges: string[] | undefined | null): BadgeKey[] {
  return (badges ?? []).filter((b): b is BadgeKey => (BADGE_KEYS as readonly string[]).includes(b));
}

/** Promotion pill ("−15% Akcija"). */
export function PromoPill({ promo, size = "sm", className }: { promo: ActivePromo; size?: "sm" | "md"; className?: string }) {
  const t = useTranslations("promo");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg font-extrabold uppercase tracking-[0.04em]",
        size === "md" ? "px-2.5 py-1 text-[12px]" : "px-2 py-0.5 text-[10.5px]",
        PROMO_STYLE[promo.type],
        className,
      )}
    >
      <Tag className={size === "md" ? "size-3.5" : "size-3"} strokeWidth={2.75} aria-hidden />
      {promo.percent > 0 && <span className="tabular-nums">−{Math.round(promo.percent)}%</span>}
      <span className={cn(promo.percent > 0 && "font-bold normal-case tracking-normal opacity-95")}>{t(`types.${promo.type}`)}</span>
    </span>
  );
}

export function BadgePill({ badge, size = "sm" }: { badge: BadgeKey; size?: "sm" | "md" }) {
  const t = useTranslations("promo");
  const s = BADGE_STYLE[badge];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-lg font-bold", size === "md" ? "px-2.5 py-1 text-[12px]" : "px-2 py-0.5 text-[10.5px]", s.cls)}>
      <Icon className={size === "md" ? "size-3.5" : "size-3"} strokeWidth={2.5} aria-hidden />
      {t(`badges.${badge}`)}
    </span>
  );
}

/** Stack of promotion + badges for product cards (max `limit` badges after the promotion). */
export function CardBadges({ promo, badges, limit = 2 }: { promo: ActivePromo | null; badges: string[]; limit?: number }) {
  const list = validBadges(badges).slice(0, limit);
  if (!promo && !list.length) return null;
  return (
    <>
      {promo && <PromoPill promo={promo} />}
      {list.map((b) => (
        <BadgePill key={b} badge={b} />
      ))}
    </>
  );
}

/** Badges row + promotion countdown for the product page. */
export function ProductPageBadges({ promo, badges }: { promo: ActivePromo | null; badges: string[] }) {
  const t = useTranslations("promo");
  const list = validBadges(badges);
  if (!promo && !list.length) return null;
  const left = promo ? daysLeft(promo.ends_at) : null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5">
      {promo && <PromoPill promo={promo} size="md" />}
      {list.map((b) => (
        <BadgePill key={b} badge={b} size="md" />
      ))}
      {promo && left != null && (
        <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-[12px] font-bold text-rose-700 ring-1 ring-inset ring-rose-200">
          <Clock className="size-3.5" aria-hidden />
          {left <= 1 ? t("endsToday") : t("endsIn", { days: left })}
        </span>
      )}
    </div>
  );
}

