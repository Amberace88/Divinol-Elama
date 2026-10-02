"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, Eraser, Minus, Pencil, Plus, Search, Star, Tag, Tags, X } from "lucide-react";
import { bulkSetProductsFeatured, bulkSetPromo, bulkToggleBadge } from "@/lib/admin/actions/products";
import { fmtMoney } from "@/lib/admin/format";
import { BADGE_KEYS, BADGE_LABEL_LV, promoStatus, rigaDayEnd, rigaDayStart, type BadgeKey, type ProductPromo } from "@/lib/promo";
import { cn } from "@/lib/utils";
import { Spinner, useActionRunner, useConfirm } from "../client-ui";
import { btn, inputCls, selectCls } from "../styles";
import { EmptyState, TableWrap, td, th, trHover } from "../ui";
import { parseDec } from "../products/VariantsEditor";
import { BADGE_ICON, PromoEditor, type PromoFormValue } from "./PromoEditor";
import { PromoMarks } from "./PromoMarks";

export type PromoRow = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  category: { id: string; name: string } | null;
  is_active: boolean;
  is_featured: boolean;
  badges: string[];
  promo: ProductPromo | null;
  /** cheapest active pack incl. 21% VAT */
  minGross: number | null;
  /** lowest margin % among packs with a purchase cost */
  minMargin: number | null;
};

type View = "all" | "active" | "scheduled" | "ended" | "none" | "badges" | "featured";
const VIEWS: { id: View; label: string }[] = [
  { id: "all", label: "Visi" },
  { id: "active", label: "Aktīvās akcijas" },
  { id: "scheduled", label: "Ieplānotās" },
  { id: "ended", label: "Beigušās" },
  { id: "none", label: "Bez akcijas" },
  { id: "badges", label: "Ar nozīmītēm" },
  { id: "featured", label: "Izceltie sākumlapā" },
];

const EMPTY_PROMO: PromoFormValue = { promo_type: "sale", promo_percent: "10", promo_start: "", promo_end: "", badges: [] };

