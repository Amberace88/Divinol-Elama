"use client";

import { useRouter } from "next/navigation";
import { DownloadCloud } from "lucide-react";
import { importNewProducts } from "@/lib/admin/actions/new-products";
import { Spinner, useActionRunner } from "../client-ui";
import { btn } from "../styles";

/** Developer-only: imports the bundled batch of new Divinol products as drafts. */
export function ImportNewBatch({ batchId, label, total, imported }: { batchId: string; label: string; total: number; imported: number }) {
  const router = useRouter();
  const { run, pending } = useActionRunner();
  if (imported >= total) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-navy-200 bg-navy-50 px-4 py-3 text-[13.5px] text-ink">
      <span className="min-w-0 flex-1">
        <strong>{label}:</strong> {total - imported} no {total} produktiem vēl nav pievienoti. Tiks izveidoti kā
        melnraksti bez cenām.
      </span>
      <button
        type="button"
        className={btn("dark")}
        disabled={pending}
        onClick={() => run(() => importNewProducts(batchId), { loading: "Pievieno produktus…", onSuccess: () => router.refresh() })}
      >
        {pending ? <Spinner /> : <DownloadCloud className="h-4 w-4" />} Pievienot produktus
      </button>
    </div>
  );
}
