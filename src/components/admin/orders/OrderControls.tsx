"use client";

import { useState } from "react";
import { CheckCircle2, FilePlus2, FileMinus2, FileClock, MessageSquarePlus, Save, Truck, XCircle } from "lucide-react";
import { addOrderComment, createInvoice, setOrderPayment, updateOrderNotes, updateOrderStatus, updateTracking } from "@/lib/admin/actions/orders";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/admin/labels";
import { cn } from "@/lib/utils";
import { Field, Modal, Spinner, useActionRunner, useConfirm } from "../client-ui";
import { btn, inputCls, selectCls, textareaCls } from "../styles";

export function StatusControl({ orderId, status }: { orderId: string; status: string }) {
  const [value, setValue] = useState(status);
  const { run, pending } = useActionRunner();
  const confirm = useConfirm();
  const flow = ["new", "confirmed", "processing", "shipped", "completed"];
  const idx = flow.indexOf(status);
  const next = idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;

  async function save(target: string) {
    if (target === "cancelled" && !(await confirm({ title: "Atcelt pasūtījumu?", description: "Statuss tiks nomainīts uz „Atcelts”, klientam tiks nosūtīts paziņojums, un preču atlikumi tiks automātiski atjaunoti.", confirmLabel: "Atcelt pasūtījumu", danger: true }))) {
      setValue(status);
      return;
    }
    run(() => updateOrderStatus(orderId, target), { onError: () => setValue(status) });
  }

  return (
    <div className="space-y-3">
      <ol className="flex items-center gap-1" aria-label="Pasūtījuma progress">
        {flow.map((s, i) => (
          <li key={s} className="flex-1" title={ORDER_STATUS[s].label}>
            <div
              className={cn(
                "h-1.5 -skew-x-12 rounded-sm transition-colors",
                status === "cancelled" ? "bg-slate-200" : i <= idx ? "bg-brand-400" : "bg-slate-200",
              )}
            />
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="order-status">
          Statuss
        </label>
        <select id="order-status" className={selectCls} value={value} onChange={(e) => setValue(e.target.value)} disabled={pending}>
          {Object.entries(ORDER_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <button type="button" className={btn("dark")} disabled={pending || value === status} onClick={() => save(value)}>
          {pending ? <Spinner /> : <Save className="h-4 w-4" />} Saglabāt
        </button>
      </div>
      {next && (
        <button type="button" className={btn("primary", "md", "w-full")} disabled={pending} onClick={() => save(next)}>
          Pārvietot uz „{ORDER_STATUS[next].label}”
        </button>
      )}
    </div>
  );
}

export function PaymentControl({ orderId, paymentStatus }: { orderId: string; paymentStatus: string }) {
  const { run, pending } = useActionRunner();
  const confirm = useConfirm();
  const paid = paymentStatus === "paid";
  return (
    <div className="flex flex-wrap gap-2">
      {paid ? (
        <button
          type="button"
          className={btn("outline")}
          disabled={pending}
          onClick={async () => {
            if (await confirm({ title: "Atzīmēt kā neapmaksātu?", description: "Apmaksas datums tiks dzēsts." })) run(() => setOrderPayment(orderId, "unpaid"));
          }}
        >
          <XCircle className="h-4 w-4" /> Atzīmēt kā neapmaksātu
        </button>
      ) : (
        <button type="button" className={btn("dark")} disabled={pending} onClick={() => run(() => setOrderPayment(orderId, "paid"))}>
          {pending ? <Spinner /> : <CheckCircle2 className="h-4 w-4" />} Atzīmēt kā apmaksātu
        </button>
      )}
      <label className="sr-only" htmlFor="pay-status">
        Apmaksas statuss
      </label>
      <select
        id="pay-status"
        className={cn(selectCls, "h-9 w-auto flex-1 text-[13px]")}
        value={paymentStatus}
        disabled={pending}
        onChange={(e) => run(() => setOrderPayment(orderId, e.target.value))}
      >
        {Object.entries(PAYMENT_STATUS).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TrackingForm({ orderId, code }: { orderId: string; code: string | null }) {
  const [value, setValue] = useState(code ?? "");
  const { run, pending } = useActionRunner();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateTracking(orderId, value));
      }}
    >
      <label className="sr-only" htmlFor="tracking">
        Sūtījuma kods
      </label>
      <input id="tracking" className={cn(inputCls, "font-mono")} value={value} onChange={(e) => setValue(e.target.value)} placeholder="piem. CC123456789EE" />
      <button type="submit" className={btn("dark")} disabled={pending || value === (code ?? "")}>
        {pending ? <Spinner /> : <Truck className="h-4 w-4" />} Saglabāt
      </button>
    </form>
  );
}

export function NotesForm({ orderId, notes }: { orderId: string; notes: string | null }) {
  const [value, setValue] = useState(notes ?? "");
  const { run, pending } = useActionRunner();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateOrderNotes(orderId, value));
      }}
      className="space-y-2"
    >
      <label className="sr-only" htmlFor="admin-notes">
        Iekšējās piezīmes
      </label>
      <textarea id="admin-notes" rows={4} className={textareaCls} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Redzamas tikai administratoriem…" />
      <div className="flex justify-end">
        <button type="submit" className={btn("outline", "sm")} disabled={pending || value === (notes ?? "")}>
          {pending ? <Spinner /> : <Save className="h-3.5 w-3.5" />} Saglabāt piezīmes
        </button>
      </div>
    </form>
  );
}

