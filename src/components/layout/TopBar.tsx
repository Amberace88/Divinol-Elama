"use client";

import { useTranslations } from "next-intl";
import { Mail, Phone } from "lucide-react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { usePricing } from "@/components/providers/PriceProvider";
import { useMoney } from "@/components/ui/useMoney";
import { LocaleSwitcher, MarketSwitcher } from "./switchers";
import { telHref } from "./nav";

export function TopBar() {
  const t = useTranslations("header");
  const { company, shipping } = useSettings();
  const { market } = usePricing();
  const money = useMoney();
  const threshold = shipping.free_threshold?.[market];
  const [lead, rest] = t("topbar", { amount: threshold != null ? money(threshold) : "—" }).split(" · ");
  return (
    <div className="relative z-[55] bg-navy-950 text-white">
      <div className="container-x flex h-9 items-center gap-4 text-[12px]">
        <p className="flex min-w-0 items-center gap-2 font-medium text-white/70">
          <span aria-hidden className="inline-block h-2.5 w-4 -skew-x-[20deg] rounded-[2px] bg-brand-400" />
          <span className="hidden md:inline">{lead}</span>
          {rest && <span className="hidden text-white/30 md:inline">·</span>}
          <span className="truncate text-white/85">{rest ?? lead}</span>
        </p>
        <div className="ml-auto flex items-center gap-1">
          <a
            href={telHref(company.phone)}
            className="hidden h-7 items-center gap-1.5 rounded-md px-2 font-semibold text-white/75 transition hover:bg-white/10 hover:text-white lg:inline-flex"
          >
            <Phone className="size-3.5" aria-hidden />
            {company.phone}
          </a>
          <a
            href={`mailto:${company.email}`}
            className="hidden h-7 items-center gap-1.5 rounded-md px-2 font-semibold text-white/75 transition hover:bg-white/10 hover:text-white xl:inline-flex"
          >
            <Mail className="size-3.5" aria-hidden />
            {company.email}
          </a>
          <span aria-hidden className="mx-1 hidden h-4 w-px bg-white/15 lg:block" />
          <MarketSwitcher />
          <LocaleSwitcher />
        </div>
      </div>
    </div>
  );
}
