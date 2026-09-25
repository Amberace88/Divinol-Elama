"use client";

import { useTransition } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Globe, MapPin } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeNames, routing, type Locale } from "@/i18n/routing";
import { MARKETS } from "@/lib/commerce";
import type { Market } from "@/lib/types";
import { usePricing } from "@/components/providers/PriceProvider";
import { cn } from "@/lib/utils";
import { Popover, PopoverItem } from "./Popover";

/** Switch language while staying on the same page (keeps dynamic params and the query string). */
export function useLocaleSwitch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [pending, start] = useTransition();
  const change = (next: Locale) => {
    const rest: Record<string, string> = {};
    for (const [k, v] of Object.entries(params ?? {})) {
      if (k !== "locale" && typeof v === "string") rest[k] = v;
    }
    const query = Object.fromEntries(new URLSearchParams(window.location.search));
    start(() => {
      router.replace({ pathname, params: rest, query } as unknown as Parameters<typeof router.replace>[0], { locale: next });
    });
  };
  return { change, pending };
}

export function LocaleSwitcher({ variant = "popover" }: { variant?: "popover" | "list" }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("header");
  const { change, pending } = useLocaleSwitch();
  if (variant === "list") {
    return (
      <div role="group" aria-label={t("language")} className="flex flex-wrap gap-2">
        {routing.locales.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            onClick={() => change(l)}
            aria-current={l === locale || undefined}
            className={cn(
              "h-9 rounded-lg px-3 text-[13px] font-bold uppercase tracking-wide transition",
              l === locale ? "bg-brand-400 text-navy-900" : "bg-white/10 text-white/80 hover:bg-white/20",
            )}
          >
            {l}
          </button>
        ))}
      </div>
    );
  }
  return (
    <Popover
      label={t("language")}
      button={
        <>
          <Globe className={cn("size-3.5", pending && "animate-spin")} aria-hidden />
          <span className="uppercase">{locale}</span>
        </>
      }
    >
      {(close) =>
        routing.locales.map((l) => (
          <PopoverItem
            key={l}
            active={l === locale}
            onClick={() => {
              close();
              if (l !== locale) change(l);
            }}
          >
            <span className="w-6 text-[11px] font-extrabold uppercase text-muted">{l}</span>
            <span lang={l} className="flex-1">
              {localeNames[l]}
            </span>
            {l === locale && <Check className="size-4 text-navy-600" aria-hidden />}
          </PopoverItem>
        ))
      }
    </Popover>
  );
}

export function MarketSwitcher({ variant = "popover" }: { variant?: "popover" | "list" }) {
  const t = useTranslations("market");
  const { market, setMarket, b2b } = usePricing();
  if (variant === "list") {
    return (
      <div role="group" aria-label={t("label")} className="flex flex-wrap gap-2">
        {MARKETS.map((m: Market) => (
          <button
            key={m}
            type="button"
            onClick={() => setMarket(m)}
            aria-pressed={m === market}
            className={cn(
              "h-9 rounded-lg px-3 text-[13px] font-bold transition",
              m === market ? "bg-brand-400 text-navy-900" : "bg-white/10 text-white/80 hover:bg-white/20",
            )}
          >
            {t(m)}
          </button>
        ))}
      </div>
    );
  }
  return (
    <Popover
      label={t("label")}
      button={
        <>
          <MapPin className="size-3.5" aria-hidden />
          <span>{market}</span>
          <span className="hidden text-white/45 sm:inline">· {b2b ? t("vatExcl") : t("vatIncl")}</span>
        </>
      }
    >
      {(close) => (
        <>
          <p className="px-3 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted">{t("label")}</p>
          {MARKETS.map((m) => (
            <PopoverItem
              key={m}
              active={m === market}
              onClick={() => {
                setMarket(m);
                close();
              }}
            >
              <span className="w-6 text-[11px] font-extrabold text-muted">{m}</span>
              <span className="flex-1">{t(m)}</span>
              {m === market && <Check className="size-4 text-navy-600" aria-hidden />}
            </PopoverItem>
          ))}
        </>
      )}
    </Popover>
  );
}
