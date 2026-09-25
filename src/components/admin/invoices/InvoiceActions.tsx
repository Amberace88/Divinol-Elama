"use client";

import { Ban, CheckCircle2, FileDown, Undo2 } from "lucide-react";
import { markInvoicePaid, markInvoiceUnpaid, voidInvoice } from "@/lib/admin/actions/invoices";
import { Spinner, useActionRunner, useConfirm } from "../client-ui";
import { btn } from "../styles";

export function InvoiceActions({ id, number, status }: { id: string; number: string; status: string }) {
  const { run, pending } = useActionRunner();
  const confirm = useConfirm();
  return (
    <div className="flex items-center justify-end gap-1">
      <a href={`/api/invoices/${id}/pdf`} target="_blank" rel="noreferrer" className={btn("ghost", "sm")} aria-label={`Atvērt ${number} PDF`} title="PDF">
        <FileDown className="h-4 w-4" />
        <span className="hidden xl:inline">PDF</span>
      </a>
      {status === "issued" && (
        <button type="button" className={btn("outline", "sm")} disabled={pending} onClick={() => run(() => markInvoicePaid(id))} title="Atzīmēt kā apmaksātu">
          {pending ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
          <span className="hidden sm:inline">Apmaksāts</span>
        </button>
      )}
      {status === "paid" && (
        <button
          type="button"
          className={btn("ghost", "sm")}
          disabled={pending}
          title="Atzīmēt kā neapmaksātu"
          aria-label="Atzīmēt kā neapmaksātu"
          onClick={async () => {
            if (await confirm({ title: `Atcelt ${number} apmaksu?`, description: "Rēķina statuss tiks atgriezts uz „Izrakstīts”." })) run(() => markInvoiceUnpaid(id));
          }}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
      )}
      {status !== "void" && (
        <button
          type="button"
          className={btn("ghost", "sm", "text-red-600 hover:bg-red-50")}
          disabled={pending}
          title="Anulēt"
          aria-label={`Anulēt ${number}`}
          onClick={async () => {
            if (
              await confirm({
                title: `Anulēt rēķinu ${number}?`,
                description: "Anulēts rēķins paliek sistēmā (numerācija netiek pārrakstīta), bet netiek ieskaitīts summās. Korekcijām izmantojiet kredītrēķinu.",
                confirmLabel: "Anulēt",
                danger: true,
              })
            )
              run(() => voidInvoice(id));
          }}
        >
          <Ban className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