export function CommentForm({ orderId }: { orderId: string }) {
  const [value, setValue] = useState("");
  const { run, pending } = useActionRunner();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addOrderComment(orderId, value), { onSuccess: () => setValue("") });
      }}
    >
      <label className="sr-only" htmlFor="order-comment">
        Komentārs vēsturē
      </label>
      <input id="order-comment" className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Pievienot ierakstu vēsturē…" maxLength={1000} />
      <button type="submit" className={btn("outline")} disabled={pending || !value.trim()} aria-label="Pievienot komentāru">
        {pending ? <Spinner /> : <MessageSquarePlus className="h-4 w-4" />}
      </button>
    </form>
  );
}

type InvType = "invoice" | "proforma" | "credit_note";
const INV: Record<InvType, { title: string; button: string; icon: typeof FilePlus2; desc: string }> = {
  invoice: { title: "Izrakstīt rēķinu", button: "Izrakstīt rēķinu", icon: FilePlus2, desc: "Tiks izveidots jauns rēķins (ELA-…) ar pasūtījuma rindām un summām." },
  proforma: { title: "Izrakstīt avansa rēķinu", button: "Avansa rēķins", icon: FileClock, desc: "Tiks izveidots avansa rēķins (PR-…) priekšapmaksai." },
  credit_note: { title: "Izrakstīt kredītrēķinu", button: "Kredītrēķins", icon: FileMinus2, desc: "Tiks izveidots kredītrēķins (KR-…) ar pasūtījuma summām — izmantojiet atgriešanai vai korekcijai." },
};

export function InvoiceButtons({ orderId, defaultDueDays }: { orderId: string; defaultDueDays: number }) {
  const [open, setOpen] = useState<InvType | null>(null);
  const [due, setDue] = useState(String(defaultDueDays));
  const { run, pending } = useActionRunner();
  const cfg = open ? INV[open] : null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(INV) as InvType[]).map((t) => {
          const Icon = INV[t].icon;
          return (
            <button key={t} type="button" className={btn(t === "invoice" ? "dark" : "outline", "sm")} onClick={() => setOpen(t)}>
              <Icon className="h-3.5 w-3.5" /> {INV[t].button}
            </button>
          );
        })}
      </div>
      <Modal
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        size="sm"
        title={cfg?.title ?? ""}
        description={cfg?.desc}
        footer={
          <>
            <button type="button" className={btn("outline")} onClick={() => setOpen(null)}>
              Atcelt
            </button>
            <button
              type="button"
              className={btn(open === "credit_note" ? "danger" : "dark")}
              disabled={pending}
              onClick={() =>
                open &&
                run(() => createInvoice(orderId, open, Number(due)), {
                  loading: "Izraksta…",
                  onSuccess: () => setOpen(null),
                })
              }
            >
              {pending && <Spinner />} Izrakstīt
            </button>
          </>
        }
      >
        {open !== "credit_note" && (
          <Field label="Apmaksas termiņš (dienas)" htmlFor="due-days" hint="Apmaksāt līdz = šodiena + dienas">
            <input id="due-days" type="number" min={0} max={120} className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        )}
      </Modal>
    </>
  );
}
