"use client";

import { useEffect, useState } from "react";
import { fmtNumber } from "@/lib/admin/format";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;

/** "Tiešsaistē tagad: N" — visitors active in the last 5 minutes, refreshed every 30 s while the tab is visible. */
export function LivePill({ initial, className }: { initial: number; className?: string }) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/admin/analytics/live", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { visitors?: number };
        if (alive && typeof json.visitors === "number") setCount(json.visitors);
      } catch {
        /* offline — keep the last value */
      }
    };
    const id = window.setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  const live = count > 0;
  return (
    <span
      className={cn(
        "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-[13px] font-bold shadow-card",
        live ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-line bg-white text-muted",
        className,
      )}
      title="Unikālie apmeklētāji pēdējās 5 minūtēs"
      aria-live="polite"
    >
      <span className="relative flex h-2.5 w-2.5" aria-hidden>
        {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", live ? "bg-emerald-500" : "bg-slate-300")} />
      </span>
      Tiešsaistē tagad: <span className="tabular-nums text-ink">{fmtNumber(count)}</span>
    </span>
  );
}
