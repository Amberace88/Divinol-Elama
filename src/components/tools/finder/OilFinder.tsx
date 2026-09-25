"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Axe,
  BatteryCharging,
  Car,
  Check,
  Cog,
  Construction,
  Droplet,
  Droplets,
  Factory,
  Flame,
  Fuel,
  Gauge,
  Link2,
  Motorbike,
  Mountain,
  RotateCcw,
  Scissors,
  Sprout,
  TreePine,
  Truck,
  Van,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/lib/catalog";
import {
  FUELS,
  VEHICLE_TYPES,
  YEAR_BANDS,
  brandsFor,
  hasEngineStep,
  optionsFor,
  recommend,
  type Fuel as FuelType,
  type FinderInput,
  type VehicleType,
  type YearBand,
} from "@/lib/finder";
import { FinderResultCard } from "./FinderResultCard";
import { ExpertForm } from "./ExpertForm";

const VEHICLE_ICON: Record<VehicleType, LucideIcon> = {
  car: Car,
  van: Van,
  truck: Truck,
  moto: Motorbike,
  garden: TreePine,
  industry: Factory,
};

const APP_ICON: Record<string, LucideIcon> = {
  street: Motorbike,
  sport: Gauge,
  heavy: Flame,
  quad: Mountain,
  twoStroke: Fuel,
  chainsaw: Axe,
  trimmer: Scissors,
  mower: Sprout,
  chainOil: Droplets,
  hydraulic: Gauge,
  hydraulicHv: Construction,
  gear: Cog,
  compressor: Wind,
  chain: Link2,
};

const FUEL_ICON: Record<FuelType, LucideIcon> = { petrol: Fuel, diesel: Droplet, hybrid: BatteryCharging, lpg: Zap };

const PREFERRED_SIZE: Record<VehicleType, number> = { car: 5, van: 5, truck: 20, moto: 1, garden: 1, industry: 20 };

type Dpf = "yes" | "no" | "unknown";

