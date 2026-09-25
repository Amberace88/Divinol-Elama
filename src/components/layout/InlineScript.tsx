"use client";

/**
 * Blocking inline script that runs during HTML parsing (before first paint).
 * On the client it renders as inert text/plain so React doesn't warn about client-rendered scripts
 * (e.g. when the tree is re-rendered for a not-found page); suppressHydrationWarning covers the type swap.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
