"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "./client-ui";

export type FilterField =
  | { type: "search"; name: string; placeholder: string }
  | { type: "select"; name: string; label: string; options: { value: string; label: string }[] }
  | { type: "date"; name: string; label: string };

const ctl =
  "h-9 rounded-lg border border-line bg-white px-3 text-[13px] text-ink outline-none transition focus:border-navy-400 focus:ring-4 focus:ring-navy-100";

/** URL-driven filter bar: every change updates the search params (server-side filtering), resetting pagination. */
export function FilterBar({
  fields,
  values,
  children,
}: {
  fields: FilterField[];
  values: Record<string, string>;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const searchField = fields.find((f) => f.type === "search");
  const [q, setQ] = useState(searchField ? values[searchField.name] ?? "" : "");
  const first = useRef(true);

  function push(overrides: Record<string, string>) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...values, ...overrides })) if (v) usp.set(k, v);
    usp.delete("page");
    const s = usp.toString();
    start(() => router.replace(`${pathname}${s ? `?${s}` : ""}`, { scroll: false }));
  }

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!searchField) return;
    const t = setTimeout(() => {
      if ((values[searchField.name] ?? "") !== q.trim()) push({ [searchField.name]: q.trim() });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [q]);

  const active = fields.some((f) => f.type !== "search" && values[f.name]) || Boolean(q);

  return (
    <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:px-5 lg:flex-row lg:items-center">
      {searchField && (
        <label className="relative flex-1 lg:max-w-sm">
          <span className="sr-only">{searchField.placeholder}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchField.placeholder}
            className={cn(ctl, "w-full pl-9")}
          />
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {fields.map((f) =>
          f.type === "select" ? (
            <label key={f.name} className="flex items-center">
              <span className="sr-only">{f.label}</span>
              <select
                value={values[f.name] ?? ""}
                onChange={(e) => push({ [f.name]: e.target.value })}
                className={cn(ctl, "pr-7", values[f.name] && "border-navy-300 bg-navy-50/60 font-semibold text-navy-700")}
              >
                <option value="">{f.label}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : f.type === "date" ? (
            <label key={f.name} className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
              {f.label}
              <input type="date" value={values[f.name] ?? ""} onChange={(e) => push({ [f.name]: e.target.value })} className={cn(ctl, "px-2")} />
            </label>
          ) : null,
        )}
        {active && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              const cleared = Object.fromEntries(fields.map((f) => [f.name, ""]));
              push(cleared);
            }}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-[13px] font-semibold text-muted transition hover:bg-slate-100 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" /> Notīrīt
          </button>
        )}
        {pending && <Spinner className="text-muted" />}
      </div>
      {children && <div className="flex items-center gap-2 lg:ml-auto">{children}</div>}
    </div>
  );
}
