import { Skeleton } from "./ui";

export function HeaderSkeleton({ actions = true }: { actions?: boolean }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <Skeleton className="mb-2 h-3.5 w-20" />
        <Skeleton className="h-8 w-56" />
      </div>
      {actions && <Skeleton className="h-9 w-36" />}
    </div>
  );
}

export function TableSkeleton({ rows = 10, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div aria-busy="true" aria-label="Ielādē">
      <HeaderSkeleton />
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="border-b border-line bg-slate-50/80 px-5 py-3">
          <Skeleton className="h-3 w-2/3" />
        </div>
        <ul>
          {Array.from({ length: rows }).map((_, i) => (
            <li key={i} className="flex items-center gap-4 border-b border-line/70 px-5 py-3.5" style={{ opacity: 1 - i * 0.06 }}>
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              {Array.from({ length: cols - 1 }).map((__, j) => (
                <Skeleton key={j} className={j === 0 ? "h-4 flex-[2]" : "h-4 flex-1"} />
              ))}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Ielādē">
      <HeaderSkeleton />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {[260, 180, 220].map((h, i) => (
            <div key={i} className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <Skeleton className="mb-4 h-4 w-40" />
              <div style={{ height: h }} className="space-y-3">
                {Array.from({ length: Math.round(h / 44) }).map((_, j) => (
                  <Skeleton key={j} className="h-8 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-6">
          {[160, 200, 140].map((h, i) => (
            <div key={i} className="rounded-2xl border border-line bg-white p-5 shadow-card" style={{ minHeight: h }}>
              <Skeleton className="mb-4 h-4 w-28" />
              <Skeleton className="mb-2 h-3.5 w-full" />
              <Skeleton className="mb-2 h-3.5 w-4/5" />
              <Skeleton className="h-3.5 w-3/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
