"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Fuel } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ProductImage } from "@/components/ui/ProductImage";
import { TWO_STROKE_RATIOS, twoStrokeOilMl } from "@/lib/calculators";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "../AnimatedNumber";
import { RangeField } from "../RangeField";
import { BigValue, CalcCard, ResultLabel } from "./CalcCard";

type LinkProduct = { slug: string; name: string; image: string | null };

const MAX_FUEL = 25;

export function TwoStrokeCalculator({ products }: { products: LinkProduct[] }) {
  const t = useTranslations("calc");
  const locale = useLocale();
  const reduce = useReducedMotion();
  const gid = useId().replace(/:/g, "");
  const [fuel, setFuel] = useState(5);
  const [ratio, setRatio] = useState<number>(50);
  const [custom, setCustom] = useState(false);
  const ml = twoStrokeOilMl(fuel, ratio);
  const nf = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);

  // canister visual (SVG units): inner body from y=40 to y=200 (160 high)
  const level = Math.min(1, fuel / MAX_FUEL);
  const fuelH = 150 * level;
  const oilH = Math.max(level > 0 ? 3 : 0, Math.min(40, (ml / 1000 / MAX_FUEL) * 150 * 4));
  const transition = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 90, damping: 18 };

  return (
    <CalcCard
      id="2t"
      index={3}
      icon={Fuel}
      title={t("twoT.title")}
      text={t("twoT.text")}
      inputs={
        <>
          <RangeField label={t("twoT.fuel")} value={fuel} onChange={setFuel} min={0.5} max={MAX_FUEL} step={0.5} hardMax={1000} suffix="L" />
          <fieldset>
            <legend className="label">{t("twoT.ratio")}</legend>
            <div className="flex flex-wrap gap-2">
              {TWO_STROKE_RATIOS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={!custom && ratio === r}
                  onClick={() => {
                    setCustom(false);
                    setRatio(r);
                  }}
                  className={cn(
                    "h-11 rounded-xl border px-4 text-sm font-extrabold tabular-nums transition",
                    !custom && ratio === r ? "border-navy-700 bg-navy-700 text-white shadow-card" : "border-line bg-white text-navy-700 hover:border-navy-300",
                  )}
                >
                  1:{r}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={custom}
                onClick={() => setCustom(true)}
                className={cn(
                  "h-11 rounded-xl border px-4 text-sm font-bold transition",
                  custom ? "border-navy-700 bg-navy-700 text-white shadow-card" : "border-line bg-white text-navy-700 hover:border-navy-300",
                )}
              >
                {t("twoT.custom")}
              </button>
            </div>
            {custom && (
              <motion.label initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink/80">
                {t("twoT.customLabel")}
                <input
                  type="number"
                  inputMode="numeric"
                  min={10}
                  max={200}
                  value={ratio}
                  onChange={(e) => {
                    const n = Math.round(Number(e.target.value));
                    if (n > 0) setRatio(Math.min(200, n));
                  }}
                  className="input h-10 w-24 text-center font-bold"
                  autoFocus
                />
              </motion.label>
            )}
          </fieldset>
          <p className="rounded-xl bg-brand-50 px-4 py-3 text-[13px] leading-5 text-ink/80 ring-1 ring-brand-200">{t("twoT.hint")}</p>
        </>
      }
      result={
        <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
          <div>
            <ResultLabel>{t("twoT.oil")}</ResultLabel>
            <BigValue>
              <AnimatedNumber value={ml} format={(n) => t("ml", { amount: Math.round(n) })} />
            </BigValue>
            <p className="mt-2 text-sm font-semibold text-white/70">
              {t("twoT.mix", { ratio })} · {t("liters", { amount: nf(fuel) })}
            </p>
            {products.length > 0 && (
              <div className="mt-7">
                <ResultLabel>{t("twoT.products")}</ResultLabel>
                <ul className="mt-3 grid gap-2">
                  {products.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={{ pathname: "/product/[slug]", params: { slug: p.slug } }}
                        className="group flex items-center gap-3 rounded-xl bg-white/[0.07] p-2 pr-3 ring-1 ring-white/10 transition hover:bg-white/[0.12]"
                      >
                        <ProductImage src={p.image} alt="" sizes="40px" className="size-10 shrink-0 rounded-lg" imgClassName="p-0.5" />
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold">{p.name}</span>
                        <ArrowRight className="size-4 shrink-0 text-brand-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <svg viewBox="0 0 160 220" className="mx-auto h-56 w-auto sm:h-64" role="img" aria-label={t("twoT.canister", { fuel: nf(fuel), oil: ml })}>
            <defs>
              <clipPath id={`can-${gid}`}>
                <path d="M22 44 Q22 36 30 36 L130 36 Q138 36 138 44 L138 200 Q138 208 130 208 L30 208 Q22 208 22 200 Z" />
              </clipPath>
              <linearGradient id={`fuel-${gid}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#ffd44f" stopOpacity="0.9" />
                <stop offset="1" stopColor="#f0ae00" stopOpacity="0.95" />
              </linearGradient>
            </defs>
            {/* handle + spout */}
            <path d="M44 36 L44 16 Q44 10 50 10 L96 10 Q102 10 102 16 L102 36" fill="none" stroke="rgb(255 255 255 / 0.35)" strokeWidth="8" strokeLinejoin="round" />
            <rect x="112" y="18" width="18" height="18" rx="3" fill="rgb(255 255 255 / 0.35)" />
            <g clipPath={`url(#can-${gid})`}>
              <rect x="0" y="0" width="160" height="220" fill="rgb(255 255 255 / 0.06)" />
              <motion.rect
                x="0"
                width="160"
                fill={`url(#fuel-${gid})`}
                initial={false}
                animate={{ y: 208 - fuelH, height: fuelH }}
                transition={transition}
              />
              <motion.rect
                x="0"
                width="160"
                fill="#1e2d51"
                opacity={0.85}
                initial={false}
                animate={{ y: 208 - fuelH - oilH, height: oilH }}
                transition={transition}
              />
              {/* level ticks */}
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1="122" x2="138" y1={208 - 150 * f} y2={208 - 150 * f} stroke="rgb(255 255 255 / 0.35)" strokeWidth="1.5" />
              ))}
            </g>
            <path
              d="M22 44 Q22 36 30 36 L130 36 Q138 36 138 44 L138 200 Q138 208 130 208 L30 208 Q22 208 22 200 Z"
              fill="none"
              stroke="rgb(255 255 255 / 0.55)"
              strokeWidth="3"
            />
            <path d="M40 60 L40 186" stroke="rgb(255 255 255 / 0.18)" strokeWidth="6" strokeLinecap="round" />
          </svg>
        </div>
      }
    />
  );
}
