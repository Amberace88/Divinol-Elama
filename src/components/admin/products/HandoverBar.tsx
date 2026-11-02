"use client";

import { useRouter } from "next/navigation";
import { EyeOff, Lock, Send, Undo2 } from "lucide-react";
import { setBatchHandover } from "@/lib/admin/actions/new-products";
import { fmtDateTime } from "@/lib/admin/format";
import { Spinner, useActionRunner, useConfirm } from "../client-ui";
import { btn } from "../styles";

/** Developer-only: the new-products batch is hidden from the shop owner's admin until "Nodot klientam". */
export function HandoverBar({ batchId, label, handedAt, count }: { batchId: string; label: string; handedAt: string | null; count: number }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending } = useActionRunner();

  if (handedAt) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13.5px] text-ink">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white">
          <Send className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <strong>{label}: nodots klientam</strong> {fmtDateTime(handedAt)} — Arnis redz šos {count} produktus adminā un var tos pārbaudīt un publicēt.
        </span>
        <button
          type="button"
          className={btn("ghost", "sm")}
          disabled={pending}
          onClick={() => run(() => setBatchHandover(false, batchId), { onSuccess: () => router.refresh() })}
        >
          {pending ? <Spinner /> : <Undo2 className="h-3.5 w-3.5" />} Paslēpt atkal
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-navy-700 bg-navy-700 px-4 py-3 text-[13.5px] text-white shadow-card">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 text-brand-400">
        <Lock className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <strong>{label} — redzams tikai tev.</strong> Šie {count} produkti Arņa adminā un veikalā pagaidām nav redzami
        <EyeOff className="mx-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />. Kad viss pārbaudīts — nodod klientam.
      </span>
      <button
        type="button"
        className={btn("primary")}
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({
            title: "Nodot klientam?",
            description: `Arnis savā adminā redzēs ${count} jaunos produktus (melnrakstus) un varēs ievadīt cenas un publicēt. Veikalā tie parādīsies tikai pēc publicēšanas.`,
            confirmLabel: "Nodot",
          });
          if (ok) run(() => setBatchHandover(true, batchId), { loading: "Nodod…", onSuccess: () => router.refresh() });
        }}
      >
        {pending ? <Spinner /> : <Send className="h-4 w-4" />} Nodot klientam
      </button>
    </div>
  );
}
