"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion } from "motion/react";
import { ArrowRight, TrendingDown, Truck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";
import { fleetConsumption, packsFor } from "@/lib/calculators";
import type { ProductSummary } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "../AnimatedNumber";
import { RangeField } from "../RangeField";
import { litrePacks, usePrice } from "../usePrice";
import { BigValue, CalcCard, ResultLabel } from "./CalcCard";
import { ProductPicker } from "./ProductPicker";

export function FleetCalculator({ products, defaultSlug }: { products: ProductSummary[]; defaultSlug: string }) {
  const t = useTranslations("calc");
  const locale = useLocale();
  const { price, money, vatLabel } = usePrice();
  const [slug, setSlug] = useState(defaultSlug);
  const [vehicles, setVehicles] = useState(10);
  const [km, setKm] = useState(100000);
  const [intervalKm, setIntervalKm] = useState(60000);
  const [capacity, setCapacity] = useState(35);
  const [topup, setTopup] = useState(0.5);

  const product = products.find((p) => p.slug === slug) ?? products[0];
  const res = useMemo(
    () => fleetConsumption({ vehicles, kmPerYear: km, intervalKm, capacityL: capacity, topupPer10k: topup }),
    [vehicles, km, intervalKm, capacity, topup],
  );

  const packs = product ? litrePacks(product).filter((v) => v.price_net > 0) : [];
  const can = packs.find((v) => v.size === 20);
  const drum = packs.find((v) => v.size === 200);
  const cans = can ? packsFor(res.litresTotal, { size: 20, price: price(can) }) : null;
  const drums = drum ? packsFor(res.litresTotal, { size: 200, price: price(drum) }) : null;
  const savings = cans && drums ? Math.round((cans.total - drums.total) * 100) / 100 : null;
  const maxCost = Math.max(cans?.total ?? 0, drums?.total ?? 0, 1);
  const nf = (n: number, d = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(n);

  const rows = [
    { key: "20", label: t("fleet.cost20"), pack: "20 L", data: cans },
    { key: "200", label: t("fleet.cost200"), pack: "200 L", data: drums },
  ];

  return (
    <CalcCard
      id="fleet"
      index={2}
      icon={Truck}
      title={t("fleet.title")}
      text={t("fleet.text")}
      inputs={
        <>
          <ProductPicker
            label={t("fleet.product")}
            items={products}
            value={product?.slug ?? ""}
            onChange={setSlug}
            searchPlaceholder={t("oil.search")}
            emptyText={t("oil.noProducts")}
          />
          <div className="grid gap-7 sm:grid-cols-2">
            <RangeField label={t("fleet.vehicles")} value={vehicles} onChange={(n) => setVehicles(Math.round(n))} min={1} max={100} hardMax={2000} />
            <RangeField label={t("fleet.km")} value={km} onChange={setKm} min={5000} max={250000} step={5000} hardMax={1000000} format={(n) => String(Math.round(n))} />
            <RangeField label={t("fleet.interval")} value={intervalKm} onChange={setIntervalKm} min={5000} max={150000} step={5000} hardMax={300000} format={(n) => String(Math.round(n))} />
            <RangeField label={t("fleet.capacity")} value={capacity} onChange={setCapacity} min={4} max={60} step={1} hardMax={300} suffix="L" />
          </div>
          <RangeField label={t("fleet.topup")} value={topup} onChange={setTopup} min={0} max={5} step={0.1} hardMax={20} suffix="L" />
        </>
      }
      result={
        <div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <ResultLabel>{t("fleet.liters")}</ResultLabel>
              <BigValue>
                <AnimatedNumber value={res.litresTotal} format={(n) => `${nf(n)} L`} />
              </BigValue>
            </div>
            <div>
              <ResultLabel>{t("fleet.changes")}</ResultLabel>
              <p className="h-display mt-1 text-4xl leading-none sm:text-5xl">
                <AnimatedNumber value={res.changesTotal} format={(n) => nf(n, 1)} />
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4">
            {rows.map((r) => (
              <div key={r.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-bold text-white/80">{r.label}</p>
                  {r.data ? (
                    <p className="text-lg font-extrabold tabular-nums">
                      <AnimatedNumber value={r.data.total} format={money} />
                    </p>
                  ) : null}
                </div>
                {r.data ? (
                  <>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className={cn("h-full rounded-full", r.key === "200" ? "bg-brand-400" : "bg-navy-300")}
                        initial={false}
                        animate={{ width: `${(r.data.total / maxCost) * 100}%` }}
                        transition={{ type: "spring", stiffness: 110, damping: 20 }}
                      />
                    </div>
                    <p className="mt-1.5 text-[12px] text-white/55">
                      {t("fleet.packs", { count: r.data.qty, pack: r.pack })} · {t("fleet.perLitre", { price: money(r.data.perLitre) })}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 rounded-lg bg-white/[0.06] px-3 py-2 text-[12.5px] text-white/65">{t("fleet.missing", { pack: r.pack })}</p>
                )}
              </div>
            ))}
          </div>

          {savings != null && (
            <div className="mt-7 flex items-center gap-4 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-400 text-navy-900">
                <TrendingDown className="size-5" aria-hidden />
              </span>
              {savings > 0 ? (
                <div>
                  <ResultLabel>{t("fleet.savings")}</ResultLabel>
                  <p className="mt-0.5 text-2xl font-extrabold text-brand-400">
                    <AnimatedNumber value={savings} format={money} />
                  </p>
                </div>
              ) : (
                <p className="text-[13.5px] font-semibold text-white/80">{t("fleet.noSavings")}</p>
              )}
            </div>
          )}
          <p className="mt-3 text-[12px] text-white/50">
            {vatLabel} · {t("fleet.b2bNote")}
          </p>
          <Link href="/business" className={buttonClass("primary", "lg", "mt-6 w-full")}>
            {t("fleet.cta")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      }
    />
  );
}
