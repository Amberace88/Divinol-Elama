"use client";

import { useSyncExternalStore } from "react";
import { EyeOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const KEY = "dv_notrack_choice";
const EVT = "dv:notrack";
const subscribe = (cb: () => void) => {
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
};
const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** Lets an admin exclude their own storefront visits (this browser only) from the statistics. */
export function NoTrackToggle() {
  const on = useSyncExternalStore(subscribe, read, () => false);
  const toggle = () => {
    try {
      if (on) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, "1");
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new Event(EVT));
    toast.success(on ? "Jūsu apmeklējumi šajā pārlūkā atkal tiek skaitīti" : "Jūsu apmeklējumi šajā pārlūkā vairs netiek skaitīti");
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title="Attiecas tikai uz šo pārlūku"
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-[13px] font-semibold ring-1 transition",
        on ? "bg-navy-700 text-white ring-navy-700" : "bg-white text-ink/75 ring-line hover:ring-navy-300",
      )}
    >
      <EyeOff className="h-4 w-4" />
      {on ? "Mani apmeklējumi netiek skaitīti" : "Neskaitīt manus apmeklējumus"}
    </button>
  );
}
