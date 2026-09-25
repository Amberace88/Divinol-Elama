"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff, Star } from "lucide-react";
import { toast } from "sonner";
import { bulkSetProductsActive, setProductFlag } from "@/lib/admin/actions/products";
import { fmtMoney } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { Spinner, Switch, useActionRunner } from "../client-ui";
import { btn } from "../styles";
import { Thumb } from "../Thumb";
import { Pill, TableWrap, td, th, trHover } from "../ui";

export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  sae: string | null;
  iso_vg: string | null;
  base_sku: string | null;
  image: string | null;
  variants: number;
  minNet: number | null;
  maxNet: number | null;
  stock: "ok" | "low" | "out" | "untracked";
  stockTotal: number | null;
  is_active: boolean;
  is_featured: boolean;
};

const STOCK: Record<ProductListItem["stock"], { label: string; tone: "green" | "yellow" | "red" | "gray" }> = {
  ok: { label: "Noliktavā", tone: "green" },
  low: { label: "Zems atlikums", tone: "yellow" },
  out: { label: "Nav noliktavā", tone: "red" },
  untracked: { label: "Pieejams", tone: "gray" },
};

export function ProductTable({ rows, vat }: { rows: ProductListItem[]; vat: number }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [flags, setFlags] = useState<Record<string, Partial<Pick<ProductListItem, "is_active" | "is_featured">>>>({});
  const [, startFlag] = useTransition();
  const { run, pending } = useActionRunner();

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  function flip(row: ProductListItem, field: "is_active" | "is_featured", value: boolean) {
    setFlags((f) => ({ ...f, [row.id]: { ...f[row.id], [field]: value } }));
    startFlag(async () => {
      const res = await setProductFlag(row.id, field, value);
      if (res.ok) toast.success(res.message ?? "Saglabāts");
      else {
        toast.error(res.error);
        setFlags((f) => ({ ...f, [row.id]: { ...f[row.id], [field]: !value } }));
      }
    });
  }

  function bulk(value: boolean) {
    const ids = [...selected];
    run(() => bulkSetProductsActive(ids, value), {
      onSuccess: () => {
        setFlags((f) => {
          const n = { ...f };
          for (const id of ids) n[id] = { ...n[id], is_active: value };
          return n;
        });
        setSelected(new Set());
      },
    });
  }

  const price = (net: number | null) => (net == null ? "—" : fmtMoney(net * (1 + vat / 100)));

  return (
    <div className="relative">
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-wrap items-center gap-2 border-b border-navy-100 bg-navy-50 px-5 py-2.5 text-[13px]"
            role="region"
            aria-label="Grupas darbības"
          >
            <span className="font-bold text-navy-700">Atlasīti: {selected.size}</span>
            <button type="button" className={btn("dark", "sm")} disabled={pending} onClick={() => bulk(true)}>
              {pending ? <Spinner className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} Aktivizēt
            </button>
            <button type="button" className={btn("outline", "sm")} disabled={pending} onClick={() => bulk(false)}>
              <EyeOff className="h-3.5 w-3.5" /> Paslēpt
            </button>
            <button type="button" className={btn("ghost", "sm", "ml-auto")} onClick={() => setSelected(new Set())}>
              Notīrīt atlasi
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <TableWrap>
        <thead>
          <tr>
            <th className={cn(th, "w-10")}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Atlasīt visus" className="h-4 w-4 rounded accent-navy-700" />
            </th>
            <th className={th}>Produkts</th>
            <th className={th}>Kategorija</th>
            <th className={th}>SAE / ISO</th>
            <th className={`${th} text-right`}>Cena ar PVN (LV)</th>
            <th className={th}>Atlikums</th>
            <th className={`${th} text-center`}>Aktīvs</th>
            <th className={`${th} text-center`}>Izcelts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const active = flags[r.id]?.is_active ?? r.is_active;
            const featured = flags[r.id]?.is_featured ?? r.is_featured;
            const s = STOCK[r.stock];
            return (
              <tr key={r.id} className={cn(trHover, !active && "opacity-60", selected.has(r.id) && "bg-navy-50/50")}>
                <td className={td}>
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    aria-label={`Atlasīt ${r.name}`}
                    className="h-4 w-4 rounded accent-navy-700"
                  />
                </td>
                <td className={td}>
                  <div className="flex items-center gap-3">
                    <Thumb src={r.image} size={44} />
                    <div className="min-w-0">
                      <Link href={`/admin/products/${r.id}`} className="font-bold text-ink hover:text-navy-600 hover:underline">
                        {r.name}
                      </Link>
                      <p className="truncate text-[12px] text-muted">
                        {r.base_sku && <span className="font-mono">{r.base_sku} · </span>}
                        {r.variants} {r.variants === 1 ? "variants" : "varianti"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className={`${td} text-muted`}>{r.category ?? <span className="text-orange-600">Bez kategorijas</span>}</td>
                <td className={td}>
                  {r.sae || r.iso_vg ? (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[12px] font-bold text-ink">{r.sae ?? `ISO VG ${r.iso_vg}`}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  <p className="font-bold tabular-nums text-ink">
                    {price(r.minNet)}
                    {r.maxNet != null && r.minNet != null && r.maxNet !== r.minNet && <> – {price(r.maxNet)}</>}
                  </p>
                  <p className="text-[11px] tabular-nums text-muted">
                    bez PVN {r.minNet == null ? "—" : fmtMoney(r.minNet)}
                    {r.maxNet != null && r.minNet != null && r.maxNet !== r.minNet && <> – {fmtMoney(r.maxNet)}</>}
                  </p>
                </td>
                <td className={td}>
                  <Pill tone={s.tone} dot>
                    {s.label}
                    {r.stockTotal != null && <span className="font-normal opacity-80"> · {r.stockTotal}</span>}
                  </Pill>
                </td>
                <td className={`${td} text-center`}>
                  <Switch size="sm" checked={active} onChange={(v) => flip(r, "is_active", v)} label={`${r.name}: aktīvs`} />
                </td>
                <td className={`${td} text-center`}>
                  <button
                    type="button"
                    onClick={() => flip(r, "is_featured", !featured)}
                    aria-pressed={featured}
                    aria-label={`${r.name}: izcelts`}
                    title={featured ? "Noņemt no izceltajiem" : "Izcelt sākumlapā"}
                    className="rounded-lg p-1.5 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy-100"
                  >
                    <Star className={cn("h-[18px] w-[18px] transition", featured ? "fill-brand-400 text-brand-500" : "text-slate-300")} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
    </div>
  );
}
