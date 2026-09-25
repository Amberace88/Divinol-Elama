"use client";

import { useState } from "react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { Building2, FileText, LayoutDashboard, Loader2, LogOut, MapPin, Package, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { B2BStatus } from "./types";

const ITEMS = [
  { href: "/account", key: "overview", Icon: LayoutDashboard },
  { href: "/account/orders", key: "orders", Icon: Package },
  { href: "/account/invoices", key: "invoices", Icon: FileText },
  { href: "/account/profile", key: "profile", Icon: UserRound },
  { href: "/account/addresses", key: "addresses", Icon: MapPin },
  { href: "/account/business", key: "business", Icon: Building2 },
] as const;

export function AccountNav({ b2bStatus, isAdmin = false }: { b2bStatus: B2BStatus; isAdmin?: boolean }) {
  const t = useTranslations("account.nav");
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [leaving, setLeaving] = useState(false);

  const isActive = (href: string) => (href === "/account" ? pathname === "/account" : pathname.startsWith(href));

  async function logout() {
    setLeaving(true);
    try {
      await createClient().auth.signOut();
      toast.success(t("loggedOut"));
      router.replace("/");
      router.refresh();
    } catch {
      setLeaving(false);
    }
  }

  return (
    <nav aria-label={t("label")} className="lg:sticky lg:top-28">
      {/* Mobile: horizontal pills */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:hidden">
        {isAdmin && (
          <NextLink
            href="/admin"
            className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-brand-400 px-4 text-[13px] font-bold text-navy-900 transition hover:bg-brand-300"
          >
            <ShieldCheck className="h-4 w-4" />
            {t("admin")}
          </NextLink>
        )}
        {ITEMS.map(({ href, key, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-bold ring-1 transition",
                active ? "bg-navy-700 text-white ring-navy-700" : "bg-surface text-navy-700 ring-line hover:ring-navy-300",
              )}
            >
              <Icon className="h-4 w-4" />
              {t(key)}
              {key === "business" && b2bStatus === "pending" && <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={logout}
          disabled={leaving}
          className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-surface px-4 text-[13px] font-bold text-danger ring-1 ring-line transition hover:ring-danger/40"
        >
          {leaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          {t("logout")}
        </button>
      </div>

      {/* Desktop: sidebar */}
      <div className="card hidden p-2 lg:block">
        {isAdmin && (
          <div className="mb-2 border-b border-line pb-2">
            <NextLink
              href="/admin"
              className="flex h-11 items-center gap-3 rounded-xl bg-brand-400 px-3.5 text-sm font-bold text-navy-900 transition hover:bg-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-300"
            >
              <ShieldCheck className="h-[18px] w-[18px]" />
              <span className="flex-1">{t("admin")}</span>
            </NextLink>
          </div>
        )}
        <ul className="grid gap-0.5">
          {ITEMS.map(({ href, key, Icon }) => {
            const active = isActive(href);
            return (
              <li key={href} className="relative">
                {active && (
                  <motion.span
                    layoutId="account-nav-active"
                    className="absolute inset-0 rounded-xl bg-navy-50"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 42 }}
                  />
                )}
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-300",
                    active ? "text-navy-800" : "text-ink/70 hover:bg-canvas hover:text-navy-700",
                  )}
                >
                  {active && <span className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-sm bg-brand-400" />}
                  <Icon className={cn("h-[18px] w-[18px]", active ? "text-navy-700" : "text-muted")} />
                  <span className="flex-1">{t(key)}</span>
                  {key === "business" && b2bStatus === "pending" && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700 uppercase">{t("pending")}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 border-t border-line pt-2">
          <button
            type="button"
            onClick={logout}
            disabled={leaving}
            className="flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-ink/70 transition hover:bg-danger/5 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-300 disabled:opacity-60"
          >
            {leaving ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <LogOut className="h-[18px] w-[18px]" />}
            {leaving ? t("loggingOut") : t("logout")}
          </button>
        </div>
      </div>
    </nav>
  );
}
