"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowRight, ArrowUp, BadgePercent, Building2, Check, Info, ShieldCheck, ShoppingBag, Store, Truck } from "lucide-react";
import type { ProductSummary } from "@/lib/catalog";
import { displayPrice, packLabel, pricePerUnit, regularPrice, round2 } from "@/lib/commerce";
import { FREIGHT_ITEM_SIZE } from "@/lib/shop/shipping";
import { Link } from "@/i18n/navigation";
import { usePricing } from "@/components/providers/PriceProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { QtyStepper } from "@/components/ui/QtyStepper";
import { RollingNumber } from "@/components/ui/RollingNumber";
import { useMoney } from "@/components/ui/useMoney";
import { defaultVariant, useAddToCart } from "@/components/catalog/useAddToCart";
import { cn } from "@/lib/utils";
import { ProductGallery, type GalleryImage } from "./ProductGallery";

type V = ProductSummary["variants"][number];

export function ProductPurchase({
  product,
  images,
  header,
  badge,
}: {
  product: ProductSummary;
  images: GalleryImage[];
  header: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const t = useTranslations("product");
  const tp = useTranslations("promo");
  const ta = useTranslations("actions");
  const tu = useTranslations("units");
  const pricing = usePricing();
  const settings = useSettings();
  const money = useMoney();
  const addToCart = useAddToCart();

  const variants = useMemo(
    () => [...product.variants].sort((a, b) => Number(a.size ?? 0) - Number(b.size ?? 0)),
    [product.variants],
  );
  const [key, setKey] = useState(() => defaultVariant(product)?.key ?? variants[0]?.key);
  const [qty, setQty] = useState(1);
  const [imgIndex, setImgIndex] = useState(() => {
    const v = defaultVariant(product);
    const i = v?.image ? images.findIndex((im) => im.src === v.image) : -1;
    return Math.max(0, i);
  });
  const [justAdded, setJustAdded] = useState(false);
  const selected: V | undefined = variants.find((v) => v.key === key) ?? variants[0];

  const unitLabel = (v: V) => (v.unit === "kg" ? tu("kg") : tu("l"));
  const perUnit = variants.map((v) => pricePerUnit(v, pricing));
  const smallestPpu = perUnit.find((x) => x != null) ?? null;
  const bestIdx = perUnit.reduce<number>((best, x, i) => (x != null && (best < 0 || x < (perUnit[best] ?? Infinity)) ? i : best), -1);
  const savings = (i: number) => {
    const x = perUnit[i];
    if (x == null || smallestPpu == null || smallestPpu <= 0) return 0;
    return Math.round((1 - x / smallestPpu) * 100);
  };

  const selectVariant = (v: V) => {
    setKey(v.key);
    if (v.image) {
      const i = images.findIndex((im) => im.src === v.image);
      if (i >= 0) setImgIndex(i);
    }
  };

  const price = selected ? displayPrice(selected, pricing) : 0;
  const was = selected ? regularPrice(selected, pricing) : null;
  // Remember the previous price to show a short ▲/▼ difference chip when the pack changes.
  const [delta, setDelta] = useState<{ key: string; prev: number; diff: number } | null>(null);
  const [lastPrice, setLastPrice] = useState(price);
  if (lastPrice !== price) {
    setLastPrice(price);
    setDelta({ key: `${key}-${price}`, prev: lastPrice, diff: round2(price - lastPrice) });
  }
  useEffect(() => {
    if (!delta) return;
    const id = window.setTimeout(() => setDelta(null), 1600);
    return () => window.clearTimeout(id);
  }, [delta]);
  const ppu = selected ? pricePerUnit(selected, pricing) : null;
  const vatRate = settings.vat?.[pricing.market] ?? 21;
  const threshold = settings.shipping.free_threshold?.[pricing.market];
  const isFreight = selected ? selected.unit !== "pcs" && Number(selected.size ?? 0) > FREIGHT_ITEM_SIZE : false;
  const packText = selected ? packLabel(selected) || tu("piece") : "";

  const add = () => {
    if (!selected) return;
    addToCart(product, selected, qty, { silent: true });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  };

  // Sticky mobile bar appears once the main button scrolls out of view.
  const ctaRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-6 xl:col-span-7">
        <ProductGallery images={images} index={imgIndex} onIndex={setImgIndex} badge={badge} />
      </div>

      <div className="lg:col-span-6 xl:col-span-5">
        {header}

        <div className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
          {/* price */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              {was != null && (
                <p className="mb-1.5 flex flex-wrap items-center gap-2 text-[14px] font-semibold tabular-nums text-muted">
                  <span className="sr-only">{tp("was")} </span>
                  <s className="decoration-rose-500/70 decoration-2">{money(was)}</s>
                  <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[12px] font-extrabold text-rose-700 ring-1 ring-inset ring-rose-200">
                    {tp("save", { amount: money(round2(was - price)) })}
                  </span>
                </p>
              )}
              <div className="flex items-center gap-2.5">
                <p className={cn("text-[34px] font-extrabold leading-none tracking-tight tabular-nums", was != null ? "text-rose-600" : "text-navy-700")}>
                  <RollingNumber value={price} format={money} stagger={0.04} />
                </p>
                <AnimatePresence mode="popLayout">
                  {delta && delta.diff !== 0 && (
                    <motion.span
                      key={delta.key}
                      initial={{ opacity: 0, y: delta.diff > 0 ? 10 : -10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: delta.diff > 0 ? -8 : 8 }}
                      transition={{ type: "spring", stiffness: 420, damping: 30 }}
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums ring-1",
                        delta.diff > 0 ? "bg-navy-50 text-navy-600 ring-navy-100" : "bg-emerald-50 text-emerald-700 ring-emerald-200",
                      )}
                      aria-hidden
                    >
                      {delta.diff > 0 ? <ArrowUp className="size-3.5" strokeWidth={2.75} /> : <ArrowDown className="size-3.5" strokeWidth={2.75} />}
                      {money(Math.abs(delta.diff))}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <p className="mt-1.5 text-[12.5px] text-muted">
                {pricing.b2b
                  ? pricing.discountPercent > 0
                    ? t("priceB2bDiscount", { percent: pricing.discountPercent })
                    : t("priceB2b")
                  : t("priceVat", { rate: vatRate })}
                {ppu != null && selected && (
                  <>
                    {" · "}
                    <span className="inline-flex items-baseline font-semibold text-ink/70">
                      <RollingNumber value={ppu} format={money} stagger={0.025} />/{unitLabel(selected)}
                    </span>
                  </>
                )}
              </p>
            </div>
            {selected && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold",
                  selected.in_stock ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                )}
              >
                <span className={cn("size-2 rounded-full", selected.in_stock ? "bg-emerald-500" : "bg-amber-500")} aria-hidden />
                {selected.in_stock ? ta("inStock") : ta("outOfStock")}
              </span>
            )}
          </div>

          {/* packs */}
          {variants.length > 0 && (
            <fieldset className="mt-5">
              <legend className="mb-2.5 text-[13px] font-bold text-ink/80">{t("choosePack")}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {variants.map((v, i) => {
                  const active = v.key === selected?.key;
                  const save = savings(i);
                  const best = i === bestIdx && save >= 3;
                  return (
                    <label
                      key={v.key}
                      className={cn(
                        "relative flex cursor-pointer flex-col rounded-2xl border-2 px-3 pb-2.5 pt-3 transition",
                        active
                          ? "border-navy-700 bg-navy-50/60 shadow-[0_8px_20px_-12px_rgb(30_45_81/0.5)]"
                          : "border-line bg-surface hover:border-navy-200",
                      )}
                    >
                      <input
                        type="radio"
                        name="pack"
                        value={v.key}
                        checked={active}
                        onChange={() => selectVariant(v)}
                        className="sr-only"
                      />
                      {best && (
                        <span className="absolute -top-2.5 right-2 inline-flex -skew-x-12 items-center rounded-md bg-brand-400 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-navy-900 shadow-sm">
                          <span className="skew-x-12">{t("bestValue")}</span>
                        </span>
                      )}
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[16px] font-extrabold tabular-nums text-ink">{packLabel(v) || tu("piece")}</span>
                        {active && <Check className="size-4 text-navy-700" strokeWidth={3} aria-hidden />}
                      </span>
                      <span className="mt-0.5 text-[13px] font-bold tabular-nums text-navy-700">
                        {regularPrice(v, pricing) != null && <s className="mr-1 text-[11px] font-semibold text-muted">{money(regularPrice(v, pricing)!)}</s>}
                        <span className={cn(regularPrice(v, pricing) != null && "text-rose-600")}>{money(displayPrice(v, pricing))}</span>
                      </span>
                      {perUnit[i] != null && (
                        <span className="text-[11px] tabular-nums text-muted">
                          {money(perUnit[i]!)}/{unitLabel(v)}
                          {save >= 3 && <span className="ml-1 font-bold text-emerald-600">−{save}%</span>}
                        </span>
                      )}
                      {!v.in_stock && <span className="mt-1 text-[10.5px] font-semibold text-amber-700">{ta("outOfStock")}</span>}
                    </label>
                  );
                })}
              </div>
              {bestIdx >= 0 && savings(bestIdx) >= 3 && (
                <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-700">
                  <BadgePercent className="size-4" aria-hidden />
                  {t("savingsHint", { percent: savings(bestIdx) })}
                </p>
              )}
            </fieldset>
          )}

          {isFreight && (
            <p className="mt-4 flex gap-2 rounded-xl bg-brand-50 p-3 text-[12.5px] leading-relaxed text-brand-700 ring-1 ring-brand-200">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("freightNote")}
            </p>
          )}

          {/* qty + add */}
          <div ref={ctaRef} className="mt-5 flex gap-2.5">
            <QtyStepper value={qty} onChange={setQty} size="lg" />
            <button
              type="button"
              onClick={add}
              disabled={!selected}
              className={cn(
                "group/btn relative inline-flex h-14 flex-1 items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-5 text-[15px] font-extrabold transition active:scale-[0.98]",
                justAdded
                  ? "bg-emerald-500 text-white"
                  : "bg-brand-400 text-navy-900 shadow-[0_10px_30px_-10px_rgb(255_193_14/0.9)] hover:bg-brand-300",
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                {justAdded ? (
                  <motion.span key="ok" className="flex items-center gap-2" initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }}>
                    <Check className="size-5" strokeWidth={3} aria-hidden />
                    {ta("added")}
                  </motion.span>
                ) : (
                  <motion.span key="add" className="flex items-center gap-2" initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }}>
                    <ShoppingBag className="size-5" aria-hidden />
                    {ta("addToCart")}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
          {qty > 1 && (
            <p className="mt-2 text-right text-[13px] font-semibold tabular-nums text-muted">
              {t("lineTotal", { amount: money(round2(price * qty)) })}
            </p>
          )}

          {/* trust */}
          <ul className="mt-5 grid gap-2.5 border-t border-line pt-5 text-[13px] text-ink/75">
            <li className="flex items-start gap-2.5">
              <Truck className="mt-0.5 size-4 shrink-0 text-navy-500" aria-hidden />
              {t("deliveryInfo", { amount: threshold != null ? money(threshold) : "—" })}
            </li>
            <li className="flex items-start gap-2.5">
              <Store className="mt-0.5 size-4 shrink-0 text-navy-500" aria-hidden />
              {t("pickupInfo")}
            </li>
            <li className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-navy-500" aria-hidden />
              {t("originalInfo")}
            </li>
          </ul>
        </div>

        {!pricing.b2b && (
          <Link
            href="/business"
            className="group mt-3 flex items-center gap-3 rounded-2xl bg-navy-700 px-4 py-3.5 text-white transition hover:bg-navy-600"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-brand-400">
              <Building2 className="size-[18px]" aria-hidden />
            </span>
            <span className="flex-1 text-[13px] font-semibold text-white/85">{t("b2bHint")}</span>
            <span className="inline-flex items-center gap-1 text-[13px] font-extrabold text-brand-300">
              {t("b2bLink")}
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        )}
      </div>

      {/* sticky mobile add-to-cart */}
      <AnimatePresence>
        {showSticky && selected && (
          <motion.div
            className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_30px_-12px_rgb(16_24_40/0.25)] backdrop-blur lg:hidden"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-ink">{product.name}</p>
                <p className="text-[12px] text-muted">
                  {packText} · <span className="font-extrabold text-navy-700">{money(price)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={add}
                className={cn(
                  "inline-flex h-12 shrink-0 items-center gap-2 rounded-xl px-5 text-[14px] font-extrabold transition active:scale-95",
                  justAdded ? "bg-emerald-500 text-white" : "bg-brand-400 text-navy-900",
                )}
              >
                {justAdded ? <Check className="size-5" strokeWidth={3} aria-hidden /> : <ShoppingBag className="size-5" aria-hidden />}
                {t("stickyAdd")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
