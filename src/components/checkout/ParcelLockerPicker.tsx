"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, LocateFixed, Loader2, MapPin, Package, Pencil } from "lucide-react";
import type { Market } from "@/lib/types";
import { cn } from "@/lib/utils";
import { distanceKm, searchLockerOptions, type LockerOption, type ParcelLocker } from "./lockers";

const cache = new Map<Market, Promise<LockerOption[]>>();

function loadLockers(market: Market) {
  if (!cache.has(market)) {
    cache.set(
      market,
      fetch(`/api/parcel-lockers?country=${market}`)
        .then((r) => r.json())
        .then((j: { lockers?: LockerOption[] }) => j.lockers ?? [])
        .catch(() => []),
    );
  }
  return cache.get(market)!;
}

/**
 * Omniva parcel-machine selector backed by the live Omniva location feed.
 * The rest of the checkout only relies on `value` / `onChange` with the `ParcelLocker` shape.
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
  const [lockers, setLockers] = useState<LockerOption[] | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const listId = useId();
  const inputId = useId();

  useEffect(() => {
    let alive = true;
    loadLockers(market).then((l) => alive && setLockers(l));
    return () => {
      alive = false;
    };
  }, [market]);

  const loading = lockers === null;
  const failed = lockers !== null && lockers.length === 0;

  const options = useMemo((): (LockerOption & { km?: number })[] => {
    if (!lockers) return [];
    if (origin && !query.trim()) {
      return lockers
        .filter((l) => l.lat != null && l.lng != null)
        .map((l) => ({ ...l, km: distanceKm(origin, { lat: l.lat!, lng: l.lng! }) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 15);
    }
    return searchLockerOptions(lockers, query);
  }, [lockers, query, origin]);

  const custom = failed && query.trim().length >= 3;

  const pick = (l: LockerOption) => {
    onChange({ provider: "omniva", id: l.id, name: l.name, city: l.city, address: l.address });
    setOpen(false);
    setQuery("");
  };

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude });
        setQuery("");
        setOpen(true);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000, maximumAge: 600000 },
    );
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border-2 border-navy-700 bg-navy-50/60 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy-700 text-brand-400">
          <Package className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Omniva</p>
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
    <div className="relative grid gap-2">
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={inputId} className="label mb-0">
          {t("search")}
        </label>
        <button
          type="button"
          onClick={locate}
          disabled={loading || failed || locating}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-navy-600 transition hover:text-navy-800 disabled:opacity-40"
        >
          {locating ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <LocateFixed className="size-3.5" aria-hidden />}
          {locating ? t("locating") : t("nearest")}
        </button>
      </div>
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
            const max = options.length + (custom ? 1 : 0) - 1;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, max));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (options[active]) pick(options[active]);
              else if (custom) onChange({ provider: "omniva", id: null, name: query.trim() });
            } else if (e.key === "Escape") setOpen(false);
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          placeholder={loading ? t("loading") : t("placeholder")}
          autoComplete="off"
          className={cn("input pl-10", invalid && "border-danger ring-4 ring-red-100")}
        />
        {loading && <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" aria-hidden />}
      </div>
      {open && !loading && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-lift"
        >
          {options.length === 0 && !custom && <li className="px-3 py-3 text-[13px] text-muted">{failed ? t("error") : t("noResults")}</li>}
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5",
                i === active ? "bg-navy-50 text-navy-700" : "text-ink/85",
              )}
            >
              <Package className="mt-0.5 size-4 shrink-0 text-navy-400" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{o.name}</span>
                <span className="block truncate text-[12px] text-muted">{o.address}</span>
              </span>
              {o.km != null && (
                <span className="shrink-0 text-[12px] font-bold text-navy-500">{t("km", { km: o.km.toFixed(1) })}</span>
              )}
              {i === active && <Check className="mt-0.5 size-4 shrink-0" aria-hidden />}
            </li>
          ))}
          {custom && (
            <li
              role="option"
              aria-selected={active === options.length}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange({ provider: "omniva", id: null, name: query.trim() });
              }}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border-t border-line px-3 py-2.5 text-[14px] text-ink/85"
            >
              <Pencil className="size-4 text-muted" aria-hidden />
              <span className="truncate font-semibold">{t("useCustom", { value: query.trim() })}</span>
            </li>
          )}
        </ul>
      )}
      <p className="text-[12px] text-muted">
        {lockers && lockers.length > 0 ? `${t("count", { count: lockers.length })} · ${t("hint")}` : failed ? t("error") : t("hint")}
      </p>
    </div>
  );
}
