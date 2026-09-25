"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion } from "motion/react";
import { ArrowRight, Snowflake, ThermometerSnowflake } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";
import { WASHER_TABLE, washerMix } from "@/lib/calculators";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "../AnimatedNumber";
import { RangeField } from "../RangeField";
import { BigValue, CalcCard, ResultLabel } from "./CalcCard";

export function WasherCalculator({ productSlug }: { productSlug: string | null }) {
  const t = useTranslations("calc");
  const locale = useLocale();
  const [target, setTarget] = useState(-20);
  const [total, setTotal] = useState(5);
  const mix = washerMix(target, total);
  const nf = (n: number, d = 2) => new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(n);
  const pct = mix.fraction * 100;

  return (
    <CalcCard
      id="washer"
      index={4}
      icon={Snowflake}
      title={t("washer.title")}
      text={t("washer.text")}
      inputs={
        <>
          <RangeField label={t("washer.target")} value={target} onChange={(n) => setTarget(Math.round(n))} min={-40} max={-5} step={1} suffix="°C" />
          <RangeField label={t("washer.total")} value={total} onChange={setTotal} min={1} max={50} step={0.5} hardMax={1000} suffix="L" />
          <div>
            <p className="label">{t("approx")}</p>
            <ul className="flex flex-wrap gap-1.5">
              {WASHER_TABLE.filter(([f]) => f > 0).map(([f, c]) => (
                <li key={f} className="rounded-md bg-navy-50 px-2 py-1 text-[12px] font-semibold tabular-nums text-navy-600">
                  {Math.round(f * 100)}% → {c} °C
                </li>
              ))}
            </ul>
          </div>
        </>
      }
      result={
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <ResultLabel>{t("washer.ratio")}</ResultLabel>
              <BigValue>
                <AnimatedNumber value={mix.waterParts} format={(n) => t("washer.ratioValue", { parts: nf(n, 1) })} />
              </BigValue>
              <p className="mt-2 text-[12.5px] text-white/60">{t("washer.ratioHint")}</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-extrabold tabular-nums text-sky-200 ring-1 ring-white/15">
              <ThermometerSnowflake className="size-4" aria-hidden />
              {target} °C
            </span>
          </div>

          <div className="mt-7 flex h-14 overflow-hidden rounded-2xl ring-1 ring-white/15">
            <motion.div
              className="flex items-center justify-center bg-gradient-to-br from-sky-400 to-blue-600 text-[12px] font-extrabold"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 110, damping: 20 }}
            >
              {pct > 14 && `${Math.round(pct)}%`}
            </motion.div>
            <div className="flex flex-1 items-center justify-center bg-white/[0.08] text-[12px] font-bold text-white/70">
              {100 - pct > 14 && `${Math.round(100 - pct)}%`}
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3">
            {[
              { k: "concentrate", v: mix.concentrate, dot: "bg-sky-400" },
              { k: "water", v: mix.water, dot: "bg-white/40" },
            ].map((row) => (
              <div key={row.k} className="rounded-xl bg-white/[0.07] p-4 ring-1 ring-white/10">
                <dt className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-white/60">
                  <span className={cn("size-2.5 rounded-full", row.dot)} aria-hidden />
                  {t(`washer.${row.k}`)}
                </dt>
                <dd className="mt-1 text-2xl font-extrabold tabular-nums">
                  <AnimatedNumber value={row.v} format={(n) => t("liters", { amount: nf(n) })} />
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-5 text-[12px] leading-5 text-white/55">{t("washer.hint")}</p>
          {productSlug && (
            <Link href={{ pathname: "/product/[slug]", params: { slug: productSlug } }} className={buttonClass("light", "md", "mt-6 w-full")}>
              {t("washer.product")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      }
    />
  );
}
