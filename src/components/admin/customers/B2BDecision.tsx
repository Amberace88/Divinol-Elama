"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { decideB2B } from "@/lib/admin/actions/customers";
import { Field, Modal, Spinner, useActionRunner, useConfirm } from "../client-ui";
import { btn, inputCls } from "../styles";

export function B2BDecision({
  customerId,
  name,
  discount = 0,
  terms = 14,
  compact,
}: {
  customerId: string;
  name: string;
  discount?: number;
  terms?: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [disc, setDisc] = useState(String(discount));
  const [days, setDays] = useState(String(terms || 14));
  const { run, pending } = useActionRunner();
  const confirm = useConfirm();
  const size = compact ? "sm" : "md";

  return (
    <>
      <div className="flex gap-1.5">
        <button type="button" className={btn("dark", size)} onClick={() => setOpen(true)} disabled={pending}>
          <Check className="h-3.5 w-3.5" /> Apstiprināt
        </button>
        <button
          type="button"
          className={btn("outline", size, "text-red-600")}
          disabled={pending}
          onClick={async () => {
            if (await confirm({ title: `Noraidīt ${name} B2B pieteikumu?`, description: "Klients varēs iepirkties kā privātpersona un iesniegt pieteikumu atkārtoti.", confirmLabel: "Noraidīt", danger: true }))
              run(() => decideB2B(customerId, "rejected"));
          }}
        >
          {pending ? <Spinner className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />} Noraidīt
        </button>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Apstiprināt B2B klientu"
        description={`${name} redzēs cenas bez PVN ar personīgo atlaidi un varēs apmaksāt pēc rēķina.`}
        footer={
          <>
            <button type="button" className={btn("outline")} onClick={() => setOpen(false)}>
              Atcelt
            </button>
            <button
              type="button"
              className={btn("dark")}
              disabled={pending}
              onClick={() =>
                run(() => decideB2B(customerId, "approved", Number(disc.replace(",", ".")) || 0, Math.round(Number(days)) || 0), { onSuccess: () => setOpen(false) })
              }
            >
              {pending && <Spinner />} Apstiprināt
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Atlaide, %" htmlFor="b2b-disc" hint="0–90">
            <input id="b2b-disc" inputMode="decimal" className={inputCls} value={disc} onChange={(e) => setDisc(e.target.value)} />
          </Field>
          <Field label="Apmaksas termiņš, d." htmlFor="b2b-days" hint="0–120">
            <input id="b2b-days" type="number" min={0} max={120} className={inputCls} value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
