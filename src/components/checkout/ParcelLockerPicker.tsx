"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, LocateFixed, Loader2, MapPin, Package, Pencil } from "lucide-react";
import type { Market } from "@/lib/types";
import { cn } from "@/lib/utils";
import { distanceKm, searchLockerOptions, type LockerOption, type LockerProvider, type LockerProviderOption, type ParcelLocker } from "./lockers";
import { CarrierLogo } from "@/components/shipping/CarrierLogo";

const cache = new Map<string, Promise<LockerOption[]>>();
const providerCache = new Map<Market, Promise<LockerProviderOption[]>>();
const FALLBACK: LockerProviderOption[] = [{ id: "omniva", name: "Omniva", count: 0 }];

function loadLockers(market: Market, provider: LockerProvider) {
  const key = `${market}:${provider}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      fetch(`/api/parcel-lockers?country=${market}&provider=${encodeURIComponent(provider)}`)
        .then((r) => r.json())
        .then((j: { lockers?: LockerOption[] }) => j.lockers ?? [])
        .catch(() => []),
    );
  }
  return cache.get(key)!;
}

function loadProviders(market: Market) {
  if (!providerCache.has(market)) {
    providerCache.set(
      market,
      fetch(`/api/parcel-lockers/providers?country=${market}`)
        .then((r) => r.json())
        .then((j: { providers?: LockerProviderOption[] }) => (j.providers?.length ? j.providers : FALLBACK))
        .catch(() => FALLBACK),
    );
  }
  return providerCache.get(market)!;
}

/**
 * Parcel-locker selector backed by live pickup-point feeds (Omniva and any provider enabled in the admin).
 * The rest of the checkout only relies on `value` / `onChange` with the `ParcelLocker` shape.
 */
export function ParcelLockerPicker({
  market,
  value,
  onChange,
  invalid,
  priceLabel,
}: {
  market: Market;
  value: ParcelLocker | null;
  onChange: (v: ParcelLocker | null) => void;
  invalid?: boolean;
  /** customer price of the parcel-locker delivery (same for every provider) */
  priceLabel?: string;
}) {
  const t = useTranslations("checkout.locker");
  const [providers, setProviders] = useState<LockerProviderOption[]>(FALLBACK);
  const [provider, setProvider] = useState<LockerProvider>(value?.provider ?? "omniva");
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
    loadProviders(market).then((list) => {
      if (!alive) return;
      setProviders(list);
      setProvider((p) => (list.some((x) => x.id === p) ? p : list[0].id));
    });
    return () => {
      alive = false;
    };
  }, [market]);

  useEffect(() => {
    let alive = true;
    loadLockers(market, provider).then((l) => alive && setLockers(l));
    return () => {
      alive = false;
    };
  }, [market, provider]);

  const providerName = providers.find((p) => p.id === provider)?.name ?? "Omniva";
  const switchProvider = (id: LockerProvider) => {
    if (id === provider) return;
    setLockers(null);
    setProvider(id);
    setQuery("");
    setOrigin(null);
    setActive(0);
  };

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
    onChange({ provider, id: l.id, name: l.name, city: l.city, address: l.address });
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
        <CarrierLogo code={value.provider} name={providers.find((p) => p.id === value.provider)?.name ?? value.provider} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{providers.find((p) => p.id === value.provider)?.name ?? value.provider}</p>
          <p className="truncate text-[15px] font-bold text-ink">{value.name}</p>
          {value.address && <p className="truncate text-[12.5px] text-muted">{value.address}</p>}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-bold text-navy-600 ring-1 ring-navy-200 transition hover:bg-surface"
        >
          <Pencil className="size-3.5" aria-hidden />
          {t("change")}
        </button>
      </div>
    );
  }

  return (
    <div className="relative grid gap-2">
      {providers.length > 1 && (
        <div role="radiogroup" aria-label={t("provider")} className="mb-1 flex flex-wrap gap-2">
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === provider}
              onClick={() => switchProvider(p.id)}
              className={cn(
                "inline-flex h-12 items-center gap-2.5 rounded-xl border-2 py-1 pl-1.5 pr-3.5 text-[13.5px] font-bold transition",
                p.id === provider ? "border-navy-700 bg-navy-50/60 text-navy-700" : "border-line text-ink/75 hover:border-navy-200",
              )}
            >
              <CarrierLogo code={p.id} name={p.name} />
              {p.name}
              {priceLabel && <span className="text-[12px] font-semibold text-muted">{priceLabel}</span>}
            </button>
          ))}
        </div>
      )}
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
              else if (custom) onChange({ provider, id: null, name: query.trim() });
            } else if (e.key === "Escape") setOpen(false);
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          placeholder={loading ? t("loading", { provider: providerName }) : t("placeholder")}
          autoComplete="off"
          className={cn("input pl-10", invalid && "border-danger ring-4 ring-red-100")}
        />
        {loading && <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" aria-hidden />}
      </div>
      {open && !loading && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-lift"
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
                onChange({ provider, id: null, name: query.trim() });
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
        {lockers && lockers.length > 0 ? `${t("count", { count: lockers.length, provider: providerName })} · ${t("hint")}` : failed ? t("error") : t("hint")}
      </p>
    </div>
  );
}