export function OilFinder({ products }: { products: ProductSummary[] }) {
  const t = useTranslations("finder");
  const reduce = useReducedMotion();
  const topRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [vehicle, setVehicle] = useState<VehicleType | null>(null);
  const [option, setOption] = useState<string | null>(null);
  const [fuel, setFuel] = useState<FuelType>("petrol");
  const [year, setYear] = useState<YearBand>("mid");
  const [dpf, setDpf] = useState<Dpf>("unknown");
  const didMount = useRef(false);

  const engine = vehicle ? hasEngineStep(vehicle) : true;
  const stages = engine ? [t("step1"), t("step2"), t("step3"), t("stepResults")] : [t("step1"), t("step2App"), t("stepResults")];
  const resultsStep = stages.length - 1;
  const totalSteps = stages.length - 1;

  const input: FinderInput | null = useMemo(() => {
    if (!vehicle || !option) return null;
    if (!hasEngineStep(vehicle)) return { vehicle, option };
    const dpfFlag = dpf === "yes" || (dpf === "unknown" && fuel === "diesel" && year !== "old");
    return { vehicle, option, fuel, year, dpf: dpfFlag };
  }, [vehicle, option, fuel, year, dpf]);

  const results = useMemo(() => (input && step === resultsStep ? recommend(products, input, 6) : []), [products, input, step, resultsStep]);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const el = topRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.5) {
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }, [step, reduce]);

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const chooseVehicle = (v: VehicleType) => {
    if (v !== vehicle) {
      setOption(null);
      if (v === "truck") setFuel("diesel");
      else if (fuel === "lpg" && v !== "car" && v !== "van") setFuel("petrol");
    }
    setVehicle(v);
    go(1);
  };

  const chooseOption = (o: string) => {
    setOption(o);
    go(vehicle && hasEngineStep(vehicle) ? 2 : resultsStep);
  };

  const restart = () => {
    setDir(-1);
    setStep(0);
    setVehicle(null);
    setOption(null);
    setDpf("unknown");
  };

  const optionLabel = (o: string) => {
    if (!vehicle) return "";
    if (hasEngineStep(vehicle)) return o === "other" ? t("brandOther") : (brandsFor(vehicle).find((b) => b.id === o)?.label ?? o);
    return t(`apps.${o}.label`);
  };

  const summary = [
    vehicle && { label: t(`vehicle.${vehicle}`), step: 0 },
    option && { label: optionLabel(option), step: 1 },
    ...(engine && vehicle && option
      ? [
          { label: t(`fuels.${fuel}`), step: 2 },
          { label: t(`years.${year}`), step: 2 },
          ...(dpf !== "unknown" ? [{ label: `${dpf === "yes" ? "✓" : "✕"} DPF`, step: 2 }] : []),
        ]
      : []),
  ].filter(Boolean) as { label: string; step: number }[];

  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 48 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -48 }),
  };

  const progress = step / resultsStep;

  return (
    <div className="grid gap-10">
      <div ref={topRef} className="scroll-mt-28 overflow-hidden rounded-3xl border border-line bg-white shadow-lift">
        {/* progress header */}
        <div className="border-b border-line bg-canvas/60 px-5 pt-5 pb-4 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-navy-400" aria-live="polite">
              {step < resultsStep ? t("progress", { current: step + 1, total: totalSteps }) : t("stepResults")}
            </p>
            {step > 0 && (
              <button
                type="button"
                onClick={restart}
                className="inline-flex items-center gap-1.5 text-[13px] font-bold text-navy-600 transition hover:text-navy-800"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                {t("restart")}
              </button>
            )}
          </div>
          <ol className="mt-3 hidden grid-flow-col gap-2 sm:grid" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
            {stages.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li key={s}>
                  <button
                    type="button"
                    disabled={!done}
                    onClick={() => go(i)}
                    className={cn(
                      "flex w-full items-center gap-2 text-left text-[13px] font-semibold transition",
                      active ? "text-navy-700" : done ? "text-navy-500 hover:text-navy-700" : "text-muted/70",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold transition-colors",
                        active ? "bg-navy-700 text-white" : done ? "bg-brand-400 text-navy-900" : "bg-navy-100 text-navy-400",
                      )}
                    >
                      {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
                    </span>
                    <span className="truncate">{s}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-navy-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300"
              initial={false}
              animate={{ width: `${Math.max(6, progress * 100)}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        <div className="relative min-h-[420px] px-5 py-7 sm:px-8 sm:py-9">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={`${step}-${vehicle ?? ""}`}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              {step === 0 && (
                <fieldset>
                  <legend className="h-display text-2xl text-navy-700 sm:text-3xl">{t("step1Title")}</legend>
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                    {VEHICLE_TYPES.map((v, i) => {
                      const Icon = VEHICLE_ICON[v];
                      const active = v === vehicle;
                      return (
                        <motion.button
                          key={v}
                          type="button"
                          onClick={() => chooseVehicle(v)}
                          aria-pressed={active}
                          initial={reduce ? false : { opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04, duration: 0.4 }}
                          whileHover={reduce ? undefined : { y: -4 }}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            "group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border p-4 text-left transition-colors sm:p-6",
                            active ? "border-navy-700 bg-navy-700 text-white shadow-lift" : "border-line bg-white hover:border-navy-300 hover:shadow-card",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-12 place-items-center rounded-xl transition-colors sm:size-14",
                              active ? "bg-brand-400 text-navy-900" : "bg-navy-50 text-navy-600 group-hover:bg-brand-400 group-hover:text-navy-900",
                            )}
                          >
                            <Icon className="size-6 sm:size-7" aria-hidden />
                          </span>
                          <span>
                            <span className="block text-[15px] font-extrabold leading-tight sm:text-lg">{t(`vehicle.${v}`)}</span>
                            <span className={cn("mt-1 block text-[12.5px] leading-snug sm:text-[13px]", active ? "text-white/70" : "text-muted")}>
                              {t(`vehicleHint.${v}`)}
                            </span>
                          </span>
                          <ArrowRight
                            className={cn(
                              "absolute top-5 right-5 hidden size-4 transition-all sm:block",
                              active ? "text-brand-400" : "-translate-x-1 text-navy-300 opacity-0 group-hover:translate-x-0 group-hover:opacity-100",
                            )}
                            aria-hidden
                          />
                        </motion.button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {step === 1 && vehicle && (
                <fieldset>
                  <legend className="h-display text-2xl text-navy-700 sm:text-3xl">
                    {engine ? t("step2Title") : t("step2AppTitle")}
                  </legend>
                  {engine ? (
                    <div className="mt-6 grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 lg:grid-cols-3">
                      {brandsFor(vehicle).map((b, i) => {
                        const active = option === b.id;
                        const label = b.id === "other" ? t("brandOther") : b.label;
                        const mono = b.id === "other" ? "?" : b.label.split(/[\s/]+/)[0].slice(0, 2).toUpperCase();
                        return (
                          <motion.button
                            key={b.id}
                            type="button"
                            onClick={() => chooseOption(b.id)}
                            aria-pressed={active}
                            initial={reduce ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.025, duration: 0.3 }}
                            className={cn(
                              "group flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                              active ? "border-navy-700 bg-navy-700 text-white" : "border-line bg-white hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-card",
                            )}
                          >
                            <span
                              className={cn(
                                "grid size-10 shrink-0 -skew-x-6 place-items-center rounded-lg text-[13px] font-extrabold tracking-tight transition-colors",
                                active ? "bg-brand-400 text-navy-900" : "bg-navy-50 text-navy-600 group-hover:bg-brand-400 group-hover:text-navy-900",
                              )}
                            >
                              <span className="skew-x-6">{mono}</span>
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[14px] font-bold leading-tight">{label}</span>
                              {b.id === "other" && (
                                <span className={cn("mt-0.5 block text-[12px]", active ? "text-white/70" : "text-muted")}>{t("brandOtherHint")}</span>
                              )}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {optionsFor(vehicle).map((o, i) => {
                        const Icon = APP_ICON[o] ?? Droplets;
                        const active = option === o;
                        return (
                          <motion.button
                            key={o}
                            type="button"
                            onClick={() => chooseOption(o)}
                            aria-pressed={active}
                            initial={reduce ? false : { opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.35 }}
                            className={cn(
                              "group flex items-start gap-4 rounded-2xl border p-4 text-left transition sm:p-5",
                              active ? "border-navy-700 bg-navy-700 text-white" : "border-line bg-white hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-card",
                            )}
                          >
                            <span
                              className={cn(
                                "grid size-11 shrink-0 place-items-center rounded-xl transition-colors",
                                active ? "bg-brand-400 text-navy-900" : "bg-navy-50 text-navy-600 group-hover:bg-brand-400 group-hover:text-navy-900",
                              )}
                            >
                              <Icon className="size-5" aria-hidden />
                            </span>
                            <span>
                              <span className="block text-[15px] font-extrabold">{t(`apps.${o}.label`)}</span>
                              <span className={cn("mt-1 block text-[13px] leading-snug", active ? "text-white/70" : "text-muted")}>
                                {t(`apps.${o}.hint`)}
                              </span>
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                  <StepNav onBack={() => go(0)} backLabel={t("back")} />
                </fieldset>
              )}

              {step === 2 && engine && vehicle && (
                <div>
                  <h2 className="h-display text-2xl text-navy-700 sm:text-3xl">{t("step3Title")}</h2>
                  <div className="mt-7 grid gap-7">
                    <ChoiceGroup label={t("fuel")}>
                      {FUELS.filter((f) => vehicle !== "truck" || f === "diesel" || f === "lpg").map((f) => {
                        const Icon = FUEL_ICON[f];
                        return (
                          <Choice key={f} active={fuel === f} onClick={() => setFuel(f)}>
                            <Icon className="size-4" aria-hidden />
                            {t(`fuels.${f}`)}
                          </Choice>
                        );
                      })}
                    </ChoiceGroup>
                    <ChoiceGroup label={t("year")}>
                      {YEAR_BANDS.map((y) => (
                        <Choice key={y} active={year === y} onClick={() => setYear(y)}>
                          {t(`years.${y}`)}
                        </Choice>
                      ))}
                    </ChoiceGroup>
                    <ChoiceGroup label={t("dpf")} hint={t("dpfHint")}>
                      {(["yes", "no", "unknown"] as Dpf[]).map((d) => (
                        <Choice key={d} active={dpf === d} onClick={() => setDpf(d)}>
                          {d === "yes" ? t("yes") : d === "no" ? t("no") : t("dpfUnknown")}
                        </Choice>
                      ))}
                    </ChoiceGroup>
                  </div>
                  <StepNav onBack={() => go(1)} backLabel={t("back")}>
                    <Button size="lg" onClick={() => go(resultsStep)}>
                      {t("showResults")}
                      <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  </StepNav>
                </div>
              )}

              {step === resultsStep && input && (
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-[12px] font-bold uppercase tracking-[0.14em] text-muted">{t("selection")}:</span>
                    {summary.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => go(s.step)}
                        title={t("edit")}
                        className="rounded-full border border-line bg-canvas px-3 py-1 text-[13px] font-semibold text-navy-700 transition hover:border-navy-300 hover:bg-white"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <h2 className="h-display mt-5 text-2xl text-navy-700 sm:text-3xl">
                    {results.length ? t("resultsCount", { count: results.length }) : t("results")}
                  </h2>
                  {results.length > 0 ? (
                    <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      {results.map((r, i) => (
                        <FinderResultCard key={r.product.slug} result={r} index={i} preferredSize={PREFERRED_SIZE[input.vehicle]} />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-dashed border-navy-200 bg-canvas p-6">
                      <p className="max-w-xl text-[15px] leading-7 text-ink/80">{t("noMatch")}</p>
                      <a href="#expert" className="inline-flex items-center gap-2 text-sm font-bold text-navy-700 hover:text-navy-900">
                        {t("noMatchCta")}
                        <ArrowRight className="size-4" aria-hidden />
                      </a>
                    </div>
                  )}
                  <p className="mt-6 text-[12.5px] leading-5 text-muted">{t("disclaimer")}</p>
                  <StepNav onBack={() => go(resultsStep - 1)} backLabel={t("back")}>
                    <Button variant="outline" onClick={restart}>
                      <RotateCcw className="size-4" aria-hidden />
                      {t("restart")}
                    </Button>
                  </StepNav>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <ExpertForm
        selection={input ? { ...input, labels: summary.map((s) => s.label) } : null}
        recommended={results.map((r) => r.product.slug)}
      />
    </div>
  );
}

function StepNav({ onBack, backLabel, children }: { onBack: () => void; backLabel: string; children?: React.ReactNode }) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden />
        {backLabel}
      </Button>
      {children}
    </div>
  );
}

function ChoiceGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-[13px] font-bold uppercase tracking-[0.12em] text-navy-400">{label}</legend>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
      {hint && <p className="mt-2.5 max-w-xl text-[12.5px] leading-5 text-muted">{hint}</p>}
    </fieldset>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold transition",
        active ? "border-navy-700 bg-navy-700 text-white shadow-card" : "border-line bg-white text-navy-700 hover:border-navy-300",
      )}
    >
      {children}
    </button>
  );
}
