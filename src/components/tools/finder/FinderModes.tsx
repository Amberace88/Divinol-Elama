"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CarFront, ListChecks } from "lucide-react";
import type { ProductSummary } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { OilFinder } from "./OilFinder";
import { ModelAdvisor } from "./ModelAdvisor";
import { ExpertForm } from "./ExpertForm";

type Mode = "quick" | "model";
const HASH: Record<Mode, string> = { quick: "", model: "#model" };
const MODE_EVENT = "finder-mode";

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  window.addEventListener(MODE_EVENT, cb);
  return () => {
    window.removeEventListener("hashchange", cb);
    window.removeEventListener(MODE_EVENT, cb);
  };
}

/** Two ways to choose oil: our quick 3-step finder, or the official Zeller+Gmelin advisor by exact vehicle model. */
export function FinderModes({ finderProducts, allProducts }: { finderProducts: ProductSummary[]; allProducts: ProductSummary[] }) {
  const t = useTranslations("finder.model");
  const reduce = useReducedMotion();
  const mode: Mode = useSyncExternalStore(subscribeHash, () => (window.location.hash === HASH.model ? "model" : "quick"), () => "quick");

  // links to "#model" elsewhere on the page switch the tab and bring it into view
  useEffect(() => {
    const onHash = () => document.getElementById("finder-modes")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const choose = (m: Mode) => {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${HASH[m]}`);
    window.dispatchEvent(new Event(MODE_EVENT));
    document.getElementById("finder-modes")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const tabs: { id: Mode; icon: typeof CarFront; title: string; hint: string; badge?: string }[] = [
    { id: "quick", icon: ListChecks, title: t("tabQuick"), hint: t("tabQuickHint") },
    { id: "model", icon: CarFront, title: t("tabModel"), hint: t("tabModelHint"), badge: t("tabModelBadge") },
  ];

  return (
    <div id="finder-modes" className="grid scroll-mt-28 gap-6">
      <div role="tablist" aria-label={t("tabsLabel")} className="grid gap-2 rounded-3xl border border-line bg-surface p-2 shadow-card sm:grid-cols-2">
        {tabs.map((tab) => {
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`finder-panel-${tab.id}`}
              onClick={() => choose(tab.id)}
              className={cn(
                "relative flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left transition sm:px-5",
                active ? "text-white" : "text-navy-700 hover:bg-navy-50/70 dark:hover:bg-white/5",
              )}
            >
              {active && (
                <motion.span
                  layoutId="finder-mode"
                  className="absolute inset-0 rounded-2xl bg-navy-700 shadow-lift"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  aria-hidden
                />
              )}
              <span className={cn("relative grid size-11 shrink-0 place-items-center rounded-xl transition", active ? "bg-brand-400 text-navy-900" : "bg-navy-50 text-navy-600 dark:bg-white/10")}>
                <tab.icon className="size-5" aria-hidden />
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-extrabold tracking-tight">{tab.title}</span>
                  {tab.badge && (
                    <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide", active ? "bg-white/15 text-brand-300" : "bg-brand-400 text-navy-900")}>
                      {tab.badge}
                    </span>
                  )}
                </span>
                <span className={cn("mt-0.5 block text-[12.5px] leading-snug", active ? "text-white/65" : "text-muted")}>{tab.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          id={`finder-panel-${mode}`}
          role="tabpanel"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {mode === "quick" ? (
            <OilFinder products={finderProducts} />
          ) : (
            <div className="grid gap-10">
              <ModelAdvisor products={allProducts} />
              <ExpertForm selection={null} recommended={[]} advisor={false} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
