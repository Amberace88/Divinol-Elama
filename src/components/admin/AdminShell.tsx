"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Activity,
  ChevronsLeft,
  ExternalLink,
  FolderTree,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Settings,
  ShoppingBag,
  Truck,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ConfirmProvider } from "./client-ui";
import { GlobalSearch } from "./GlobalSearch";

export type AdminCounts = { openOrders: number; b2bPending: number; newInquiries: number };

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: keyof AdminCounts; exact?: boolean };

const NAV: NavItem[] = [
  { href: "/admin", label: "Pārskats", icon: LayoutDashboard, exact: true },
  { href: "/admin/analytics", label: "Apmeklējums", icon: Activity },
  { href: "/admin/orders", label: "Pasūtījumi", icon: ShoppingBag, badge: "openOrders" },
  { href: "/admin/shipping", label: "Sūtījumi", icon: Truck },
  { href: "/admin/invoices", label: "Rēķini", icon: ReceiptText },
  { href: "/admin/products", label: "Produkti", icon: Package },
  { href: "/admin/categories", label: "Kategorijas", icon: FolderTree },
  { href: "/admin/customers", label: "Klienti", icon: Users, badge: "b2bPending" },
  { href: "/admin/inquiries", label: "Pieprasījumi", icon: Inbox, badge: "newInquiries" },
  { href: "/admin/settings", label: "Iestatījumi", icon: Settings },
];

const MOBILE_NAV = ["/admin", "/admin/orders", "/admin/products", "/admin/customers"];

const badgeTitle: Record<keyof AdminCounts, string> = {
  openOrders: "atvērti pasūtījumi",
  b2bPending: "B2B pieteikumi gaida",
  newInquiries: "jauni pieprasījumi",
};

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

