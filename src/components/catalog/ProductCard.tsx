"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Check, Plus } from "lucide-react";
import type { ProductSummary } from "@/lib/catalog";
import { packLabel } from "@/lib/commerce";
import { Link } from "@/i18n/navigation";
import { usePricing } from "@/components/providers/PriceProvider";
import { ProductImage } from "@/components/ui/ProductImage";
import { useMoney } from "@/components/ui/useMoney";
import { cn } from "@/lib/utils";
import { minPerUnit, minPrice } from "./filters";
import { defaultVariant, useAddToCart } from "./useAddToCart";

export function ProductCard({
  product: p,
  priority,
  className,
}: {
  product: ProductSummary;
  priority?: boolean;
  className?: string;
}) {
  const t = useTranslations("catalog");
  const ta = useTranslations("actions");
  const tu = useTranslations("units");
  const tp = useTranslations("price");
  const pricing = usePricing();
  const money = useMoney();
  const addToCart = useAddToCart();
  const [added, setAdded] = useState(false);

  const from = minPrice(p, pricing);
  const ppu = minPerUnit(p, pricing);
  const quick = defaultVariant(p);
  const inStock = p.variants.some((v) => v.in_stock);
  const approvals = p.approvals.length ? p.approvals : p.specs;
  const shown = approvals.slice(0, 3);
  const packs = [...p.variants].sort((a, b) => Number(a.size ?? 0) - Number(b.size ?? 0));
  const multi = p.variants.length > 1;
  const quickLabel = quick ? packLabel(quick) || tu("piece") : "";

  const onQuickAdd = () => {
    if (!quick) return;
    addToCart(p, quick, 1, { silent: true });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition duration-300 hover:border-navy-200 hover:shadow-lift",
        className,
      )}
    >
      <div className="relative aspect-[5/4] overflow-hidden bg-[radial-gradient(120%_90%_at_50%_10%,#ffffff_45%,#eef2f9_100%)] dark:bg-(image:--night-well)">
        <ProductImage
          src={p.image}
          alt={p.name}
          sizes="(min-width:1280px) 300px, (min-width:768px) 33vw, 50vw"
          priority={priority}
          className="absolute inset-0 bg-transparent dark:bg-none"
          imgClassName="p-5 transition-transform duration-500 ease-out group-hover:scale-[1.06]"
        />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {(p.sae || p.iso_vg) && (
            <span className="skew-tag bg-navy-700 text-[11px] font-extrabold text-brand-300 shadow-sm">
              <span>{p.sae ?? p.iso_vg}</span>
            </span>
          )}
        </div>
        <span
          className={cn(
            "absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-surface/90 px-2 py-0.5 text-[10.5px] font-bold ring-1 backdrop-blur",
            inStock ? "text-emerald-700 ring-emerald-200" : "text-amber-700 ring-amber-200",
          )}
        >
          <span className={cn("size-1.5 rounded-full", inStock ? "bg-emerald-500" : "bg-amber-500")} aria-hidden />
          {inStock ? ta("inStock") : ta("outOfStock")}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {p.type && <p className="mb-1 line-clamp-1 text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted">{p.type}</p>}
        <h3 className="text-[15px] font-extrabold leading-snug tracking-[-0.01em] text-ink">
          <Link
            href={{ pathname: "/product/[slug]", params: { slug: p.slug } }}
            className="line-clamp-2 outline-none after:absolute after:inset-0 after:z-[1] after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-navy-400 group-hover:text-navy-600"
          >
            {p.name}
          </Link>
        </h3>

        {shown.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1">
            {shown.map((a) => (
              <li key={a} className="max-w-full truncate rounded-md bg-canvas px-1.5 py-0.5 text-[10.5px] font-semibold text-navy-600 ring-1 ring-inset ring-line">
                {a}
              </li>
            ))}
            {approvals.length > 3 && (
              <li className="rounded-md px-1 py-0.5 text-[10.5px] font-bold text-muted">
                {t("moreApprovals", { count: approvals.length - 3 })}
              </li>
            )}
          </ul>
        )}

        {multi && (
          <ul className="mt-3 flex flex-wrap gap-1" aria-label={t("packs", { count: packs.length })}>
            {packs.slice(0, 5).map((v) => (
              <li
                key={v.key}
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums",
                  v.in_stock ? "border-navy-100 text-navy-700" : "border-dashed border-line text-muted",
                )}
              >
                {packLabel(v) || tu("piece")}
              </li>
            ))}
            {packs.length > 5 && <li className="px-1 text-[10.5px] font-bold text-muted">+{packs.length - 5}</li>}
          </ul>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div className="min-w-0">
            {Number.isFinite(from) && (
              <p className="text-[19px] font-extrabold leading-none tracking-tight tabular-nums text-navy-700">
                {multi && <span className="mr-1 text-[12px] font-bold text-muted">{ta("from")}</span>}
                {money(from)}
              </p>
            )}
            {ppu && (
              <p className="mt-1 text-[11.5px] font-medium tabular-nums text-muted">
                {tp("from", { price: `${money(ppu.price)}/${ppu.unit === "kg" ? tu("kg") : tu("l")}` })}
              </p>
            )}
          </div>
          {quick && (
            <button
              type="button"
              onClick={onQuickAdd}
              aria-label={t("quickAdd", { pack: quickLabel })}
              title={t("quickAdd", { pack: quickLabel })}
              className={cn(
                "relative z-[2] grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl shadow-[0_8px_20px_-10px_rgb(255_193_14/0.9)] transition active:scale-95",
                added ? "bg-emerald-500 text-white" : "bg-brand-400 text-navy-900 hover:bg-brand-300",
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                {added ? (
                  <motion.span key="ok" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
                    <Check className="size-5" strokeWidth={3} aria-hidden />
                  </motion.span>
                ) : (
                  <motion.span key="add" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Plus className="size-5" strokeWidth={2.75} aria-hidden />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
