"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { CompareOption } from "@/lib/shipping/compare";
import type { ShipmentRow } from "@/lib/shipping/service";
import { btn } from "../styles";
import { NewShipmentForm } from "./NewShipmentForm";
import { ShipmentCard, type CarrierInfo } from "./ShipmentCard";

/** Unified "Piegāde" panel on the admin order page. */
export function OrderShipping({
  orderId,
  shipments,
  carriers,
  options,
  apiCarriers,
  isPickup,
}: {
  orderId: string;
  shipments: ShipmentRow[];
  carriers: CarrierInfo[];
  options: CompareOption[];
  apiCarriers: string[];
  isPickup: boolean;
}) {
  const active = shipments.filter((s) => s.status !== "cancelled");
  const [creating, setCreating] = useState(active.length === 0 && !isPickup);
  const byCode = Object.fromEntries(carriers.map((c) => [c.code, c]));

  return (
    <div className="space-y-4">
      {shipments.map((s) => (
        <ShipmentCard key={s.id} s={s} carrier={byCode[s.carrier]} />
      ))}

      {isPickup && active.length === 0 && !creating && (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-muted">Klients preci saņems noliktavā — sūtījums nav nepieciešams.</p>
      )}

      {creating ? (
        <div className="rounded-xl border border-dashed border-navy-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] font-bold text-ink">Piegādes cenu salīdzinājums un jauns sūtījums</p>
            {(active.length > 0 || isPickup) && (
              <button type="button" className={btn("ghost", "sm")} onClick={() => setCreating(false)}>
                <X className="h-3.5 w-3.5" /> Aizvērt
              </button>
            )}
          </div>
          <NewShipmentForm orderId={orderId} options={options} apiCarriers={apiCarriers} onDone={() => setCreating(false)} />
        </div>
      ) : (
        <button type="button" className={btn("outline")} onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> {active.length ? "Vēl viens sūtījums / salīdzināt cenas" : "Izveidot sūtījumu"}
        </button>
      )}
    </div>
  );
}
