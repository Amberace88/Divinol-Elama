"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, MapPin, Package, Pencil } from "lucide-react";
import type { Market } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LOCKER_PROVIDERS, searchLockers, type LockerProvider, type ParcelLocker } from "./lockers";

/**
 * Parcel-locker selector. Self-contained on purpose: it will be swapped for a live Omniva integration,
 * the rest of the checkout only relies on `value` / `onChange` with the `ParcelLocker` shape.
 */
export function ParcelLockerPicker({
  market,
  value,
  onChange,
  invalid,
}: {
  market: Market;
  value: ParcelLocker | null;
  onChange: (v: ParcelLocker | null) => void;
  invalid?: boolean;
}) {
  const t = useTranslations("checkout.locker");
  const providers = LOCKER_PROVIDERS.filter((p) => p.markets.includes(market));
  const [provider, setProvider] = useState<LockerProvider>(value?.provider ?? providers[0]?.id ?? "omniva");
  const activeProvider = providers.some((p) => p.id === provider) ? provider : (providers[0]?.id ?? "omniva");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputId = useId();

  const suggestions = searchLockers(market, activeProvider, query);
  const custom = query.trim().length >= 3;
  const options: ParcelLocker[] = [
    ...suggestions,
    ...(custom ? [{ provider: activeProvider, id: null, name: query.trim() } as ParcelLocker] : []),
  ];

  const pick = (l: ParcelLocker) => {
    onChange(l);
    setOpen(false);
    setQuery("");
  };

  if (value) {
    const pName = LOCKER_PROVIDERS.find((p) => p.id === value.provider)?.name;
    return (
      <div className="flex items-center gap-3 rounded-2xl border-2 border-navy-700 bg-navy-50/60 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy-700 text-brand-400">
          <Package className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{pName}</p>
          <p className="truncate text-[15px] font-bold text-ink">{value.name}</p>
          {value.address && <p className="truncate text-[12.5px] text-muted">{value.address}</p>}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-bold text-navy-600 ring-1 ring-navy-200 transition hover:bg-white"
        >
          <Pencil className="size-3.5" aria-hidden />
          {t("change")}
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div>
        <p className="label">{t("provider")}</p>
        <div role="radiogroup" aria-label={t("provider")} className="flex flex-wrap gap-2">
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === activeProvider}
              onClick={() => setProvider(p.id)}
              className={cn(
                "h-10 rounded-xl px-4 text-[13.5px] font-bold transition",
                p.id === activeProvider ? "bg-navy-700 text-white" : "bg-white text-ink/75 ring-1 ring-line hover:ring-navy-300",
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <label htmlFor={inputId} className="label">
          {t("search")}
        </label>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            id={inputId}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActive((a) => Math.min(a + 1, options.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (options[active]) pick(options[active]);
              } else if (e.key === "Escape") setOpen(false);
            }}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-invalid={invalid || undefined}
            aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
            placeholder={t("placeholder")}
            autoComplete="off"
            className={cn("input pl-10", invalid && "border-danger ring-4 ring-red-100")}
          />
        </div>
        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-lift"
          >
            {options.length === 0 && <li className="px-3 py-3 text-[13px] text-muted">{t("noResults")}</li>}
            {options.map((o, i) => {
              const isCustom = custom && i === options.length - 1;
              return (
                <li
                  key={`${o.name}-${i}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(o);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px]",
                    i === active ? "bg-navy-50 text-navy-700" : "text-ink/85",
                    isCustom && "border-t border-line",
                  )}
                >
                  {isCustom ? <Pencil className="size-4 text-muted" aria-hidden /> : <Package className="size-4 text-navy-400" aria-hidden />}
                  <span className="flex-1 truncate font-semibold">{isCustom ? t("useCustom", { value: o.name }) : o.name}</span>
                  {i === active && <Check className="size-4" aria-hidden />}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-1.5 text-[12px] text-muted">{t("hint")}</p>
      </div>
    </div>
  );
}