export function PromotionsManager({ rows }: { rows: PromoRow[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending } = useActionRunner();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [view, setView] = useState<View>("all");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [promo, setPromo] = useState<PromoFormValue>(EMPTY_PROMO);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const status = useMemo(() => new Map(rows.map((r) => [r.id, promoStatus(r.promo)])), [rows]);
  const stats = useMemo(() => {
    const c = { active: 0, scheduled: 0, ended: 0, badges: 0, featured: 0 };
    for (const r of rows) {
      const s = status.get(r.id);
      if (s === "active") c.active++;
      if (s === "scheduled") c.scheduled++;
      if (s === "ended") c.ended++;
      if (r.badges.length) c.badges++;
      if (r.is_featured) c.featured++;
    }
    return c;
  }, [rows, status]);

  const categories = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.category) m.set(r.category.id, r.category.name);
    return [...m].sort((a, b) => a[1].localeCompare(b[1], "lv"));
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle && !`${r.name} ${r.slug}`.toLowerCase().includes(needle)) return false;
      if (cat && r.category?.id !== cat) return false;
      const s = status.get(r.id);
      switch (view) {
        case "active":
        case "scheduled":
        case "ended":
          return s === view;
        case "none":
          return s === "none";
        case "badges":
          return r.badges.length > 0;
        case "featured":
          return r.is_featured;
        default:
          return true;
      }
    });
  }, [rows, q, cat, view, status]);

  const ids = [...sel];
  const allShown = shown.length > 0 && shown.every((r) => sel.has(r.id));
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const done = () => router.refresh();

  const pct = parseDec(promo.promo_percent) ?? 0;
  const lossy = rows.filter((r) => sel.has(r.id) && r.minMargin != null && pct >= r.minMargin);

  const applyPromo = async () => {
    setErrors({});
    if (!promo.promo_type) return removePromo(ids);
    if (lossy.length && !(await confirm({ title: `${lossy.length} produktiem atlaide pārsniedz uzcenojumu`, description: "Šiem produktiem akcijas cena būs zem iepirkuma cenas. Turpināt?", confirmLabel: "Piemērot tik un tā", danger: true })))
      return;
    run(
      () =>
        bulkSetPromo(ids, {
          promo_type: promo.promo_type || null,
          promo_percent: promo.promo_percent.trim() ? parseDec(promo.promo_percent) : null,
          promo_starts_at: rigaDayStart(promo.promo_start),
          promo_ends_at: rigaDayEnd(promo.promo_end),
        }),
      { loading: "Piemēro akciju…", onSuccess: () => (setSel(new Set()), done()), onError: (_e, fe) => fe && setErrors(fe) },
    );
  };

  const removePromo = async (list: string[]) => {
    if (!list.length) return;
    if (list.length > 1 && !(await confirm({ title: `Noņemt akciju ${list.length} produktiem?`, confirmLabel: "Noņemt" }))) return;
    run(() => bulkSetPromo(list, null), { loading: "Noņem…", onSuccess: () => (setSel((s) => new Set([...s].filter((x) => !list.includes(x)))), done()) });
  };

  const badge = (b: BadgeKey, add: boolean) => run(() => bulkToggleBadge(ids, b, add), { loading: "Saglabā…", onSuccess: done });
  const featured = (value: boolean) => run(() => bulkSetProductsFeatured(ids, value), { loading: "Saglabā…", onSuccess: done });
  const ended = rows.filter((r) => status.get(r.id) === "ended").map((r) => r.id);

  return (
    <div className="space-y-5">
      {/* stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(
          [
            ["active", "Aktīvās akcijas", stats.active, "text-rose-600", Tag],
            ["scheduled", "Ieplānotās", stats.scheduled, "text-sky-600", CalendarClock],
            ["ended", "Beigušās", stats.ended, "text-slate-500", Eraser],
            ["badges", "Ar nozīmītēm", stats.badges, "text-navy-700", Tags],
            ["featured", "Izcelti sākumlapā", stats.featured, "text-amber-600", Star],
          ] as const
        ).map(([v, label, n, color, Icon]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(view === v ? "all" : v)}
            className={cn("rounded-2xl border bg-white p-4 text-left shadow-card transition hover:border-navy-200", view === v ? "border-navy-700 ring-4 ring-navy-100" : "border-line")}
          >
            <span className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
              <Icon className={cn("h-3.5 w-3.5", color)} /> {label}
            </span>
            <span className={cn("mt-1 block text-[26px] font-extrabold tabular-nums", color)}>{n}</span>
          </button>
        ))}
      </div>

      {ended.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-slate-50 px-4 py-3 text-[13px]">
          <span className="text-ink/80">
            <strong>{ended.length}</strong> produktiem akcija jau beigusies (veikalā vairs netiek rādīta).
          </span>
          <button type="button" className={btn("outline", "sm")} disabled={pending} onClick={() => removePromo(ended)}>
            <Eraser className="h-3.5 w-3.5" /> Notīrīt beigušās
          </button>
        </div>
      )}

      {/* bulk panel */}
      <section className={cn("rounded-2xl border bg-white p-5 shadow-card transition", ids.length ? "border-rose-300 ring-4 ring-rose-50" : "border-line")}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink">
            <Tag className="h-4 w-4 text-rose-600" />
            {ids.length ? `Atlasīti ${ids.length} produkti` : "Atlasiet produktus sarakstā, lai piemērotu akciju vai nozīmīti"}
          </h2>
          {ids.length > 0 && (
            <button type="button" className={btn("ghost", "sm")} onClick={() => setSel(new Set())}>
              <X className="h-3.5 w-3.5" /> Notīrīt atlasi
            </button>
          )}
        </div>
        <div className={cn(!ids.length && "pointer-events-none opacity-50")}>
          <PromoEditor value={promo} onChange={(v) => setPromo((p) => ({ ...p, ...v }))} errors={errors} compact showBadges={false} />
          {lossy.length > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-800 ring-1 ring-inset ring-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {lossy.length} atlasītajiem produktiem ar −{pct}% cena būs zem iepirkuma cenas: {lossy.slice(0, 4).map((r) => r.name).join(", ")}
              {lossy.length > 4 ? "…" : ""}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={btn("primary")} disabled={pending || !ids.length} onClick={applyPromo}>
              {pending ? <Spinner /> : <Tag className="h-4 w-4" />}
              {promo.promo_type ? `Piemērot akciju (${ids.length})` : `Noņemt akciju (${ids.length})`}
            </button>
            {promo.promo_type && (
              <button type="button" className={btn("outline")} disabled={pending || !ids.length} onClick={() => removePromo(ids)}>
                <X className="h-4 w-4" /> Noņemt akciju
              </button>
            )}
            <button type="button" className={btn("outline")} disabled={pending || !ids.length} onClick={() => featured(true)}>
              <Star className="h-4 w-4" /> Izcelt sākumlapā
            </button>
            <button type="button" className={btn("ghost")} disabled={pending || !ids.length} onClick={() => featured(false)}>
              Noņemt izcelšanu
            </button>
          </div>

          <p className="mb-2 mt-5 text-[13px] font-bold text-ink">Nozīmītes atlasītajiem</p>
          <div className="flex flex-wrap gap-2">
            {BADGE_KEYS.map((b) => {
              const Icon = BADGE_ICON[b];
              return (
                <span key={b} className="inline-flex items-center overflow-hidden rounded-xl border border-line bg-white text-[12.5px] font-bold text-ink">
                  <span className="flex items-center gap-1.5 px-2.5 py-1.5">
                    <Icon className="h-3.5 w-3.5 text-navy-600" /> {BADGE_LABEL_LV[b]}
                  </span>
                  <button type="button" title="Pievienot" disabled={pending || !ids.length} onClick={() => badge(b, true)} className="grid h-8 w-8 place-items-center border-l border-line text-emerald-700 hover:bg-emerald-50">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="Noņemt" disabled={pending || !ids.length} onClick={() => badge(b, false)} className="grid h-8 w-8 place-items-center border-l border-line text-red-600 hover:bg-red-50">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className={cn(inputCls, "pl-9")} placeholder="Meklēt produktu…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={cn(selectCls, "w-auto min-w-[200px]")} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategorija">
          <option value="">Visas kategorijas</option>
          {categories.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select className={cn(selectCls, "w-auto")} value={view} onChange={(e) => setView(e.target.value as View)} aria-label="Skats">
          {VIEWS.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Tag} title="Nav produktu" description="Mainiet meklēšanu vai filtru." />
      ) : (
        <TableWrap>
          <table className="w-full text-[13.5px]">
            <thead>
              <tr>
                <th className={`${th} w-10`}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded accent-navy-700"
                    checked={allShown}
                    aria-label="Atlasīt visus redzamos"
                    onChange={() =>
                      setSel((s) => {
                        const n = new Set(s);
                        for (const r of shown) {
                          if (allShown) n.delete(r.id);
                          else n.add(r.id);
                        }
                        return n;
                      })
                    }
                  />
                </th>
                <th className={th}>Produkts</th>
                <th className={th}>Kategorija</th>
                <th className={`${th} text-right`}>Cena no</th>
                <th className={`${th} text-right`}>Min. uzcenojums</th>
                <th className={`${th} text-right`} />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const s = status.get(r.id);
                const promoPrice = s === "active" && r.minGross != null && r.promo?.percent ? Math.round(r.minGross * (1 - r.promo.percent / 100) * 100) / 100 : null;
                return (
                  <tr key={r.id} className={cn(trHover, sel.has(r.id) && "bg-rose-50/60", !r.is_active && "opacity-60")}>
                    <td className={td}>
                      <input type="checkbox" className="h-4 w-4 rounded accent-navy-700" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Atlasīt ${r.name}`} />
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        {r.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.image} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-line bg-white object-contain p-0.5" />
                        ) : (
                          <span className="h-10 w-10 shrink-0 rounded-lg border border-line bg-slate-50" />
                        )}
                        <div className="min-w-0">
                          <button type="button" onClick={() => toggle(r.id)} className="text-left font-bold text-ink hover:text-navy-600">
                            {r.name}
                          </button>
                          {r.is_featured && <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-600"><Star className="h-3 w-3 fill-current" /> sākumlapā</span>}
                          {!r.is_active && <span className="ml-1.5 text-[11px] font-bold text-muted">(paslēpts)</span>}
                          <PromoMarks promo={r.promo} badges={r.badges} />
                        </div>
                      </div>
                    </td>
                    <td className={`${td} text-muted`}>{r.category?.name ?? "—"}</td>
                    <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                      {promoPrice != null ? (
                        <>
                          <span className="block text-[11.5px] text-muted line-through">{fmtMoney(r.minGross!)}</span>
                          <span className="font-extrabold text-rose-600">{fmtMoney(promoPrice)}</span>
                        </>
                      ) : r.minGross != null ? (
                        <span className="font-bold text-ink">{fmtMoney(r.minGross)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {r.minMargin == null ? (
                        <span className="text-muted" title="Nav ievadīta iepirkuma cena">—</span>
                      ) : (
                        <span className={cn("font-bold", r.promo?.percent && s === "active" && r.promo.percent >= r.minMargin ? "text-red-700" : r.minMargin < 15 ? "text-amber-700" : "text-ink/70")}>
                          {Math.round(r.minMargin)}%
                        </span>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      {r.promo && (
                        <button type="button" className={btn("ghost", "sm", "text-red-600 hover:bg-red-50")} disabled={pending} onClick={() => removePromo([r.id])}>
                          <X className="h-3.5 w-3.5" /> Noņemt
                        </button>
                      )}
                      <Link href={`/admin/products/${r.id}`} className={btn("outline", "sm")}>
                        <Pencil className="h-3.5 w-3.5" /> Rediģēt
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
      <p className="text-[12px] text-muted">
        „Min. uzcenojums” — mazākā starpība starp pārdošanas un iepirkuma cenu (ja iepirkuma cena ievadīta). Atlaide, kas to pārsniedz, nozīmē pārdošanu ar zaudējumiem.
      </p>
    </div>
  );
}
