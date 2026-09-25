"use client";

import { useId, useRef, useState } from "react";
import { ExternalLink, FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { MAX_DOC_MB, uploadToBucket } from "@/lib/admin/upload";
import { cn } from "@/lib/utils";
import { Spinner } from "../client-ui";
import { btn, inputCls } from "../styles";

/** TDS / SDS PDF: upload to the `documents` bucket or paste a URL. */
export function DocField({ label, value, onChange, folder }: { label: string; value: string; onChange: (v: string) => void; folder: string }) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.type !== "application/pdf") return toast.error("Atļauti tikai PDF faili");
    if (file.size > MAX_DOC_MB * 1024 * 1024) return toast.error(`Fails lielāks par ${MAX_DOC_MB} MB`);
    setBusy(true);
    try {
      const { url } = await uploadToBucket("documents", folder, file);
      onChange(url);
      toast.success(`${label} augšupielādēts`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Augšupielāde neizdevās");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-ink/80">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <FileText className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", value ? "text-navy-500" : "text-muted")} />
          <input id={id} className={cn(inputCls, "pl-9 text-[13px]")} value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… .pdf" />
        </div>
        {value && (
          <>
            <a href={value} target="_blank" rel="noreferrer" className={btn("ghost", "md", "px-2.5")} aria-label={`Atvērt ${label}`}>
              <ExternalLink className="h-4 w-4" />
            </a>
            <button type="button" className={btn("ghost", "md", "px-2.5 text-red-600 hover:bg-red-50")} onClick={() => onChange("")} aria-label={`Noņemt ${label}`}>
              <X className="h-4 w-4" />
            </button>
          </>
        )}
        <button type="button" className={btn("outline")} onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? <Spinner /> : <Upload className="h-4 w-4" />} <span className="hidden sm:inline">Augšupielādēt</span>
        </button>
      </div>
      <input
        ref={ref}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
