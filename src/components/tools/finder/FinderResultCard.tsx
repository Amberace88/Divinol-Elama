"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { ArrowRight, BadgeCheck, CircleCheck, ShoppingCart, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { ProductImage } from "@/components/ui/ProductImage";
import { useCart } from "@/components/providers/CartProvider";
import { packLabel } from "@/lib/commerce";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/lib/catalog";
import type { FinderResult, MatchReason } from "@/lib/finder";
import { AnimatedNumber } from "../AnimatedNumber";
import { toCartItem, usePrice } from "../usePrice";

const MAX_CHIPS = 8;

function reasonText(t: ReturnType<typeof useTranslations>, r: MatchReason) {
  const list = (items: string[]) => items.slice(0, 3).join(", ");
  switch (r.kind) {
    case "oem":
    case "soft":
      return t(`reason.${r.kind}`, { brand: r.brand, items: list(r.items) });
    case "lowSaps":
    case "acea":
    case "heavyDuty":
    case "cng":
    case "jaso":
    case "twoStroke":
      return t(`reason.${r.kind}`, { items: list(r.items) });
    case "viscosity":
    case "lawnmower":
      return t(`reason.${r.kind}`, { sae: r.sae });
    case "chainOil":
      return t(r.bio ? "reason.chainOilBio" : "reason.chainOil");
    case "hydraulic":
      return r.items.length
        ? t("reason.hydraulicSpecs", { iso: r.iso, items: list(r.items) })
        : t("reason.hydraulic", { iso: r.iso });
    case "gear":
    case "compressor":
      return t(`reason.${r.kind}`, { iso: r.iso });
  }
}

export function FinderResultCard({
  result,
  index,
  preferredSize,
}: {
  result: FinderResult<ProductSummary>;
  index: number;
  preferredSize?: number;
}) {
  const t = useTranslations("finder");
  const ta = useTranslations("actions");
  const { price, money, vatLabel } = usePrice();
  const { add } = useCart();
  const p = result.product;
  const variants = p.variants.filter((v) => v.price_net > 0);
  const initial =
    variants.find((v) => preferredSize != null && v.size === preferredSize) ??
    variants.find((v) => v.in_stock) ??
    variants[0];
  const [key, setKey] = useState(initial?.key);
  const v = variants.find((x) => x.key === key) ?? initial;

  const highlights = new Set(result.highlights);
  const chips = [...p.approvals, ...p.specs];
  const ordered = [...chips.filter((c) => highlights.has(c)), ...chips.filter((c) => !highlights.has(c))];
  const shown = ordered.slice(0, MAX_CHIPS);
  const reasons = result.reasons.slice(0, 3);
  const grade = p.sae ?? p.iso_vg;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-card transition-shadow duration-300 hover:shadow-lift",
        index === 0 ? "border-brand-400 ring-4 ring-brand-400/15" : "border-line",
      )}
    >
      <div className="relative">
        <Link href={{ pathname: "/product/[slug]", params: { slug: p.slug } }} tabIndex={-1} aria-hidden>
          <ProductImage
            src={v?.image ?? p.image}
            alt={p.name}
            sizes="(min-width:1280px) 360px, (min-width:768px) 45vw, 90vw"
            className="h-52 border-b border-line"
            imgClassName="p-5 transition-transform duration-500 group-hover:scale-[1.04]"
          />
        </Link>
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {index === 0 && (
            <span className="skew-tag bg-brand-400 text-[11px] font-extrabold uppercase tracking-wide text-navy-900 shadow-glow">
              <span className="flex items-center gap-1">
                <Sparkles className="size-3.5" aria-hidden />
                {t("bestMatch")}
              </span>
            </span>
          )}
          {result.oemMatch && (
            <span className="skew-tag bg-navy-700 text-[11px] font-bold text-white">
              <span className="flex items-center gap-1">
                <BadgeCheck className="size-3.5" aria-hidden />
                {t("oemBadge")}
              </span>
            </span>
          )}
        </div>
        {grade && (
          <span className="absolute top-3 right-3 rounded-lg bg-white/95 px-2.5 py-1 text-[13px] font-extrabold text-navy-700 shadow-card ring-1 ring-line">
            {grade}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{p.type}</p>
        <h3 className="mt-1 text-lg font-extrabold leading-snug text-navy-700">
          <Link href={{ pathname: "/product/[slug]", params: { slug: p.slug } }} className="hover:text-navy-500">
            {p.name}
          </Link>
        </h3>

        {reasons.length > 0 && (
          <div className="mt-4 rounded-xl bg-canvas p-3.5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-navy-400">{t("why")}</p>
            <ul className="mt-2 grid gap-2">
              {reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-5 text-ink/85">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  <span>{reasonText(t, r)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {shown.length > 0 && (
          <div className="mt-4">
            <p className="sr-only">{t("approvals")}</p>
            <ul className="flex flex-wrap gap-1.5">
              {shown.map((c) => (
                <li
                  key={c}
                  className={cn(
                    "max-w-full truncate rounded-md px-2 py-1 text-[11.5px] font-semibold",
                    highlights.has(c) ? "bg-brand-100 text-navy-800 ring-1 ring-brand-400" : "bg-navy-50 text-navy-600",
                  )}
                  title={c}
                >
                  {c}
                </li>
              ))}
              {ordered.length > MAX_CHIPS && (
                <li className="rounded-md px-2 py-1 text-[11.5px] font-semibold text-muted">
                  {t("moreApprovals", { count: ordered.length - MAX_CHIPS })}
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="mt-auto pt-5">
          {variants.length > 1 && (
            <div role="radiogroup" aria-label={t("pack")} className="mb-3 flex flex-wrap gap-1.5">
              {variants.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  role="radio"
                  aria-checked={x.key === v?.key}
                  onClick={() => setKey(x.key)}
                  className={cn(
                    "h-8 rounded-lg border px-2.5 text-[12.5px] font-bold transition",
                    x.key === v?.key ? "border-navy-700 bg-navy-700 text-white" : "border-line bg-white text-navy-700 hover:border-navy-300",
                  )}
                >
                  {packLabel(x) || "1"}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end justify-between gap-3 border-t border-line pt-4">
            <div>
              {v && (
                <>
                  <p className="text-2xl font-extrabold tracking-tight text-navy-700">
                    <AnimatedNumber value={price(v)} format={money} />
                  </p>
                  <p className="text-[11.5px] font-medium text-muted">
                    {packLabel(v)} · {vatLabel}
                    {!v.in_stock && <span className="text-brand-700"> · {ta("outOfStock")}</span>}
                  </p>
                </>
              )}
            </div>
            <Button
              size="sm"
              disabled={!v}
              onClick={() => {
                if (!v) return;
                add(toCartItem(p, v));
              }}
              aria-label={`${ta("addToCart")}: ${p.name}`}
            >
              <ShoppingCart className="size-4" aria-hidden />
              <span className="hidden sm:inline">{ta("addToCart")}</span>
            </Button>
          </div>
          <Link
            href={{ pathname: "/product/[slug]", params: { slug: p.slug } }}
            className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-navy-600 hover:text-navy-800"
          >
            {t("details")}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
