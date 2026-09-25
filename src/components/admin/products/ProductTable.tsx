"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Boxes, ChevronDown, ChevronsDownUp, ChevronsUpDown, Eye, EyeOff, History, Info, PackageCheck, Percent, Star, StarOff } from "lucide-react";
import { toast } from "sonner";
import { saveVariantInventory } from "@/lib/admin/actions/inventory";
import { bulkSetProductsActive, bulkSetProductsFeatured, setProductFlag } from "@/lib/admin/actions/products";
import { fmtMoney, packLabelOf } from "@/lib/admin/format";
import {
  levelOf,
  STOCK_LEVEL,
  STOCK_LEVELS,
  type Availability,
  type InventoryChange,
  type InventoryRow,
  type InventoryVariant,
  type StockLevel,
} from "@/lib/admin/inventory";
import { cn } from "@/lib/utils";
import { Spinner, Switch, useActionRunner, useConfirm } from "../client-ui";
import { btn } from "../styles";
import { Thumb } from "../Thumb";
import { Pill, TableWrap, td, th, trHover } from "../ui";
import { BulkInventoryModal, type BulkItem, type BulkMode } from "./BulkInventory";
import { InlineInput, PriceCell, StatusCell, StockCell, type PriceMode } from "./InventoryControls";
import { VariantHistoryDrawer, type HistoryTarget } from "./VariantHistory";

export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  sae: string | null;
  iso_vg: string | null;
  base_sku: string | null;
  image: string | null;
  is_active: boolean;
  is_featured: boolean;
  variants: InventoryVariant[];
};

type Override = Partial<Pick<InventoryVariant, "price_net" | "stock" | "availability" | "lead_time_days" | "low_stock_threshold">>;

const fromRow = (r: InventoryRow): Override => ({
  price_net: Number(r.price_net),
  stock: r.stock,
  availability: r.availability,
  lead_time_days: r.lead_time_days,
  low_stock_threshold: r.low_stock_threshold,
});

const LEVEL_PRIORITY: StockLevel[] = ["out_of_stock", "low_stock", "on_order", "in_stock", "discontinued"];

