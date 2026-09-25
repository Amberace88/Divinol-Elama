import { Skeleton } from "@/components/admin/ui";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Ielādē">
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="mb-7 h-8 w-64" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <Skeleton className="mb-3 h-3 w-20" />
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-line bg-white shadow-card">
        <div className="border-b border-line p-5">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="space-y-3 p-5">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
