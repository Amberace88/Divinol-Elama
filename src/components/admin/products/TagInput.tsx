"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Chip input: Enter / comma / semicolon adds, Backspace removes the last chip, paste splits lists. */
export function TagInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  hint?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const parts = raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const lower = new Set(value.map((v) => v.toLowerCase()));
    const next = [...value];
    for (const p of parts) {
      if (!lower.has(p.toLowerCase())) {
        next.push(p);
        lower.add(p.toLowerCase());
      }
    }
    onChange(next);
    setDraft("");
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-semibold text-ink/80">
          {label}
        </label>
        <span className="text-[11px] text-muted">{value.length}</span>
      </div>
      <div
        className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1.5 transition focus-within:border-navy-400 focus-within:ring-4 focus-within:ring-navy-100"
        onClick={() => document.getElementById(id)?.focus()}
      >
        {value.map((t, i) => (
          <span key={t + i} className="inline-flex items-center gap-1 rounded-md bg-navy-50 py-0.5 pl-2 pr-1 text-[12px] font-semibold text-navy-700 ring-1 ring-inset ring-navy-100">
            {t}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((_, j) => j !== i));
              }}
              className="grid h-4 w-4 place-items-center rounded text-navy-400 hover:bg-navy-100 hover:text-navy-700"
              aria-label={`Noņemt ${t}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === ";") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[,;\n]/.test(text)) {
              e.preventDefault();
              add(draft + text);
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={value.length ? "" : placeholder}
          className={cn("h-7 min-w-[120px] flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-muted/60")}
        />
      </div>
      {hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}
