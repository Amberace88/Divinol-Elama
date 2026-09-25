"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

const EVENT = "divinol:theme";

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_STORAGE_KEY) return;
    applyTheme(e.newValue === "dark" ? "dark" : "light", false);
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light");
const getServerSnapshot = (): Theme => "light";

function applyTheme(theme: Theme, persist = true) {
  const root = document.documentElement;
  // Flip every colour at once instead of letting each `transition` animate on its own schedule.
  root.classList.add("theme-switching");
  root.classList.toggle("dark", theme === "dark");
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* private mode — the choice just won't survive a reload */
    }
  }
  void window.getComputedStyle(root).color; // commit styles before re-enabling transitions
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
  window.dispatchEvent(new Event(EVENT));
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    theme,
    setTheme: applyTheme,
    toggle: () => applyTheme(theme === "dark" ? "light" : "dark"),
  };
}

/** Sun/moon icon button for the (navy) header. Icons swap purely in CSS, so there is no flash before hydration. */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("header");
  const { theme, toggle } = useTheme();
  const label = theme === "dark" ? t("lightMode") : t("darkMode");
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        "relative grid size-11 place-items-center overflow-hidden rounded-xl text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        className,
      )}
    >
      <Moon
        data-theme-anim
        aria-hidden
        className="absolute size-[20px] transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] dark:-translate-y-6 dark:rotate-90 dark:opacity-0"
      />
      <Sun
        data-theme-anim
        aria-hidden
        className="absolute size-[21px] translate-y-6 -rotate-90 text-brand-300 opacity-0 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] dark:translate-y-0 dark:rotate-0 dark:opacity-100"
      />
    </button>
  );
}

/** Labelled on/off switch for the mobile menu (navy panel). */
export function ThemeSwitch({ className }: { className?: string }) {
  const t = useTranslations("header");
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cn(
        "flex h-12 w-full items-center gap-3 rounded-xl bg-white/10 px-4 text-left text-[15px] font-bold text-white ring-1 ring-white/10 transition active:bg-white/15",
        className,
      )}
    >
      <span className="relative grid size-5 place-items-center">
        <Moon data-theme-anim aria-hidden className="absolute size-5 text-white/80 transition duration-300 dark:scale-50 dark:opacity-0" />
        <Sun data-theme-anim aria-hidden className="absolute size-5 scale-50 text-brand-400 opacity-0 transition duration-300 dark:scale-100 dark:opacity-100" />
      </span>
      <span className="flex-1">{t("darkMode")}</span>
      <span
        aria-hidden
        data-theme-anim
        className="relative h-6 w-11 shrink-0 rounded-full bg-white/20 transition-colors duration-300 dark:bg-brand-400"
      >
        <span
          data-theme-anim
          className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform duration-300 dark:translate-x-5 dark:bg-navy-900"
        />
      </span>
    </button>
  );
}

/** Sonner toaster that follows the site theme. */
export function ThemedToaster() {
  const { theme } = useTheme();
  // Error/404 renders can re-create <html> without the class the head script added — restore it.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) === "dark";
      if (stored !== document.documentElement.classList.contains("dark")) applyTheme(stored ? "dark" : "light", false);
    } catch {
      /* storage unavailable */
    }
  }, []);
  return <Toaster position="top-center" richColors closeButton theme={theme} />;
}
