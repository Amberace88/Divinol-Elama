"use client";

import { RefreshCw } from "lucide-react";
import { recheckPayment } from "@/lib/admin/actions/payments";
import { Spinner, useActionRunner } from "../client-ui";
import { btn } from "../styles";

export function PaymentRecheckButton({ orderId }: { orderId: string }) {
  const { run, pending } = useActionRunner();
  return (
    <button type="button" className={btn("outline", "md", "w-full")} disabled={pending} onClick={() => run(() => recheckPayment(orderId), { loading: "Pārbauda Montonio…" })}>
      {pending ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Atkārtoti pārbaudīt maksājumu
    </button>
  );
}
