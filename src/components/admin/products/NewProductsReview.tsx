"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Eye, EyeOff, FileText, ImageOff, Languages, Pencil, Rocket, Save, Search, Sparkles, Tag, X } from "lucide-react";
import { savePackPrices } from "@/lib/admin/actions/inventory";
import { publishProducts, setProductFlag } from "@/lib/admin/actions/products";
import { packLabelOf } from "@/lib/admin/format";
import { ProductImage } from "@/components/ui/ProductImage";
import { cn } from "@/lib/utils";
import { Spinner, useActionRunner, useConfirm } from "../client-ui";
import { btn, inputCls } from "../styles";

export type ReviewProduct = {
  id: string;
  slug: string;
  sku: string | null;
  name: string;
  type: string | null;
  short: string | null;
  description: string | null;
  category: string | null;
  sae: string | null;
  image: string | null;
  is_active: boolean;
  specs: string[];
  approvals: string[];
  performance: string[];
  tds: boolean;
  langs: string[];
  created_at: string;
  /** set for products of the newest batch, e.g. "02.11.2026" — shown first and highlighted */
  latest: string | null;
  variants: { id: string; sku: string | null; size: number | null; unit: string; price_net: number; is_active: boolean }[];
  checks: { price: boolean; photo: boolean; text: boolean; langs: boolean };
};

const money = new Intl.NumberFormat("lv-LV", { style: "currency", currency: "EUR" });
const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const parse = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return s.trim() === "" || !Number.isFinite(n) ? null : n;
};

