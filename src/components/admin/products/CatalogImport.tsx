"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, DatabaseZap, Download } from "lucide-react";
import { toast } from "sonner";
import { importCatalogChunk } from "@/lib/admin/actions/catalog";
import { Modal, Spinner, useConfirm } from "../client-ui";
import { btn } from "../styles";

type Totals = { categories: number; products: number; variants: number };

function useImporter() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; chunks: number } | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setRunning(true);
    setError(null);
    setTotals(null);
    const acc: Totals = { categories: 0, products: 0, variants: 0 };
    let chunks = 1;
    try {
      for (let i = 0; i < chunks; i++) {
        const res = await importCatalogChunk(i);
        if (!res.ok) throw new Error(res.error);
        chunks = res.data.chunks;
        acc.categories += res.data.counts.categories;
        acc.products += res.data.counts.products;
        acc.variants += res.data.counts.variants;
        setProgress({ done: i + 1, chunks });
      }
      setTotals(acc);
      toast.success(`Importēti ${acc.products} produkti un ${acc.variants} varianti`);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Imports neizdevās";
      setError(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  }
  return { start, running, progress, totals, error };
}

function Progress({ progress, totals, error }: { progress: { done: number; chunks: number } | null; totals: Totals | null; error: string | null }) {
  const pct = progress ? Math.round((progress.done / progress.chunks) * 100) : 0;
  return (
    <div className="space-y-3" aria-live="polite">
      {progress && (
        <div>
          <div className="mb-1.5 flex justify-between text-[12px] font-semibold text-muted">
            <span>
              Daļa {progress.done} no {progress.chunks}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500" animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
          </div>
        </div>
      )}
      {totals && (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-[13px] text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Gatavs! Kategorijas: <strong>{totals.categories}</strong>, produkti: <strong>{totals.products}</strong>, varianti: <strong>{totals.variants}</strong>.
          </span>
        </div>
      )}
      {error && <p className="rounded-xl bg-red-50 px-3.5 py-3 text-[13px] text-red-700">{error}</p>}
    </div>
  );
}

/** Prominent card shown when the database has no products yet. */
export function CatalogImportHero({ productCount }: { productCount: number }) {
  const { start, running, progress, totals, error } = useImporter();
  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl bg-navy-700 p-6 text-white shadow-lift sm:p-8">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-400/25 blur-3xl" aria-hidden />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="grid h-14 w-14 shrink-0 -skew-x-12 place-items-center rounded-2xl bg-brand-400 text-navy-900 shadow-glow">
          <DatabaseZap className="h-7 w-7 skew-x-12" />
        </div>
        <div className="flex-1">
          <p className="eyebrow !text-brand-400">Pirmie soļi</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">Importēt sākotnējo katalogu</h2>
          <p className="mt-1.5 max-w-2xl text-[14px] text-white/70">
            {productCount === 0
              ? "Datubāzē vēl nav produktu. Importējiet iebūvēto Divinol katalogu (kategorijas, produkti ar 5 valodu tekstiem, attēli un varianti ar cenām) — pēc tam visu varēsiet rediģēt šeit."
              : "Atjauno kategorijas un produktus no iebūvētā kataloga."}
          </p>
          {(progress || totals || error) && (
            <div className="mt-4 max-w-xl rounded-xl bg-white p-4 text-ink">
              <Progress progress={progress} totals={totals} error={error} />
            </div>
          )}
        </div>
        <button type="button" onClick={start} disabled={running || Boolean(totals)} className={btn("primary", "md", "h-11 px-5 text-[14px]")}>
          {running ? <Spinner /> : <Download className="h-4 w-4" />}
          {running ? "Importē…" : totals ? "Importēts" : "Sākt importu"}
        </button>
      </div>
    </section>
  );
}

/** Secondary entry point (products page actions) — always available. */
export function CatalogImportButton() {
  const [open, setOpen] = useState(false);
  const { start, running, progress, totals, error } = useImporter();
  const confirm = useConfirm();
  return (
    <>
      <button type="button" className={btn("outline")} onClick={() => setOpen(true)}>
        <DatabaseZap className="h-4 w-4" /> Importēt katalogu
      </button>
      <Modal
        open={open}
        onClose={() => !running && setOpen(false)}
        title="Importēt sākotnējo katalogu"
        description="Iebūvētais Divinol katalogs: kategorijas, produkti, attēli un varianti ar cenām."
        footer={
          <>
            <button type="button" className={btn("outline")} onClick={() => setOpen(false)} disabled={running}>
              Aizvērt
            </button>
            <button
              type="button"
              className={btn("dark")}
              disabled={running}
              onClick={async () => {
                if (
                  await confirm({
                    title: "Pārrakstīt esošos datus?",
                    description:
                      "Produkti un kategorijas ar tādu pašu slug tiks atjaunināti no kataloga (nosaukumi, apraksti, attēli, cenas). Jūsu pievienotie produkti netiks dzēsti.",
                    confirmLabel: "Importēt",
                    danger: true,
                  })
                )
                  start();
              }}
            >
              {running ? <Spinner /> : <Download className="h-4 w-4" />} {running ? "Importē…" : "Sākt importu"}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-[13px] text-muted">
          <p>Imports notiek pa daļām (~15 produkti), tāpēc lūdzam neaizvērt logu, līdz tas ir pabeigts. Cenas tiek pārrēķinātas uz summām bez PVN (cena ar PVN ÷ 1,21).</p>
          <Progress progress={progress} totals={totals} error={error} />
        </div>
      </Modal>
    </>
  );
}