export function AdminShell({
  children,
  counts,
  user,
  initialCollapsed,
}: {
  children: React.ReactNode;
  counts: AdminCounts;
  user: { name: string; email: string };
  initialCollapsed: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const reduce = useReducedMotion();

  // Exclude admins' own storefront visits from the website analytics on this browser.
  useEffect(() => {
    try {
      localStorage.setItem("dv_notrack", "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Close the mobile drawer on navigation (state derived during render, no effect needed).
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (drawer) setDrawer(false);
  }

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `admin_sidebar=${next ? "1" : "0"}; path=/admin; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  return (
    <ConfirmProvider>
      <div className="min-h-dvh bg-canvas">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 hidden flex-col bg-navy-950 text-white transition-[width] duration-300 print:hidden lg:flex",
            collapsed ? "w-[76px]" : "w-64",
          )}
        >
          <SidebarContent pathname={pathname} counts={counts} collapsed={collapsed} layoutId="nav-desktop" />
          <button
            type="button"
            onClick={toggle}
            className="mx-3 mb-4 flex h-9 items-center justify-center gap-2 rounded-lg text-[12px] font-semibold text-white/50 transition hover:bg-white/5 hover:text-white"
            aria-label={collapsed ? "Izvērst sānjoslu" : "Sakļaut sānjoslu"}
          >
            <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span>Sakļaut</span>}
          </button>
        </aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {drawer && (
            <div className="fixed inset-0 z-[60] lg:hidden print:hidden">
              <motion.div
                className="absolute inset-0 bg-navy-950/60 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDrawer(false)}
              />
              <motion.aside
                initial={reduce ? { opacity: 0 } : { x: "-100%" }}
                animate={reduce ? { opacity: 1 } : { x: 0 }}
                exit={reduce ? { opacity: 0 } : { x: "-100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="absolute inset-y-0 left-0 flex w-[84%] max-w-[300px] flex-col bg-navy-950 text-white shadow-lift"
                aria-label="Navigācija"
              >
                <button
                  type="button"
                  onClick={() => setDrawer(false)}
                  className="absolute right-3 top-4 grid h-9 w-9 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                  aria-label="Aizvērt izvēlni"
                >
                  <X className="h-5 w-5" />
                </button>
                <SidebarContent pathname={pathname} counts={counts} collapsed={false} layoutId="nav-mobile" />
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        <div className={cn("flex min-h-dvh flex-col transition-[padding] duration-300 print:pl-0", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
          <Topbar user={user} onMenu={() => setDrawer(true)} />
          <main id="main" className="mx-auto w-full max-w-[1480px] flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7 print:max-w-none print:p-0">
            {children}
          </main>
        </div>

        {/* Mobile bottom navigation */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden lg:hidden"
          aria-label="Galvenā navigācija"
        >
          <ul className="grid grid-cols-5">
            {NAV.filter((n) => MOBILE_NAV.includes(n.href)).map((item) => {
              const active = isActive(pathname, item);
              const count = item.badge ? counts[item.badge] : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "relative flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-bold",
                      active ? "text-navy-700" : "text-muted",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {active && <span className="absolute top-0 h-[3px] w-8 -skew-x-12 rounded-b bg-brand-400" aria-hidden />}
                    <span className="relative">
                      <item.icon className="h-5 w-5" aria-hidden />
                      {count > 0 && (
                        <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-brand-400 px-1 text-center text-[9px] font-extrabold leading-4 text-navy-900">
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => setDrawer(true)}
                className="relative flex w-full flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-bold text-muted"
              >
                <span className="relative">
                  <Menu className="h-5 w-5" aria-hidden />
                  {counts.newInquiries > 0 && <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-brand-400" />}
                </span>
                Vairāk
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </ConfirmProvider>
  );
}

function SidebarContent({ pathname, counts, collapsed, layoutId }: { pathname: string; counts: AdminCounts; collapsed: boolean; layoutId: string }) {
  return (
    <>
      <div className={cn("flex h-16 shrink-0 items-center gap-2.5 border-b border-white/5", collapsed ? "justify-center px-2" : "px-5")}>
        <Link href="/admin" className="flex items-center gap-2.5" aria-label="ELAMA administrācija">
          {collapsed ? (
            <span className="grid h-9 w-9 -skew-x-12 place-items-center rounded-lg bg-brand-400 text-[15px] font-black text-navy-900">
              <span className="skew-x-12">E</span>
            </span>
          ) : (
            <>
              <Image src="/media/brand/elama-logo.png" alt="ELAMA" width={826} height={155} className="h-[22px] w-auto" priority />
              <span className="skew-tag bg-brand-400 text-[10px] font-extrabold uppercase tracking-[0.14em] text-navy-900">
                <span>Admin</span>
              </span>
            </>
          )}
        </Link>
      </div>
      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 py-4" aria-label="Administrācijas sadaļas">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            const count = item.badge ? counts[item.badge] : 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex h-10 items-center gap-3 rounded-lg text-[13.5px] font-semibold transition",
                    collapsed ? "justify-center px-0" : "px-3",
                    active ? "bg-white/[0.08] text-white" : "text-white/60 hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId={layoutId}
                      className="absolute -left-3 top-2 h-6 w-[5px] -skew-x-12 rounded-r bg-brand-400"
                      aria-hidden
                    />
                  )}
                  <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-brand-400" : "text-white/50 group-hover:text-white/80")} aria-hidden />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {count > 0 && item.badge && (
                    <span
                      title={`${count} ${badgeTitle[item.badge]}`}
                      className={cn(
                        "rounded-full bg-brand-400 text-center text-[10.5px] font-extrabold text-navy-900",
                        collapsed ? "absolute right-2 top-1.5 min-w-4 px-1 leading-4" : "min-w-5 px-1.5 leading-5",
                      )}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {!collapsed && (
        <div className="mx-3 mb-3 rounded-xl bg-gradient-to-br from-navy-800 to-navy-900 p-3.5 ring-1 ring-white/5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-400">Divinol · SIA Elama</p>
          <p className="mt-1 text-[12px] leading-snug text-white/55">Oficiālais Divinol pārstāvis Latvijā</p>
        </div>
      )}
    </>
  );
}

function Topbar({ user, onMenu }: { user: { name: string; email: string }; onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/85 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-16 max-w-[1480px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          className="grid h-9 w-9 place-items-center rounded-lg text-navy-700 hover:bg-navy-50 lg:hidden"
          aria-label="Atvērt izvēlni"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <GlobalSearch />
        </div>
        <Link
          href="/"
          target="_blank"
          rel="noreferrer"
          className="hidden h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-bold text-navy-700 transition hover:border-navy-300 hover:bg-navy-50 sm:inline-flex"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Atvērt veikalu
        </Link>
        <UserMenu user={user} />
      </div>
    </header>
  );
}

function UserMenu({ user }: { user: { name: string; email: string } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const initials =
    (user.name || user.email)
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "A";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    try {
      await createClient().auth.signOut();
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full p-0.5 pr-0.5 transition hover:bg-navy-50 sm:pr-3"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-navy-700 text-[12px] font-extrabold text-brand-400">{initials}</span>
        <span className="hidden max-w-[140px] truncate text-[13px] font-bold text-ink sm:block">{user.name || user.email}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-xl border border-line bg-white shadow-lift"
          >
            <div className="border-b border-line px-4 py-3">
              <p className="truncate text-[13px] font-bold text-ink">{user.name || "Administrators"}</p>
              <p className="truncate text-[12px] text-muted">{user.email}</p>
            </div>
            <div className="p-1.5 text-[13px] font-semibold">
              <Link role="menuitem" href="/" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-ink hover:bg-navy-50">
                <ExternalLink className="h-4 w-4 text-muted" /> Atvērt veikalu
              </Link>
              <Link role="menuitem" href="/account" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-ink hover:bg-navy-50">
                <UserRound className="h-4 w-4 text-muted" /> Mans konts
              </Link>
              <button
                role="menuitem"
                type="button"
                onClick={signOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Iziet
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