export function ProductTable({ rows, vat, highlight }: { rows: ProductListItem[]; vat: number; highlight?: StockLevel | null }) {
  const [selProducts, setSelProducts] = useState<Set<string>>(new Set());
  const [selVariants, setSelVariants] = useState<Set<string>>(new Set());
  const [flags, setFlags] = useState<Record<string, Partial<Pick<ProductListItem, "is_active" | "is_featured">>>>({});
  const [ov, setOv] = useState<Record<string, Override>>({});
  const [prevRows, setPrevRows] = useState(rows);
  const [expanded, setExpanded] = useState<Set<string>>(() => (highlight ? new Set(rows.map((r) => r.id)) : new Set()));
  const [priceMode, setPriceMode] = useState<PriceMode>("gross");
  const [history, setHistory] = useState<HistoryTarget | null>(null);
  const [bulk, setBulk] = useState<BulkMode | null>(null);
  const [lastBulk, setLastBulk] = useState<BulkMode>("status");
  const [showLegend, setShowLegend] = useState(false);
  const [, startFlag] = useTransition();
  const { run, pending } = useActionRunner();
  const confirm = useConfirm();

  // Fresh server data (after refresh / revalidation) replaces optimistic overrides.
  if (rows !== prevRows) {
    setPrevRows(rows);
    setOv({});
    setFlags({});
  }

  const effective = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        variants: r.variants.map((v) => ({ ...v, ...ov[v.id] })),
      })),
    [rows, ov],
  );
  const variantIndex = useMemo(() => {
    const m = new Map<string, { v: InventoryVariant; p: ProductListItem }>();
    for (const p of effective) for (const v of p.variants) m.set(v.id, { v, p });
    return m;
  }, [effective]);

  const allSelected = rows.length > 0 && rows.every((r) => selProducts.has(r.id));
  const allExpanded = rows.length > 0 && rows.every((r) => expanded.has(r.id));

  function toggleProduct(p: ProductListItem, on?: boolean) {
    const add = on ?? !selProducts.has(p.id);
    setSelProducts((s) => {
      const n = new Set(s);
      if (add) n.add(p.id);
      else n.delete(p.id);
      return n;
    });
    setSelVariants((s) => {
      const n = new Set(s);
      for (const v of p.variants) {
        if (add) n.add(v.id);
        else n.delete(v.id);
      }
      return n;
    });
  }
  function toggleAll() {
    if (allSelected) {
      setSelProducts(new Set());
      setSelVariants(new Set());
    } else {
      setSelProducts(new Set(rows.map((r) => r.id)));
      setSelVariants(new Set(rows.flatMap((r) => r.variants.map((v) => v.id))));
    }
  }
  const toggleVariant = (id: string) =>
    setSelVariants((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const clearSelection = () => {
    setSelProducts(new Set());
    setSelVariants(new Set());
  };
  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // ───────── product flags ─────────
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

  async function bulkProducts(field: "is_active" | "is_featured", value: boolean) {
    const ids = [...selProducts];
    if (!ids.length) return;
    const what =
      field === "is_active" ? (value ? "Aktivizēt" : "Paslēpt") : value ? "Izcelt sākumlapā" : "Noņemt no izceltajiem";
    const ok = await confirm({
      title: `${what}: ${ids.length} ${ids.length === 1 ? "produkts" : "produkti"}?`,
      description: field === "is_active" && !value ? "Paslēptie produkti nebūs redzami veikalā." : undefined,
      confirmLabel: what,
      danger: field === "is_active" && !value,
    });
    if (!ok) return;
    run(() => (field === "is_active" ? bulkSetProductsActive(ids, value) : bulkSetProductsFeatured(ids, value)), {
      onSuccess: () => {
        setFlags((f) => {
          const n = { ...f };
          for (const id of ids) n[id] = { ...n[id], [field]: value };
          return n;
        });
        clearSelection();
      },
    });
  }

  // ───────── inline variant saves (optimistic) ─────────
  async function save(v: InventoryVariant, change: Omit<InventoryChange, "variant_id">, optimistic: Override, okMsg: string) {
    const before: Override = {
      price_net: v.price_net,
      stock: v.stock,
      availability: v.availability,
      lead_time_days: v.lead_time_days,
      low_stock_threshold: v.low_stock_threshold,
    };
    setOv((o) => ({ ...o, [v.id]: { ...o[v.id], ...optimistic } }));
    const res = await saveVariantInventory({ variant_id: v.id, ...change });
    if (res.ok && res.data) {
      const r = res.data;
      setOv((o) => ({ ...o, [v.id]: { ...o[v.id], ...fromRow(r) } }));
      const auto = r.availability !== (optimistic.availability ?? v.availability) ? ` · statuss: ${STOCK_LEVEL[r.availability].label}` : "";
      toast.success(`${okMsg}${auto}`);
    } else {
      setOv((o) => ({ ...o, [v.id]: { ...o[v.id], ...before } }));
      toast.error(res.ok ? "Variants nav atrasts" : res.error);
    }
  }

  function applyRows(rs: InventoryRow[]) {
    setOv((o) => {
      const n = { ...o };
      for (const r of rs) n[r.id] = { ...n[r.id], ...fromRow(r) };
      return n;
    });
  }

  const bulkItems: BulkItem[] = useMemo(
    () =>
      [...selVariants]
        .map((id) => variantIndex.get(id))
        .filter((x): x is { v: InventoryVariant; p: ProductListItem } => Boolean(x))
        .map(({ v, p }) => ({ variant: v, productName: p.name, pack: packLabelOf(v.size, v.unit) })),
    [selVariants, variantIndex],
  );

  const priceRange = (vs: InventoryVariant[]) => {
    const prices = vs.filter((v) => v.is_active).map((v) => v.price_net);
    if (!prices.length) return null;
    return { min: Math.min(...prices), max: Math.max(...prices) };
  };
  const gross = (net: number) => fmtMoney(net * (1 + vat / 100));
  const anySelected = selProducts.size > 0 || selVariants.size > 0;

  return (
    <div className="relative">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-slate-50/50 px-4 py-2 text-[12px] sm:px-5">
        <span className="font-semibold text-muted">Cenas ievade:</span>
        <div className="inline-flex rounded-lg border border-line bg-white p-0.5" role="radiogroup" aria-label="Cenas ievade">
          {(
            [
              ["gross", `ar PVN ${vat}%`],
              ["net", "bez PVN"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={priceMode === k}
              onClick={() => setPriceMode(k)}
              className={cn("rounded-md px-2 py-1 font-bold transition", priceMode === k ? "bg-navy-700 text-white" : "text-muted hover:text-navy-700")}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={btn("ghost", "sm")}
          onClick={() => setExpanded(allExpanded ? new Set() : new Set(rows.map((r) => r.id)))}
        >
          {allExpanded ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
          {allExpanded ? "Sakļaut visus" : "Izvērst visus variantus"}
        </button>
        <button type="button" className={btn("ghost", "sm", "ml-auto")} onClick={() => setShowLegend((s) => !s)} aria-expanded={showLegend}>
          <Info className="h-3.5 w-3.5" /> Statusu skaidrojums
        </button>
      </div>
      <AnimatePresence initial={false}>
        {showLegend && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-line">
            <StockLegend />
          </motion.div>
        )}
      </AnimatePresence>

      {/* bulk bar */}
      <AnimatePresence>
        {anySelected && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="sticky top-0 z-[5] flex flex-wrap items-center gap-2 border-b border-navy-100 bg-navy-50 px-5 py-2.5 text-[13px]"
            role="region"
            aria-label="Grupas darbības"
          >
            <span className="font-bold text-navy-700">
              Atlasīti: {selProducts.size} prod. · {selVariants.size} var.
            </span>
            <span className="mx-1 hidden h-5 w-px bg-navy-200 sm:block" aria-hidden />
            <button type="button" className={btn("dark", "sm")} disabled={!selVariants.size} onClick={() => setBulk("status")}>
              <PackageCheck className="h-3.5 w-3.5" /> Statuss
            </button>
            <button type="button" className={btn("dark", "sm")} disabled={!selVariants.size} onClick={() => setBulk("stock")}>
              <Boxes className="h-3.5 w-3.5" /> Atlikums
            </button>
            <button type="button" className={btn("dark", "sm")} disabled={!selVariants.size} onClick={() => setBulk("price")}>
              <Percent className="h-3.5 w-3.5" /> Cenas
            </button>
            <span className="mx-1 hidden h-5 w-px bg-navy-200 sm:block" aria-hidden />
            <button type="button" className={btn("outline", "sm")} disabled={pending || !selProducts.size} onClick={() => bulkProducts("is_active", true)} title={!selProducts.size ? "Atlasiet produktus" : undefined}>
              {pending ? <Spinner className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} Aktivizēt
            </button>
            <button type="button" className={btn("outline", "sm")} disabled={pending || !selProducts.size} onClick={() => bulkProducts("is_active", false)}>
              <EyeOff className="h-3.5 w-3.5" /> Paslēpt
            </button>
            <button type="button" className={btn("outline", "sm")} disabled={pending || !selProducts.size} onClick={() => bulkProducts("is_featured", true)}>
              <Star className="h-3.5 w-3.5" /> Izcelt
            </button>
            <button type="button" className={btn("outline", "sm")} disabled={pending || !selProducts.size} onClick={() => bulkProducts("is_featured", false)}>
              <StarOff className="h-3.5 w-3.5" /> Neizcelt
            </button>
            <button type="button" className={btn("ghost", "sm", "ml-auto")} onClick={clearSelection}>
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
            <th className={th}>Pieejamība</th>
            <th className={`${th} text-center`}>Aktīvs</th>
            <th className={`${th} text-center`}>Izcelts</th>
          </tr>
        </thead>
        <tbody>
          {effective.map((r) => {
            const active = flags[r.id]?.is_active ?? r.is_active;
            const featured = flags[r.id]?.is_featured ?? r.is_featured;
            const open = expanded.has(r.id);
            const range = priceRange(r.variants);
            const summary = summarize(r.variants);
            const selCount = r.variants.filter((v) => selVariants.has(v.id)).length;
            return (
              <Fragment key={r.id}>
                <tr className={cn(trHover, !active && "opacity-60", selProducts.has(r.id) && "bg-navy-50/50")}>
                  <td className={td}>
                    <input
                      type="checkbox"
                      checked={selProducts.has(r.id)}
                      ref={(el) => {
                        if (el) el.indeterminate = !selProducts.has(r.id) && selCount > 0;
                      }}
                      onChange={() => toggleProduct(r)}
                      aria-label={`Atlasīt ${r.name}`}
                      className="h-4 w-4 rounded accent-navy-700"
                    />
                  </td>
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(r.id)}
                        aria-expanded={open}
                        aria-label={open ? `Sakļaut ${r.name} variantus` : `Rādīt ${r.name} variantus`}
                        className="-ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-navy-50 hover:text-navy-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy-100"
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform", open ? "rotate-0" : "-rotate-90")} />
                      </button>
                      <Thumb src={r.image} size={44} />
                      <div className="min-w-0">
                        <Link href={`/admin/products/${r.id}`} className="font-bold text-ink hover:text-navy-600 hover:underline">
                          {r.name}
                        </Link>
                        <p className="truncate text-[12px] text-muted">
                          {r.base_sku && <span className="font-mono">{r.base_sku} · </span>}
                          <button type="button" onClick={() => toggleExpand(r.id)} className="hover:text-navy-600 hover:underline">
                            {r.variants.length} {r.variants.length === 1 ? "variants" : "varianti"}
                          </button>
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
                      {range ? gross(range.min) : "—"}
                      {range && range.max !== range.min && <> – {gross(range.max)}</>}
                    </p>
                    <p className="text-[11px] tabular-nums text-muted">
                      bez PVN {range ? fmtMoney(range.min) : "—"}
                      {range && range.max !== range.min && <> – {fmtMoney(range.max)}</>}
                    </p>
                  </td>
                  <td className={td}>
                    {summary ? (
                      <button type="button" onClick={() => toggleExpand(r.id)} className="text-left" title="Rādīt variantus">
                        <Pill tone={STOCK_LEVEL[summary.level].tone}>
                          {STOCK_LEVEL[summary.level].label}
                          {summary.detail && <span className="font-normal opacity-80"> · {summary.detail}</span>}
                        </Pill>
                      </button>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
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
                {open && (
                  <tr>
                    <td colSpan={8} className="border-b border-line/70 bg-slate-50/60 p-0">
                      <VariantRows
                        product={r}
                        vat={vat}
                        priceMode={priceMode}
                        selected={selVariants}
                        highlight={highlight ?? null}
                        onToggle={toggleVariant}
                        onHistory={(v) => setHistory({ variant: v, productName: r.name, pack: packLabelOf(v.size, v.unit) })}
                        onSave={save}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </TableWrap>

      <BulkInventoryModal
        key={bulk ? "open" : "closed"}
        open={bulk != null}
        mode={bulk ?? lastBulk}
        onMode={(m) => {
          setBulk(m);
          setLastBulk(m);
        }}
        onClose={() => setBulk(null)}
        items={bulkItems}
        vat={vat}
        onApplied={applyRows}
      />
      <VariantHistoryDrawer target={history} onClose={() => setHistory(null)} vat={vat} />
    </div>
  );
}

function summarize(vs: InventoryVariant[]): { level: StockLevel; detail: string | null } | null {
  const act = vs.filter((v) => v.is_active);
  if (!act.length) return null;
  const levels = act.map(levelOf);
  const tracked = act.filter((v) => v.stock != null);
  const total = tracked.length ? tracked.reduce((s, v) => s + (v.stock ?? 0), 0) : null;
  const uniq = new Set(levels);
  if (uniq.size === 1) {
    const level = levels[0];
    return { level, detail: total != null && level !== "discontinued" ? `${total} gab.` : null };
  }
  const worst = LEVEL_PRIORITY.find((l) => uniq.has(l)) ?? "in_stock";
  const n = levels.filter((l) => l === worst).length;
  return { level: worst, detail: `${n} no ${act.length}` };
}

function VariantRows({
  product,
  vat,
  priceMode,
  selected,
  highlight,
  onToggle,
  onHistory,
  onSave,
}: {
  product: ProductListItem;
  vat: number;
  priceMode: PriceMode;
  selected: Set<string>;
  highlight: StockLevel | null;
  onToggle: (id: string) => void;
  onHistory: (v: InventoryVariant) => void;
  onSave: (v: InventoryVariant, change: Omit<InventoryChange, "variant_id">, optimistic: Override, okMsg: string) => void;
}) {
  const sub = "px-3 py-1.5 text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted";
  if (!product.variants.length) return <p className="px-16 py-3 text-[13px] text-muted">Produktam nav variantu.</p>;
  return (
    <div className="overflow-x-auto py-1.5 pl-12 pr-4 sm:pl-[68px]">
      <table className="w-full min-w-[820px] border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className={cn(sub, "w-8 pl-0")}>
              <span className="sr-only">Atlasīt</span>
            </th>
            <th className={sub}>Iepakojums / SKU</th>
            <th className={cn(sub, "text-right")}>{priceMode === "gross" ? `Cena ar PVN ${vat}%` : "Cena bez PVN"}</th>
            <th className={cn(sub, "text-center")}>Atlikums</th>
            <th className={sub}>Statuss</th>
            <th className={cn(sub, "text-center")} title="Zema atlikuma slieksnis">
              Slieksnis
            </th>
            <th className={sub}>
              <span className="sr-only">Vēsture</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {product.variants.map((v) => {
            const pack = packLabelOf(v.size, v.unit) || "—";
            const label = `${product.name} ${pack}`;
            const level = levelOf(v);
            const hl = highlight && (highlight === level || (highlight === "in_stock" && level === "low_stock"));
            return (
              <tr key={v.id} className={cn("rounded-lg transition-colors hover:bg-white", !v.is_active && "opacity-50", hl && "bg-brand-50/60", selected.has(v.id) && "bg-navy-50/70")}>
                <td className="py-1 pl-0 pr-2 align-middle">
                  <input type="checkbox" checked={selected.has(v.id)} onChange={() => onToggle(v.id)} aria-label={`Atlasīt ${label}`} className="h-4 w-4 rounded accent-navy-700" />
                </td>
                <td className="px-3 py-1 align-middle">
                  <p className="font-bold text-ink">
                    {pack}
                    {!v.is_active && <span className="ml-1.5 text-[11px] font-semibold text-muted">(neaktīvs)</span>}
                  </p>
                  <p className="font-mono text-[11px] text-muted">{v.sku ?? "bez SKU"}</p>
                </td>
                <td className="px-3 py-1 align-middle">
                  <div className="flex justify-end">
                    <PriceCell
                      net={v.price_net}
                      vat={vat}
                      mode={priceMode}
                      label={label}
                      onSave={(net) => onSave(v, { price_net: net }, { price_net: net }, `Cena saglabāta: ${fmtMoney(net * (1 + vat / 100))}`)}
                    />
                  </div>
                </td>
                <td className="px-3 py-1 align-middle">
                  <div className="flex justify-center">
                    <StockCell
                      stock={v.stock}
                      label={label}
                      onDelta={(d) =>
                        onSave(v, { stock_delta: d }, { stock: Math.max(0, (v.stock ?? 0) + d) }, `Atlikums ${d > 0 ? "+" : ""}${d} → ${Math.max(0, (v.stock ?? 0) + d)}`)
                      }
                      onSet={(n) => onSave(v, { stock: n }, { stock: n }, n == null ? "Atlikuma uzskaite izslēgta" : `Atlikums saglabāts: ${n}`)}
                    />
                  </div>
                </td>
                <td className="px-3 py-1 align-middle">
                  <StatusCell
                    availability={v.availability}
                    level={level}
                    leadTime={v.lead_time_days}
                    label={label}
                    onStatus={(a: Availability) => onSave(v, { availability: a }, { availability: a }, `Statuss: ${STOCK_LEVEL[a].label}`)}
                    onLeadTime={(d) => onSave(v, { lead_time_days: d }, { lead_time_days: d }, d == null ? "Termiņš noņemts" : `Piegādes termiņš: ${d} d.`)}
                  />
                </td>
                <td className="px-3 py-1 align-middle">
                  <div className="mx-auto w-[64px]">
                    <ThresholdInput
                      value={v.low_stock_threshold}
                      label={label}
                      onSave={(t) => onSave(v, { low_stock_threshold: t }, { low_stock_threshold: t }, `Zema atlikuma slieksnis: ${t}`)}
                    />
                  </div>
                </td>
                <td className="px-1 py-1 text-right align-middle">
                  <button
                    type="button"
                    onClick={() => onHistory(v)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-muted transition hover:bg-navy-50 hover:text-navy-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy-100"
                    aria-label={`${label}: vēsture`}
                  >
                    <History className="h-3.5 w-3.5" /> Vēsture
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ThresholdInput({ value, label, onSave }: { value: number; label: string; onSave: (n: number) => void }) {
  return (
    <InlineInput
      value={String(value)}
      inputMode="numeric"
      ariaLabel={`${label}: zema atlikuma slieksnis`}
      className="text-center"
      onCommit={(d) => {
        const n = Number(d.trim() || "0");
        if (!Number.isInteger(n) || n < 0 || n > 100000) {
          toast.error("Slieksnim jābūt veselam skaitlim ≥ 0");
          return;
        }
        if (n !== value) onSave(n);
      }}
    />
  );
}

export function StockLegend() {
  return (
    <div className="grid gap-x-6 gap-y-2.5 bg-white px-5 py-4 text-[12.5px] sm:grid-cols-2 xl:grid-cols-3">
      {STOCK_LEVELS.map((l) => (
        <div key={l} className="flex items-start gap-2.5">
          <Pill tone={STOCK_LEVEL[l].tone} className="mt-0.5 shrink-0">
            {STOCK_LEVEL[l].label}
          </Pill>
          <p className="text-muted">{STOCK_LEVEL[l].hint}</p>
        </div>
      ))}
      <p className="text-muted sm:col-span-2 xl:col-span-3">
        <strong className="text-ink">Automātika:</strong> pasūtījums samazina atlikumu (ja tas tiek uzskaitīts); atcelts vai dzēsts pasūtījums to atgriež. Tukšs atlikums = netiek
        uzskaitīts, pasūtīšana nekad netiek bloķēta. Taustiņi: <kbd className="rounded border border-line px-1">Enter</kbd> saglabā,{" "}
        <kbd className="rounded border border-line px-1">Esc</kbd> atceļ.
      </p>
    </div>
  );
}
