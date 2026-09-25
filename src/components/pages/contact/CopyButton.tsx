"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyButton({ value, label, doneLabel, className }: { value: string; label: string; doneLabel: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard unavailable */
        }
      }}
      aria-label={`${done ? doneLabel : label}: ${value}`}
      title={done ? doneLabel : label}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-md text-navy-400 transition hover:bg-navy-50 hover:text-navy-700",
        done && "text-success",
        className,
      )}
    >
      {done ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}
