"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { applyInventoryImport, previewInventoryImport, type ImportPreview } from "@/lib/admin/actions/inventory";
import { Modal, Spinner, useActionRunner, useConfirm } from "../client-ui";
import { btn } from "../styles";
import { Pill } from "../ui";

const FIELD_LABEL = { price: "Cena", stock: "Atlikums", status: "Statuss" } as const;

/** Export link + CSV import (diff preview → apply in one transaction). */
export function InventoryCsvButtons() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { run, pending } = useActionRunner();
  const confirm = useConfirm();

  function reset() {
    setFile(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onFile(f: File | undefined) {
    reset();
    if (!f) return;
    if (f.size > 2_000_000) {
      setError("Fails ir pārāk liels (maks. 2 MB).");
      return;
    }
    const buf = await f.arrayBuffer();
    // Excel on Windows may save CSV as windows-1257 (Baltic) — fall back when UTF-8 decoding fails.
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    } catch {
      text = new TextDecoder("windows-1257").decode(buf);
    }
    setFile({ name: f.name, text });
    setLoading(true);
    const res = await previewInventoryImport(text);
    setLoading(false);
    if (res.ok) setPreview(res.data);
    else setError(res.error);
  }

  async function apply() {
    if (!file || !preview) return;
    const n = preview.diff.length;
    const ok = await confirm({
      title: `Piemērot izmaiņas ${n} ${n === 1 ? "variantam" : "variantiem"}?`,
      description: "Cenas, atlikumi un statusi tiks atjaunināti vienā darījumā un saglabāti vēsturē ar iemeslu “CSV imports”. Veikals atjaunosies uzreiz.",
      confirmLabel: "Importēt",
      danger: true,
    });
    if (!ok) return;
    run(() => applyInventoryImport(file.text, file.name), {
      loading: "Importē…",
      onSuccess: () => {
        setOpen(false);
        reset();
        router.refresh();
      },
    });
  }

  return (
    <>
      <a href="/api/admin/inventory/export" className={btn("outline")} download>
        <Download className="h-4 w-4" /> Eksportēt CSV
      </a>
      <button type="button" className={btn("outline")} onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> Importēt cenas/atlikumus
      </button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        size="lg"
        title="Cenu un atlikumu imports (CSV)"
        description="Atjaunina esošos variantus pēc SKU. Jauni produkti netiek veidoti."
        footer={
          <>
            <button type="button" className={btn("outline")} onClick={() => setOpen(false)} disabled={pending}>
              Aizvērt
            </button>
            <button type="button" className={btn("dark")} onClick={apply} disabled={pending || loading || !preview || preview.diff.length === 0}>
              {pending ? <Spinner /> : <CheckCircle2 className="h-4 w-4" />}
              {preview ? `Piemērot ${preview.diff.length} izmaiņas` : "Piemērot"}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-[13px]">
          <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-muted">
            <p>
              Kolonnas: <strong className="text-ink">SKU</strong>, Produkts, Iepakojums, <strong className="text-ink">Cena bez PVN</strong>,{" "}
              <strong className="text-ink">Cena ar PVN (LV)</strong>, <strong className="text-ink">Atlikums</strong>, <strong className="text-ink">Statuss</strong>. Atdalītājs “;” vai “,”,
              decimālā komats vai punkts. Tukša šūna = nemainīt. Ja mainīta cena ar PVN, tā ir noteicošā; citādi tiek ņemta cena bez PVN.
            </p>
            <p className="mt-1.5">Ērtākais veids: eksportējiet CSV, labojiet Excel vai grāmatvedības programmā un importējiet atpakaļ.</p>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-6 text-center transition hover:border-navy-300 hover:bg-navy-50/40">
            <FileSpreadsheet className="h-6 w-6 text-navy-600" aria-hidden />
            <span className="font-bold text-ink">{file ? file.name : "Izvēlieties CSV failu"}</span>
            <span className="text-[12px] text-muted">.csv, līdz 2 MB</span>
            <input ref={inputRef} type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>

          {loading && (
            <p className="flex items-center gap-2 text-muted">
              <Spinner /> Salīdzina ar esošajiem datiem…
            </p>
          )}
          {error && <p className="rounded-xl bg-red-50 px-3.5 py-3 text-red-700">{error}</p>}

          {preview && (
            <>
              <div className="flex flex-wrap gap-2">
                <Pill tone="navy">Rindas: {preview.total}</Pill>
                <Pill tone="green">Mainīsies: {preview.diff.length}</Pill>
                <Pill tone="gray">Bez izmaiņām: {preview.unchanged}</Pill>
                {preview.errors.length > 0 && <Pill tone="red">Kļūdas: {preview.errors.length}</Pill>}
              </div>

              {preview.errors.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50/60">
                  <p className="flex items-center gap-2 border-b border-red-200 px-3.5 py-2 font-bold text-red-700">
                    <AlertTriangle className="h-4 w-4" /> Šīs rindas tiks izlaistas
                  </p>
                  <ul className="max-h-[140px] overflow-y-auto px-3.5 py-2 text-[12px] text-red-800">
                    {preview.errors.map((e, i) => (
                      <li key={i}>
                        <span className="font-mono">#{e.line}</span> {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.diff.length === 0 ? (
                <p className="rounded-xl bg-emerald-50 px-3.5 py-3 text-emerald-800">Izmaiņu nav — dati jau sakrīt.</p>
              ) : (
                <div className="max-h-[340px] overflow-y-auto rounded-xl border border-line">
                  <table className="w-full border-separate border-spacing-0 text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                        <th className="sticky top-0 border-b border-line bg-slate-50 px-3 py-2">SKU / produkts</th>
                        <th className="sticky top-0 border-b border-line bg-slate-50 px-3 py-2">Izmaiņas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.diff.map((d) => (
                        <tr key={d.variant_id}>
                          <td className="w-[42%] border-b border-line/70 px-3 py-2 align-top">
                            <p className="font-mono text-[11px] text-muted">{d.sku ?? "bez SKU"}</p>
                            <p className="font-semibold text-ink">
                              {d.name}
                              {d.pack && <span className="font-normal text-muted"> · {d.pack}</span>}
                            </p>
                          </td>
                          <td className="border-b border-line/70 px-3 py-2 align-top">
                            <ul className="space-y-0.5">
                              {d.fields.map((f) => (
                                <li key={f.field} className="flex flex-wrap items-center gap-1.5">
                                  <span className="w-16 text-[11px] font-bold uppercase text-muted">{FIELD_LABEL[f.field]}</span>
                                  <span className="text-muted line-through decoration-slate-300">{f.from}</span>
                                  <ArrowRight className="h-3 w-3 text-muted" aria-hidden />
                                  <strong className="text-ink">{f.to}</strong>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    </table>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
