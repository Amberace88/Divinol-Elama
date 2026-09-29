"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookUser, Pencil, Plus, Trash2 } from "lucide-react";
import { COUNTRY_NAMES, emptyParty, partyContact, type RabenAddress, type RabenParty } from "@/lib/admin/raben";
import { deleteRabenAddress, saveRabenAddress } from "@/lib/admin/actions/raben";
import { EmptyState } from "../ui";
import { Field, Modal, Spinner, useActionRunner, useConfirm } from "../client-ui";
import { btn, inputCls, textareaCls } from "../styles";
import { PartyForm, partyErrors } from "./parts";

type Draft = RabenParty & { label: string; notes: string };

export function AddressBook({ addresses }: { addresses: RabenAddress[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending } = useActionRunner();
  const [edit, setEdit] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [tried, setTried] = useState(false);

  const open = (a: RabenAddress | null) => {
    setTried(false);
    setEdit({
      id: a?.id ?? null,
      draft: a
        ? { ...emptyParty(), ...a, vat_no: a.vat_no ?? "", contact_name: a.contact_name ?? "", phone: a.phone ?? "", email: a.email ?? "", label: a.label ?? "", notes: a.notes ?? "" }
        : { ...emptyParty(), label: "", notes: "" },
    });
  };
  const errors = edit ? partyErrors(edit.draft) : {};

  const submit = () => {
    if (!edit) return;
    if (Object.keys(errors).length) return setTried(true);
    run(() => saveRabenAddress(edit.id, edit.draft), {
      onSuccess: () => {
        setEdit(null);
        router.refresh();
      },
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-line/80 px-5 py-4">
        <p className="text-[13px] text-muted">Bieži lietotās adreses — tās var izvēlēties ar vienu klikšķi, veidojot Raben pasūtījumu.</p>
        <button type="button" className={btn("dark", "sm")} onClick={() => open(null)}>
          <Plus className="h-3.5 w-3.5" /> Jauna adrese
        </button>
      </div>
      {addresses.length === 0 ? (
        <EmptyState icon={BookUser} title="Adrešu grāmata ir tukša" description="Pievienojiet noliktavu, ražotāju un biežākos klientus." />
      ) : (
        <ul className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-col rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="mb-2 flex items-start gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-navy-50 text-[11px] font-extrabold text-navy-700">{a.country}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-ink">{a.label || a.name}</p>
                  {a.label && a.label !== a.name && <p className="truncate text-[12px] text-muted">{a.name}</p>}
                </div>
              </div>
              <p className="text-[13px] text-ink/80">{a.street}</p>
              <p className="text-[13px] text-ink/80">
                {a.postal_code} {a.city}, {COUNTRY_NAMES[a.country] ?? a.country}
              </p>
              {partyContact(a) && <p className="mt-1 text-[12px] text-muted">{partyContact(a)}</p>}
              {a.notes && <p className="mt-1 text-[12px] italic text-muted">{a.notes}</p>}
              <div className="mt-auto flex gap-2 pt-3">
                <button type="button" className={btn("outline", "sm")} onClick={() => open(a)}>
                  <Pencil className="h-3.5 w-3.5" /> Labot
                </button>
                <button
                  type="button"
                  className={btn("ghost", "sm", "text-red-600 hover:bg-red-50")}
                  disabled={pending}
                  onClick={async () => {
                    if (!(await confirm({ title: `Dzēst adresi „${a.label || a.name}”?`, description: "Jau izveidotie Raben pasūtījumi netiks mainīti.", confirmLabel: "Dzēst", danger: true }))) return;
                    run(() => deleteRabenAddress(a.id), { loading: "Dzēš…", onSuccess: () => router.refresh() });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Dzēst
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Labot adresi" : "Jauna adrese"}
        size="lg"
        footer={
          <>
            <button type="button" className={btn("outline")} onClick={() => setEdit(null)}>
              Atcelt
            </button>
            <button type="button" className={btn("dark")} onClick={submit} disabled={pending}>
              {pending && <Spinner />} Saglabāt
            </button>
          </>
        }
      >
        {edit && (
          <div className="space-y-4">
            <Field label="Īsais nosaukums (redzams sarakstā)" htmlFor="ab-label" hint="piem. „BTG noliktava” vai „Klients — SIA Auto”">
              <input id="ab-label" className={inputCls} value={edit.draft.label} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, label: e.target.value } })} />
            </Field>
            <PartyForm value={edit.draft} onChange={(p) => setEdit({ ...edit, draft: { ...edit.draft, ...p } })} errors={tried ? errors : undefined} />
            <Field label="Piezīmes" htmlFor="ab-notes" hint="piem. darba laiks, iebraukšana">
              <textarea id="ab-notes" rows={2} className={textareaCls} value={edit.draft.notes} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, notes: e.target.value } })} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
