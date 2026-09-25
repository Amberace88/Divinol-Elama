"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isCheckoutPath, isCheckoutSuccessPath, sessionId, track, trackPageview } from "@/lib/analytics";

/** Marks a one-off event as sent for this browser tab (e.g. begin_checkout once per session). */
function once(key: string): boolean {
  try {
    const k = `dv_once_${key}`;
    if (sessionStorage.getItem(k)) return false;
    sessionStorage.setItem(k, "1");
    return true;
  } catch {
    return true;
  }
}

function TrackerInner() {
  const pathname = usePathname();
  const search = useSearchParams();
  // Only UTM / order params should re-trigger a page view — not catalog filter changes.
  const keyParams = ["utm_source", "utm_medium", "utm_campaign", "gclid", "n"]
    .map((k) => `${k}=${search.get(k) ?? ""}`)
    .join("&");
  const last = useRef<string | null>(null);

  useEffect(() => {
    const key = `${pathname}?${keyParams}`;
    if (last.current === key) return;
    const first = last.current === null;
    last.current = key;

    trackPageview(first ? document.referrer : undefined);

    // The browser URL is the localized one (e.g. /noformet), so match against it.
    const path = window.location.pathname;
    if (isCheckoutPath(path)) {
      const sid = sessionId() ?? "x";
      if (once(`bc_${sid}`)) track("begin_checkout");
    } else if (isCheckoutSuccessPath(path)) {
      const params = new URLSearchParams(window.location.search);
      const order = params.get("n")?.replace(/[^\w-]/g, "").slice(0, 40);
      const value = Number(params.get("t"));
      if (order && once(`po_${order}`)) {
        track("purchase", { order, value: Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined });
      }
    }
  }, [pathname, keyParams]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("tel:")) return track("phone_click");
      if (href.startsWith("mailto:")) return track("email_click");
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (/\.pdf$/i.test(url.pathname)) {
        return track("catalog_download", { file: decodeURIComponent(url.pathname.split("/").pop() ?? "").slice(0, 120) });
      }
      if ((url.protocol === "http:" || url.protocol === "https:") && url.host !== window.location.host) {
        track("outbound_click", { host: url.hostname.replace(/^www\./, "").slice(0, 120) });
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}

/**
 * Cookieless first-party analytics. Mount once in the storefront layout.
 * Wrapped in its own Suspense boundary because it reads `useSearchParams()`.
 */
export function Tracker() {
  return (
    <Suspense fallback={null}>
      <TrackerInner />
    </Suspense>
  );
}
