"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { btn } from "@/components/admin/styles";

export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-line bg-white p-8 text-center shadow-card" role="alert">
      <div className="mx-auto grid h-12 w-12 -skew-x-6 place-items-center rounded-2xl bg-red-50 text-red-600">
        <AlertTriangle className="h-6 w-6 skew-x-6" aria-hidden />
      </div>
      <h1 className="mt-5 text-xl font-extrabold text-ink">Kaut kas nogāja greizi</h1>
      <p className="mt-2 text-[14px] text-muted">
        Sadaļu neizdevās ielādēt. Pārbaudiet savienojumu un mēģiniet vēlreiz.
        {error.digest && <span className="mt-2 block font-mono text-[11px] text-muted/70">Kods: {error.digest}</span>}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" onClick={() => retry()} className={btn("dark")}>
          <RotateCcw className="h-4 w-4" /> Mēģināt vēlreiz
        </button>
        <Link href="/admin" className={btn("outline")}>
          Uz pārskatu
        </Link>
      </div>
    </div>
  );
}
