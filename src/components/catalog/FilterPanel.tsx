"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, LayoutGrid } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { cn } from "@/lib/utils";
import type { Facets, Filters } from "./filters";

export type CategoryLink = { slug: string; name: string; icon: string; count: number };

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line py-4 first:pt-0 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink"
      >
        {title}
        <ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-bold transition",
        active
          ? "border-navy-700 bg-navy-700 text-white shadow-sm"
          : "border-line bg-surface text-ink/80 hover:border-navy-300 hover:text-navy-700",
      )}
    >
      {active && <Check className="size-3.5 text-brand-300" strokeWidth={3} aria-hidden />}
      {children}
    </button>
  );
}

function ChipGroup({
  values,
  selected,
  onToggle,
  limit = 12,
  labels,
}: {
  values: string[];
  selected: string[];
  onToggle: (v: string) => void;
  limit?: number;
  labels?: Record<string, string>;
}) {
  const t = useTranslations("catalog");
  const [all, setAll] = useState(false);
  const visible = all ? values : values.slice(0, limit);
  // keep selected chips visible even when collapsed
  const extra = all ? [] : selected.filter((s) => values.includes(s) && !visible.includes(s));
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {[...visible, ...extra].map((v) => (
          <Chip key={v} active={selected.includes(v)} onClick={() => onToggle(v)}>
            {labels?.[v] ?? v}
          </Chip>
        ))}
      </div>
      {values.length > limit && (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          className="mt-2 text-[12.5px] font-bold text-navy-500 hover:text-navy-700"
        >
          {all ? t("showLess") : `${t("showMore")} (+${values.length - limit})`}
        </button>
      )}
    </div>
  );
}

export function FilterPanel({
  filters,
  facets,
  categories,
  activeCategory,
  query,
  onToggle,
  onUpdate,
}: {
  filters: Filters;
  facets: Facets;
  categories: CategoryLink[];
  activeCategory?: string;
  query: string;
  onToggle: (key: "sae" | "iso" | "spec" | "pack", value: string) => void;
  onUpdate: (patch: Partial<Filters>) => void;
}) {
  const t = useTranslations("catalog");
  const q = Object.fromEntries(new URLSearchParams(query));
  const total = categories.reduce((s, c) => s + c.count, 0);
  const specGroups = [
    { key: "acea", title: t("specGroupAcea"), values: facets.specs.acea },
    { key: "api", title: t("specGroupApi"), values: facets.specs.api },
    { key: "other", title: t("specGroupOther"), values: facets.specs.other },
  ].filter((g) => g.values.length);

  return (
    <div>
      <Section title={t("category")}>
        <ul className="grid gap-0.5">
          <li>
            <Link
              href={{ pathname: "/catalog", query: q }}
              aria-current={!activeCategory ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-semibold transition",
                !activeCategory ? "bg-navy-700 text-white" : "text-ink/80 hover:bg-canvas",
              )}
            >
              <LayoutGrid className={cn("size-4", !activeCategory ? "text-brand-300" : "text-navy-400")} aria-hidden />
              <span className="flex-1">{t("allCategories")}</span>
              <span className={cn("text-[12px] tabular-nums", !activeCategory ? "text-white/70" : "text-muted")}>{total}</span>
            </Link>
          </li>
          {categories.map((c) => {
            const active = c.slug === activeCategory;
            return (
              <li key={c.slug}>
                <Link
                  href={{ pathname: "/catalog/[category]", params: { category: c.slug }, query: q }}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-semibold transition",
                    active ? "bg-navy-700 text-white" : "text-ink/80 hover:bg-canvas",
                  )}
                >
                  <CategoryIcon name={c.icon} className={cn("size-4 shrink-0", active ? "text-brand-300" : "text-navy-400")} aria-hidden />
                  <span className="flex-1 leading-tight">{c.name}</span>
                  <span className={cn("text-[12px] tabular-nums", active ? "text-white/70" : "text-muted")}>{c.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      <section className="border-b border-line py-4">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="text-[13.5px] font-bold text-ink">{t("inStockOnly")}</span>
          <input
            type="checkbox"
            checked={filters.stock}
            onChange={(e) => onUpdate({ stock: e.target.checked })}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="relative h-6 w-11 rounded-full bg-line transition peer-checked:bg-emerald-500 peer-focus-visible:ring-4 peer-focus-visible:ring-navy-100 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
          />
        </label>
      </section>

      {facets.sae.length > 0 && (
        <Section title={t("viscosity")}>
          <ChipGroup values={facets.sae} selected={filters.sae} onToggle={(v) => onToggle("sae", v)} limit={14} />
        </Section>
      )}

      {facets.iso.length > 0 && (
        <Section title={t("isoVg")}>
          <ChipGroup values={facets.iso} selected={filters.iso} onToggle={(v) => onToggle("iso", v)} />
        </Section>
      )}

      {specGroups.length > 0 && (
        <Section title={t("specification")}>
          <div className="grid gap-3.5">
            {specGroups.map((g) => (
              <div key={g.key}>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{g.title}</p>
                <ChipGroup values={g.values} selected={filters.spec} onToggle={(v) => onToggle("spec", v)} limit={g.key === "other" ? 8 : 10} />
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title={t("approval")}>
        <input
          type="search"
          value={filters.approval}
          onChange={(e) => onUpdate({ approval: e.target.value })}
          placeholder={t("approvalPlaceholder")}
          aria-label={t("approval")}
          className="input h-10 text-[14px]"
        />
      </Section>

      {facets.packs.length > 1 && (
        <Section title={t("pack")}>
          <ChipGroup
            values={facets.packs.map((p) => p.key)}
            labels={Object.fromEntries(facets.packs.map((p) => [p.key, p.label]))}
            selected={filters.pack}
            onToggle={(v) => onToggle("pack", v)}
            limit={16}
          />
        </Section>
      )}
    </div>
  );
}
