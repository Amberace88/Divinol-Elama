"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Landmark, Mail, X } from "lucide-react";
import { dismissBankResend, resendBankDetails } from "@/lib/admin/actions/bank";
import type { BankStatus } from "@/lib/admin/bank-details";
import { Spinner, useActionRunner, useConfirm } from "./client-ui";
import { btn } from "./styles";

/** Admin-wide warning: no IBAN in the company settings → proformas go out without bank details. */
export function BankDetailsAlert({ status }: { status: BankStatus }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending } = useActionRunner();

  if (status.ibanMissing) {
    return (
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] text-ink" role="alert">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-500 text-white">
          <Landmark className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <strong>Nav ievadīts bankas konts (IBAN).</strong> Klienti, kas izvēlas bankas pārskaitījumu, saņem avansa rēķinu bez konta numura un nevar samaksāt
          {status.affected ? ` — šobrīd ${status.affected} neapmaksāti rēķini bez IBAN` : ""}.
        </span>
        <Link href="/admin/settings#company" className={btn("primary", "sm")}>
          Ievadīt rekvizītus
        </Link>
      </div>
    );
  }

  const n = status.toResend.length;
  if (!n) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] text-ink">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500 text-white">
        <Mail className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <strong>IBAN pievienots {n} neapmaksātiem rēķiniem.</strong> Šie klienti rēķinu saņēma bez konta numura:{" "}
        {status.toResend.map((it, i) => (
          <span key={it.invoiceId}>
            {i ? ", " : ""}
            <Link href={`/admin/orders/${it.orderId}`} className="font-semibold text-navy-600 hover:underline">
              {it.orderNumber}
            </Link>
          </span>
        ))}
        . Nosūtīt viņiem atjaunoto rēķinu?
      </span>
      <button
        type="button"
        className={btn("primary", "sm")}
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({
            title: `Nosūtīt atjaunoto rēķinu ${n} klientiem?`,
            description: `Katrs saņems pasūtījuma apstiprinājumu ar apmaksas rekvizītiem un avansa rēķinu (PDF) ar IBAN: ${status.toResend.map((t) => `${t.orderNumber} (${t.email})`).join(", ")}.`,
            confirmLabel: "Nosūtīt",
          });
          if (ok) run(() => resendBankDetails(), { loading: "Sūta…", onSuccess: () => router.refresh() });
        }}
      >
        {pending ? <Spinner /> : <Mail className="h-3.5 w-3.5" />} Nosūtīt klientiem
      </button>
      <button
        type="button"
        className={btn("ghost", "sm")}
        disabled={pending}
        title="Nesūtīt (piem. klienti jau informēti pa telefonu)"
        aria-label="Nesūtīt"
        onClick={() => run(() => dismissBankResend(), { onSuccess: () => router.refresh() })}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