export function NewProductsReview({
  products,
  vat,
  view,
  q,
  counts,
  hrefs,
}: {
  products: ReviewProduct[];
  vat: number;
  view: "all" | "draft" | "live";
  q: string;
  counts: { all: number; draft: number; live: number };
  hrefs: { all: string; draft: string; live: string };
}) {
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const readyDrafts = products.filter((p) => !p.is_active && p.checks.price);
  const groups = useMemo(() => {
    const m = new Map<string, ReviewProduct[]>();
    for (const p of products) {
      const k = p.category ?? "Bez kategorijas";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    // groups with the newest additions first, and inside a group the newest products first
    const entries = [...m.entries()].map(([k, list]) => [k, [...list].sort((a, b) => Number(Boolean(b.latest)) - Number(Boolean(a.latest)))] as [string, ReviewProduct[]]);
    return entries.sort((a, b) => Number(b[1].some((p) => p.latest)) - Number(a[1].some((p) => p.latest)));
  }, [products]);

  return (
    <div className="space-y-5">
      {/* toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-3 shadow-card lg:flex-row lg:items-center">
        <nav className="flex gap-1" aria-label="Statuss">
          {(
            [
              ["all", "Visi", counts.all],
              ["draft", "Nav publicēti", counts.draft],
              ["live", "Veikalā", counts.live],
            ] as const
          ).map(([k, label, n]) => (
            <Link
              key={k}
              href={hrefs[k]}
              scroll={false}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold transition",
                view === k ? "bg-navy-700 text-white" : "text-muted hover:bg-navy-50 hover:text-navy-700",
              )}
            >
              {label}
              <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", view === k ? "bg-white/20" : "bg-slate-100")}>{n}</span>
            </Link>
          ))}
        </nav>
        <form className="relative flex-1" action="">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Meklēt: nosaukums, art. nr., SAE…" className={cn(inputCls, "h-9 pl-8 text-[13px]")} />
          {view !== "all" && <input type="hidden" name="view" value={view} />}
        </form>
        <button
          type="button"
          className={btn("primary")}
          disabled={pending || readyDrafts.length === 0}
          title={readyDrafts.length ? undefined : "Nevienam nepublicētam produktam vēl nav cenas"}
          onClick={() => run(() => publishProducts(readyDrafts.map((p) => p.id)), { loading: "Publicē…", onSuccess: () => router.refresh() })}
        >
          {pending ? <Spinner /> : <Rocket className="h-4 w-4" />} Publicēt visus ar cenām ({readyDrafts.length})
        </button>
      </div>

      <div className="rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 text-[13px] leading-relaxed text-ink">
        <strong>Kā pārbaudīt:</strong> katrs produkts ir parādīts tāpat kā veikalā — attēls, apraksts, specifikācijas un iepakojumi. Nepublicētie produkti
        klientiem <strong>nav redzami</strong>. Ievadiet cenas ar PVN {vat}% → <em>Saglabāt un publicēt</em>. Iepakojums bez cenas veikalā netiek rādīts. Vairāk
        labojumu (attēli, teksti, citas valodas, dokumenti) — <em>Rediģēt</em>.
      </div>

      {groups.map(([cat, list]) => (
        <section key={cat}>
          <h2 className="mb-2 flex flex-wrap items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.1em] text-muted">
            {cat} <span className="font-semibold normal-case tracking-normal">· {list.length}</span>
            {list.some((p) => p.latest) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10.5px] font-extrabold tracking-[0.08em] text-navy-900 shadow-sm">
                <Sparkles className="h-3 w-3" aria-hidden /> Jaunākais papildinājums · {list.find((p) => p.latest)?.latest}
              </span>
            )}
          </h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {list.map((p) => (
              <ReviewCard key={p.id} p={p} vat={vat} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Check1({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <span
      title={hint}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold ring-1 ring-inset",
        ok ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-orange-50 text-orange-700 ring-orange-200",
      )}
    >
      {ok ? <Check className="h-3 w-3" aria-hidden /> : <X className="h-3 w-3" aria-hidden />}
      {label}
    </span>
  );
}

function Chips({ title, items, tone }: { title: string; items: string[]; tone: "navy" | "green" | "slate" }) {
  if (!items.length) return null;
  const cls = tone === "green" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : tone === "navy" ? "bg-navy-50 text-navy-700 ring-navy-200" : "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{title}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((s) => (
          <span key={s} className={cn("rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset", cls)}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ p, vat }: { p: ReviewProduct; vat: number }) {
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const k = 1 + vat / 100;
  const [open, setOpen] = useState(false);
  const [gross, setGross] = useState<Record<string, string>>(() =>
    Object.fromEntries(p.variants.map((v) => [v.id, v.price_net > 0 ? r2(v.price_net * k).toFixed(2).replace(".", ",") : ""])),
  );
  const dirty = p.variants.filter((v) => {
    const g = parse(gross[v.id] ?? "");
    const cur = v.price_net > 0 ? r2(v.price_net * k) : null;
    return g !== cur;
  });
  const invalid = p.variants.some((v) => {
    const s = gross[v.id] ?? "";
    return s.trim() !== "" && (parse(s) == null || (parse(s) ?? 0) < 0);
  });

  const confirm = useConfirm();
  const entered = p.variants.filter((v) => (parse(gross[v.id] ?? "") ?? 0) > 0);
  const missing = p.variants.filter((v) => !((parse(gross[v.id] ?? "") ?? 0) > 0));
  const payload = () => p.variants.map((v) => {
    const g = parse(gross[v.id] ?? "");
    return { variant_id: v.id, price_net: g != null && g > 0 ? r4(g / k) : null };
  });
  const savePrices = () => run(() => savePackPrices(p.id, payload(), false), { loading: "Saglabā cenas…", onSuccess: () => router.refresh() });
  const publish = async () => {
    if (missing.length) {
      const ok = await confirm({
        title: `Publicēt ${p.name}?`,
        description: `Bez cenas: ${missing.map((v) => packLabelOf(v.size, v.unit)).join(", ")} — šie iepakojumi veikalā netiks rādīti. Kad ievadīsiet cenu un saglabāsiet, tie parādīsies.`,
        confirmLabel: "Publicēt",
      });
      if (!ok) return;
    }
    run(() => savePackPrices(p.id, payload(), true), { loading: "Saglabā un publicē…", onSuccess: () => router.refresh() });
  };

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-white shadow-card",
        p.is_active ? "border-emerald-200" : p.latest ? "border-amber-300 ring-2 ring-amber-200/70" : "border-line",
      )}
    >
      <div className="flex gap-4 p-4">
        <div className="relative h-32 w-28 shrink-0 overflow-hidden rounded-xl border border-line bg-[radial-gradient(120%_90%_at_50%_10%,#ffffff_45%,#eef2f9_100%)]">
          <ProductImage src={p.image} alt={p.name} sizes="112px" className="absolute inset-0 bg-transparent" imgClassName="p-2" />
          {!p.image && (
            <span className="absolute inset-x-1 bottom-1 inline-flex items-center justify-center gap-1 rounded bg-white/90 px-1 py-0.5 text-[10px] font-bold text-orange-700">
              <ImageOff className="h-3 w-3" aria-hidden /> Nav foto
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide",
                p.is_active ? "bg-emerald-500 text-white" : "bg-slate-700 text-white",
              )}
            >
              {p.is_active ? <Eye className="h-3 w-3" aria-hidden /> : <EyeOff className="h-3 w-3" aria-hidden />}
              {p.is_active ? "Veikalā" : "Melnraksts"}
            </span>
            {p.latest && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-navy-900">
                <Sparkles className="h-3 w-3" aria-hidden /> Jaunākais · {p.latest.slice(0, 6)}
              </span>
            )}
            {p.sku && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11.5px] font-bold text-slate-700">Art. {p.sku}</span>}
            {p.sae && <span className="rounded-md bg-brand-100 px-1.5 py-0.5 text-[11.5px] font-extrabold text-brand-800">SAE {p.sae}</span>}
          </div>
          <h3 className="mt-1.5 text-[16px] font-extrabold leading-tight tracking-[-0.01em] text-ink">{p.name}</h3>
          {p.type && <p className="text-[12.5px] font-semibold text-navy-600">{p.type}</p>}
          {p.short && <p className="mt-1 text-[13px] leading-snug text-muted">{p.short}</p>}
          <div className="mt-2 flex flex-wrap gap-1">
            <Check1 ok={p.checks.price} label="Cenas" hint="Vismaz vienam iepakojumam jābūt cenai; iepakojumi bez cenas netiek rādīti" />
            <Check1 ok={p.checks.photo} label="Foto" hint="Produkta attēls — pievienojiet sadaļā Rediģēt → Attēli" />
            <Check1 ok={p.checks.text} label="Apraksts" />
            <Check1 ok={p.checks.langs} label={`Valodas ${p.langs.length}/5`} hint={p.langs.join(", ").toUpperCase()} />
            <Check1 ok={p.tds} label="Tehn. datu lapa" hint="TDS PDF — nav obligāta" />
          </div>
        </div>
      </div>

      {/* packs + prices */}
      <div className="border-t border-line bg-slate-50/60 px-4 py-3">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          <Tag className="h-3.5 w-3.5" aria-hidden /> Iepakojumi un cenas (ar PVN {vat}%)
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {p.variants.map((v) => {
            const g = parse(gross[v.id] ?? "");
            return (
              <label key={v.id} className={cn("block rounded-lg border bg-white p-2", v.is_active ? "border-line" : "border-dashed border-line opacity-60")}>
                <span className="flex items-center justify-between text-[12px] font-bold text-ink">
                  {packLabelOf(v.size, v.unit)}
                  <span className="font-mono text-[10.5px] font-semibold text-muted">{v.sku}</span>
                </span>
                <span className="relative mt-1 block">
                  <input
                    inputMode="decimal"
                    value={gross[v.id] ?? ""}
                    onChange={(e) => setGross((s) => ({ ...s, [v.id]: e.target.value }))}
                    placeholder="0,00"
                    aria-label={`Cena ${packLabelOf(v.size, v.unit)}`}
                    className={cn(inputCls, "h-8 pr-6 text-right text-[13px] font-bold tabular-nums", !g && "border-orange-300")}
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-muted">€</span>
                </span>
                <span className="mt-0.5 block text-right text-[10.5px] text-muted">{g ? `bez PVN ${money.format(r2(g / k))}` : "cena nav ievadīta"}</span>
              </label>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className={btn("dark", "sm")} disabled={pending || !dirty.length || invalid} onClick={savePrices}>
            {pending ? <Spinner /> : <Save className="h-3.5 w-3.5" />} Saglabāt cenas{dirty.length ? ` (${dirty.length})` : ""}
          </button>
          {p.is_active ? (
            <button
              type="button"
              className={btn("outline", "sm")}
              disabled={pending}
              onClick={() => run(() => setProductFlag(p.id, "is_active", false), { onSuccess: () => router.refresh() })}
            >
              <EyeOff className="h-3.5 w-3.5" /> Paslēpt
            </button>
          ) : (
            <button
              type="button"
              className={btn("primary", "sm")}
              disabled={pending || !entered.length || invalid}
              title={!entered.length ? "Ievadiet cenu vismaz vienam iepakojumam" : "Saglabā cenas un publicē produktu veikalā"}
              onClick={publish}
            >
              <Rocket className="h-3.5 w-3.5" /> {dirty.length ? "Saglabāt un publicēt" : "Publicēt"}
            </button>
          )}
          <Link href={`/admin/products/${p.id}`} className={btn("ghost", "sm")}>
            <Pencil className="h-3.5 w-3.5" /> Rediģēt
          </Link>
          {p.is_active && (
            <a href={`/produkts/${p.slug}`} target="_blank" rel="noreferrer" className={btn("ghost", "sm")}>
              <Eye className="h-3.5 w-3.5" /> Skatīt veikalā
            </a>
          )}
          <button type="button" className={cn(btn("ghost", "sm"), "ml-auto")} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <FileText className="h-3.5 w-3.5" /> Apraksts un specifikācijas
            <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} />
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-line px-4 py-4">
          {p.description ? (
            <div
              className="prose-sm max-w-none text-[13.5px] leading-relaxed text-ink [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_strong]:font-bold"
              dangerouslySetInnerHTML={{ __html: p.description }}
            />
          ) : (
            <p className="text-[13px] text-orange-700">Apraksta nav.</p>
          )}
          <Chips title="Specifikācijas" items={p.specs} tone="navy" />
          <Chips title="Ražotāju apstiprinājumi" items={p.approvals} tone="green" />
          <Chips title="Atbilst prasībām" items={p.performance} tone="slate" />
          <p className="flex items-center gap-1.5 text-[12px] text-muted">
            <Languages className="h-3.5 w-3.5" aria-hidden /> Tulkojumi: {p.langs.map((l) => l.toUpperCase()).join(", ") || "—"}
          </p>
        </div>
      )}
    </article>
  );
}
