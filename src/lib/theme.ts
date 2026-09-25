export type Theme = "light" | "dark";

/** localStorage key holding the visitor's explicit choice ('light' | 'dark'). Light is the default. */
export const THEME_STORAGE_KEY = "theme";

/**
 * Inlined into <head> by [locale]/layout.tsx. Runs synchronously before first paint and applies a
 * stored night-mode choice, so the page never flashes light before hydration.
 */
export const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}})()`;
