"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";
import { ChevronDown, Menu, Search } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import { TopBar } from "./TopBar";
import { MegaMenu } from "./MegaMenu";
import { SearchDialog } from "./SearchDialog";
import { MobileMenu } from "./MobileMenu";
import { AccountButton, CartButton } from "./HeaderActions";
import { useSearchIndex } from "./useSearchIndex";
import { NAV_LINKS, type HeaderCategory } from "./nav";

const noopSubscribe = () => () => {};

export function Header({ categories }: { categories: HeaderCategory[] }) {
  const t = useTranslations("nav");
  const th = useTranslations("header");
  const tm = useTranslations("meta");
  const ta = useTranslations("a11y");
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mega, setMega] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [indexWanted, setIndexWanted] = useState(false);
  const { docs, prefetch } = useSearchIndex(indexWanted);
  const megaId = useId();
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMac = useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => true,
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Cmd/Ctrl+K opens the search from anywhere; "/" too when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? "");
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape") {
        setMega(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mega) return;
    const onDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setMega(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [mega]);

  // Close overlays on navigation.
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMega(false);
    setMobileOpen(false);
  }

  const counts = useMemo(() => {
    if (!docs) return null;
    const c: Record<string, number> = {};
    for (const d of docs) c[d.category] = (c[d.category] ?? 0) + 1;
    return c;
  }, [docs]);

  const openMega = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setMega(true), 60);
    setIndexWanted(true);
  };
  const closeMega = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setMega(false), 140);
  };
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const catalogActive = isActive("/catalog") || pathname.startsWith("/product");

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[100] rounded-lg bg-brand-400 px-4 py-2 font-bold text-navy-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {th("skipToContent")}
      </a>
      <TopBar />
      <header
        ref={headerRef}
        className={cn(
          "sticky top-0 z-50 text-white transition-[background-color,box-shadow,backdrop-filter] duration-300",
          scrolled || mega
            ? "bg-navy-800/90 shadow-[0_10px_30px_-12px_rgb(10_17_34/0.6)] backdrop-blur-xl backdrop-saturate-150"
            : "bg-navy-700",
        )}
        onMouseLeave={closeMega}
      >
        <div
          className={cn(
            "container-x flex items-center gap-3 transition-[height] duration-300 lg:gap-6",
            scrolled ? "h-14 lg:h-16" : "h-16 lg:h-[76px]",
          )}
        >
          <Link href="/" aria-label={t("home")} className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-brand-400">
            <Logo
              tagline={tm("tagline")}
              className={cn(
                "origin-left transition-transform duration-300 [&>span]:hidden! 2xl:[&>span]:block! [&>span]:max-w-[7.5rem]",
                scrolled && "scale-[0.92]",
              )}
            />
          </Link>

          <nav aria-label={ta("mainNav")} className="hidden h-full items-center lg:flex xl:ml-2">
            <div className="flex h-full items-center" onMouseEnter={openMega}>
              <button
                type="button"
                aria-expanded={mega}
                aria-controls={megaId}
                onClick={() => {
                  setIndexWanted(true);
                  setMega((m) => !m);
                }}
                className={cn(
                  "relative inline-flex h-10 items-center gap-1 rounded-lg px-2.5 text-[14px] font-bold transition hover:bg-white/10 xl:px-3",
                  (catalogActive || mega) && "text-brand-300",
                )}
              >
                {t("catalog")}
                <ChevronDown className={cn("size-4 transition-transform duration-200", mega && "rotate-180")} aria-hidden />
              </button>
            </div>
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onMouseEnter={closeMega}
                aria-current={isActive(l.href) ? "page" : undefined}
                className={cn(
                  "group relative inline-flex h-10 items-center rounded-lg px-2.5 text-[14px] font-bold text-white/85 transition hover:bg-white/10 hover:text-white xl:px-3",
                  isActive(l.href) && "text-white",
                  l.key === "about" && "hidden xl:inline-flex",
                )}
              >
                {t(l.key)}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-3 -bottom-0.5 h-[3px] origin-left -skew-x-[20deg] rounded-sm bg-brand-400 transition-transform duration-300",
                    isActive(l.href) ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                  )}
                />
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              onMouseEnter={prefetch}
              onFocus={prefetch}
              aria-label={ta("openSearch")}
              className="group hidden h-11 w-56 items-center gap-2.5 rounded-xl bg-white/[0.08] px-3.5 text-left text-[13px] text-white/55 ring-1 ring-white/10 transition hover:bg-white/[0.14] hover:text-white/80 md:flex lg:hidden"
            >
              <Search className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{t("search")}…</span>
              <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-sans text-[11px] font-bold text-white/60">
                {isMac ? "⌘" : "Ctrl"} K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              onMouseEnter={prefetch}
              aria-label={ta("openSearch")}
              title={`${t("search")} (${isMac ? "⌘" : "Ctrl"} K)`}
              className="grid size-11 place-items-center rounded-xl text-white/85 transition hover:bg-white/10 md:hidden lg:grid"
            >
              <Search className="size-[21px]" aria-hidden />
            </button>
            <AccountButton />
            <CartButton />
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={ta("openMenu")}
              aria-expanded={mobileOpen}
              className="grid size-11 place-items-center rounded-xl text-white transition hover:bg-white/10 lg:hidden"
            >
              <Menu className="size-6" aria-hidden />
            </button>
          </div>
        </div>

        <div className="hidden lg:block" onMouseEnter={() => hoverTimer.current && clearTimeout(hoverTimer.current)}>
          <AnimatePresence>
            {mega && <MegaMenu id={megaId} categories={categories} counts={counts} onNavigate={() => setMega(false)} />}
          </AnimatePresence>
        </div>
      </header>

      <SearchDialog open={searchOpen} onClose={closeSearch} categories={categories} />
      <MobileMenu
        open={mobileOpen}
        onClose={closeMobile}
        onSearch={() => {
          setMobileOpen(false);
          setSearchOpen(true);
        }}
        categories={categories}
      />
    </>
  );
}
