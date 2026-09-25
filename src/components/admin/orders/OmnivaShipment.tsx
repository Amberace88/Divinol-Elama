"use client";

import { useState } from "react";
import { ExternalLink, PackageCheck, Printer } from "lucide-react";
import { createOmnivaShipmentAction } from "@/lib/admin/actions/shipping";
import { Spinner, useActionRunner } from "../client-ui";
import { btn, inputCls } from "../styles";

export function OmnivaShipment({
  orderId,
  trackingCode,
  eligible,
  configured,
  defaultWeight,
  trackingUrl,
}: {
  orderId: string;
  trackingCode: string | null;
  eligible: boolean;
  configured: boolean;
  defaultWeight: number;
  trackingUrl: string | null;
}) {
  const [weight, setWeight] = useState(String(defaultWeight.toFixed(1)));
  const [markShipped, setMarkShipped] = useState(true);
  const { run, pending } = useActionRunner();

  if (trackingCode) {
    return (
      <div className="flex flex-wrap gap-2">
        <a href={`/api/admin/orders/${orderId}/omniva-label`} target="_blank" rel="noopener" className={btn("dark")}>
          <Printer className="h-4 w-4" /> Omniva uzlīme (PDF)
        </a>
        {trackingUrl && (
          <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className={btn("outline")}>
            <ExternalLink className="h-4 w-4" /> Izsekot
          </a>
        )}
      </div>
    );
  }

  if (!eligible) {
    return <p className="text-[12.5px] text-muted">Omniva sūtījums pieejams pakomāta un kurjera piegādēm.</p>;
  }

  if (!configured) {
    return (
      <p className="rounded-xl bg-amber-50 p-3 text-[12.5px] leading-5 text-amber-900 ring-1 ring-amber-200">
        Lai izveidotu sūtījumus un drukātu uzlīmes automātiski, Netlify vides mainīgajos pievienojiet Omniva līguma datus:
        <code className="mx-1 font-mono">OMNIVA_USERNAME</code>, <code className="mx-1 font-mono">OMNIVA_PASSWORD</code>,
        <code className="mx-1 font-mono">OMNIVA_CUSTOMER_CODE</code>. Līdz tam kodu var ievadīt manuāli.
      </p>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createOmnivaShipmentAction(orderId, Number(weight.replace(",", ".")), markShipped));
      }}
    >
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-[12px] font-bold text-muted">Svars (kg)</span>
          <input className={inputCls} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <button type="submit" className={btn("primary")} disabled={pending}>
          {pending ? <Spinner /> : <PackageCheck className="h-4 w-4" />} Izveidot Omniva sūtījumu
        </button>
      </div>
      <label className="flex items-center gap-2 text-[13px] text-ink/80">
        <input type="checkbox" checked={markShipped} onChange={(e) => setMarkShipped(e.target.checked)} className="h-4 w-4 accent-navy-700" />
        Atzīmēt pasūtījumu kā „Nosūtīts”
      </label>
    </form>
  );
}
