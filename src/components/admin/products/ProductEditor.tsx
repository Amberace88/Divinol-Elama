"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, Bold, CheckCircle2, Eye, Heading3, List, Pilcrow, Save, Trash2, Wand2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { checkSlugAvailable, deleteProduct, saveProduct } from "@/lib/admin/actions/products";
import { LANG_LABEL, LANGS, type Lang } from "@/lib/admin/labels";
import { issuesToFieldErrors, productSchema, SLUG_RE, type ProductPayload } from "@/lib/admin/schemas";
import { cn, slugify } from "@/lib/utils";
import { Field, Spinner, Switch, useConfirm } from "../client-ui";
import { btn, inputCls, selectCls, textareaCls } from "../styles";
import { DocField } from "./DocField";
import { ImageManager } from "./ImageManager";
import { TagInput } from "./TagInput";
import { parseDec, VariantsEditor, type VariantState } from "./VariantsEditor";

export type ProductText = { name: string; type: string; short: string; description: string; meta_title: string; meta_description: string };

export type ProductFormInit = {
  id: string | null;
  slug: string;
  base_sku: string;
  category_id: string;
  sae: string;
  iso_vg: string;
  specs: string[];
  oem_approvals: string[];
  performance: string[];
  images: string[];
  i18n: Record<Lang, ProductText>;
  tds_url: string;
  sds_url: string;
  is_active: boolean;
  is_featured: boolean;
  sort: number;
  variants: VariantState[];
  legacy_slugs: string[];
};

export const emptyText = (): ProductText => ({ name: "", type: "", short: "", description: "", meta_title: "", meta_description: "" });

const SNIPPET_URL: Record<Lang, string> = {
  lv: "divinol.lv › produkts",
  et: "divinol.ee › toode",
  lt: "divinol.lv › lt › produktas",
  en: "divinol.lv › en › product",
  ru: "divinol.lv › ru › produkt",
};

function toPayload(f: ProductFormInit): ProductPayload {
  const num = (s: string) => {
    const n = parseDec(s);
    return n == null ? null : n;
  };
  const i18n = Object.fromEntries(LANGS.filter((l) => l === "lv" || f.i18n[l].name.trim()).map((l) => [l, f.i18n[l]])) as ProductPayload["i18n"];
  return {
    id: f.id,
    slug: f.slug.trim(),
    base_sku: f.base_sku,
    category_id: f.category_id || null,
    sae: f.sae,
    iso_vg: f.iso_vg,
    specs: f.specs,
    oem_approvals: f.oem_approvals,
    performance: f.performance,
    images: f.images,
    i18n,
    tds_url: f.tds_url,
    sds_url: f.sds_url,
    is_active: f.is_active,
    is_featured: f.is_featured,
    sort: Math.round(Number(f.sort) || 0),
    variants: f.variants.map((v, i) => ({
      id: v.id,
      sku: v.sku,
      size: num(v.size),
      unit: v.unit,
      price_net: num(v.net) ?? Number.NaN,
      cost_net: num(v.cost),
      stock: v.stock.trim() === "" ? null : Number(v.stock),
      in_stock: v.in_stock,
      is_active: v.is_active,
      image: v.image,
      weight_kg: v.weight_kg,
      sort: i,
    })),
  };
}

export function ProductEditor({
  initial,
  categories,
  vat,
}: {
  initial: ProductFormInit;
  categories: { id: string; name: string }[];
  vat: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [form, setForm] = useState<ProductFormInit>(initial);
  const [snapshot] = useState(() => JSON.stringify(initial));
  const [lang, setLang] = useState<Lang>("lv");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [slugState, setSlugState] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const isNew = !initial.id;
  const dirty = useMemo(() => JSON.stringify(form) !== snapshot, [form, snapshot]);

  const set = useCallback(<K extends keyof ProductFormInit>(key: K, value: ProductFormInit[K]) => setForm((f) => ({ ...f, [key]: value })), []);
  const setText = (l: Lang, key: keyof ProductText, value: string) =>
    setForm((f) => {
      const next = { ...f, i18n: { ...f.i18n, [l]: { ...f.i18n[l], [key]: value } } };
      if (l === "lv" && key === "name" && !slugTouched) next.slug = slugify(value);
      return next;
    });

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // Live slug availability check.
  useEffect(() => {
    const slug = form.slug.trim();
    if (!SLUG_RE.test(slug) || slug === initial.slug) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSlugState("checking");
      const res = await checkSlugAvailable(slug, initial.id);
      if (!cancelled) setSlugState(res.ok ? (res.data.available ? "ok" : "taken") : "idle");
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.slug, initial.slug, initial.id]);
  const slugStatus = !SLUG_RE.test(form.slug.trim()) || form.slug.trim() === initial.slug ? "idle" : slugState;

  const save = useCallback(() => {
    const payload = toPayload(form);
    const parsed = productSchema.safeParse(payload);
    if (!parsed.success) {
      const fe = issuesToFieldErrors(parsed.error.issues);
      setErrors(fe);
      const firstLang = LANGS.find((l) => Object.keys(fe).some((k) => k.startsWith(`i18n.${l}.`)));
      if (firstLang) setLang(firstLang);
      toast.error(Object.values(fe)[0] ?? "Pārbaudiet iezīmētos laukus");
      return;
    }
    setErrors({});
    const id = toast.loading("Saglabā produktu…");
    startSave(async () => {
      const res = await saveProduct(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error, { id });
        return;
      }
      toast.success(res.message ?? "Saglabāts", { id });
      if (res.data.created) router.replace(`/admin/products/${res.data.id}`);
    });
  }, [form, router]);

  // Ctrl/Cmd + S
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [save]);

  async function remove() {
    if (!initial.id) return;
    const ok = await confirm({
      title: "Dzēst produktu?",
      description: `„${initial.i18n.lv.name || initial.slug}” un visi tā varianti tiks neatgriezeniski dzēsti. Esošajos pasūtījumos preču rindas saglabāsies. Ja produktu tikai jāpaslēpj, izslēdziet „Aktīvs”.`,
      confirmLabel: "Dzēst",
      danger: true,
    });
    if (!ok) return;
    startDelete(async () => {
      const res = await deleteProduct(initial.id!);
      if (res.ok) {
        toast.success(res.message ?? "Dzēsts");
        router.push("/admin/products");
      } else toast.error(res.error);
    });
  }

  const t = form.i18n[lang];
  const folder = `products/${form.slug || "jauns"}`;
  const variantErrors = Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith("variants")));
  const errCount = Object.keys(errors).length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      noValidate
    >
      {/* Sticky action bar */}
      <div className="sticky top-16 z-20 -mx-4 mb-5 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto flex min-w-0 items-center gap-2 text-[13px]">
            {errCount > 0 ? (
              <span className="flex items-center gap-1.5 font-semibold text-red-600">
                <AlertCircle className="h-4 w-4" /> {errCount} {errCount === 1 ? "kļūda" : "kļūdas"}
              </span>
            ) : dirty ? (
              <span className="flex items-center gap-1.5 font-semibold text-brand-700">
                <span className="h-2 w-2 rounded-full bg-brand-500" /> Nesaglabātas izmaiņas
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-muted">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {isNew ? "Jauns produkts" : "Visas izmaiņas saglabātas"}
              </span>
            )}
          </div>
          {!isNew && (
            <a href={`/produkts/${initial.slug}`} target="_blank" rel="noreferrer" className={btn("ghost")}>
              <Eye className="h-4 w-4" /> <span className="hidden sm:inline">Skatīt veikalā</span>
            </a>
          )}
          <button type="submit" className={btn("primary")} disabled={saving}>
            {saving ? <Spinner /> : <Save className="h-4 w-4" />} {isNew ? "Izveidot produktu" : "Saglabāt"}
            <kbd className="ml-1 hidden rounded bg-navy-900/10 px-1 text-[10px] font-bold lg:inline">Ctrl S</kbd>
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* Content per language */}
          <section className="rounded-2xl border border-line bg-white shadow-card">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 pt-4">
              <div role="tablist" aria-label="Valodas" className="no-scrollbar -mb-px flex gap-1 overflow-x-auto">
                {LANGS.map((l) => {
                  const filled = Boolean(form.i18n[l].name.trim());
                  const hasErr = Object.keys(errors).some((k) => k.startsWith(`i18n.${l}.`));
                  return (
                    <button
                      key={l}
                      type="button"
                      role="tab"
                      id={`tab-${l}`}
                      aria-selected={lang === l}
                      aria-controls="lang-panel"
                      onClick={() => setLang(l)}
                      onKeyDown={(e) => {
                        const i = LANGS.indexOf(l);
                        if (e.key === "ArrowRight") setLang(LANGS[(i + 1) % LANGS.length]);
                        if (e.key === "ArrowLeft") setLang(LANGS[(i - 1 + LANGS.length) % LANGS.length]);
                      }}
                      className={cn(
                        "relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-3 pt-1 text-[13px] font-bold transition",
                        lang === l ? "border-navy-700 text-navy-700" : "border-transparent text-muted hover:text-ink",
                      )}
                    >
                      <span className="uppercase">{l}</span>
                      <span className="hidden font-semibold text-muted/80 sm:inline">{LANG_LABEL[l]}</span>
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", hasErr ? "bg-red-500" : filled ? "bg-emerald-500" : "bg-slate-300")}
                        aria-label={hasErr ? "kļūda" : filled ? "aizpildīts" : "nav aizpildīts"}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
            <div id="lang-panel" role="tabpanel" aria-labelledby={`tab-${lang}`} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`Nosaukums${lang === "lv" ? " *" : ""}`} htmlFor="p-name" error={errors[`i18n.${lang}.name`]}>
                  <input id="p-name" className={inputCls} value={t.name} onChange={(e) => setText(lang, "name", e.target.value)} aria-invalid={Boolean(errors[`i18n.${lang}.name`])} />
                </Field>
                <Field label="Tips" htmlFor="p-type" hint="piem. „Sintētiskā motoreļļa”">
                  <input id="p-type" className={inputCls} value={t.type} onChange={(e) => setText(lang, "type", e.target.value)} />
                </Field>
              </div>
              <Field label="Īss apraksts" htmlFor="p-short" aside={<Counter value={t.short} max={200} soft />}>
                <textarea id="p-short" rows={2} className={textareaCls} value={t.short} onChange={(e) => setText(lang, "short", e.target.value)} />
              </Field>
              <DescriptionEditor value={t.description} onChange={(v) => setText(lang, "description", v)} />
              <div className="rounded-xl border border-line bg-slate-50/60 p-4">
                <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">SEO</p>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <Field
                      label="Meta virsraksts"
                      htmlFor="p-mt"
                      aside={<Counter value={t.meta_title} max={60} />}
                      error={errors[`i18n.${lang}.meta_title`]}
                    >
                      <div className="flex gap-1.5">
                        <input id="p-mt" className={inputCls} value={t.meta_title} onChange={(e) => setText(lang, "meta_title", e.target.value)} placeholder={t.name} />
                        <button
                          type="button"
                          className={btn("outline", "md", "h-10 px-2.5")}
                          title="Ģenerēt no nosaukuma"
                          aria-label="Ģenerēt meta virsrakstu"
                          onClick={() => setText(lang, "meta_title", `${t.name}${t.type ? ` – ${t.type}` : ""} | Divinol`.slice(0, 70))}
                        >
                          <Wand2 className="h-4 w-4" />
                        </button>
                      </div>
                    </Field>
                    <Field label="Meta apraksts" htmlFor="p-md" aside={<Counter value={t.meta_description} max={160} />} error={errors[`i18n.${lang}.meta_description`]}>
                      <textarea id="p-md" rows={3} className={textareaCls} value={t.meta_description} onChange={(e) => setText(lang, "meta_description", e.target.value)} placeholder={t.short} />
                    </Field>
                  </div>
                  <SnippetPreview title={t.meta_title || t.name || "Produkta nosaukums"} description={t.meta_description || t.short} url={`${SNIPPET_URL[lang]} › ${form.slug || "…"}`} />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-1 text-[15px] font-bold text-ink">Attēli</h2>
            <p className="mb-4 text-[13px] text-muted">Augšupielādēti Supabase Storage („product-images”).</p>
            <ImageManager images={form.images} onChange={(next) => setForm((f) => ({ ...f, images: typeof next === "function" ? next(f.images) : next }))} folder={folder} />
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold text-ink">Varianti un cenas</h2>
              {errors.variants && <p className="text-[12px] font-semibold text-red-600">{errors.variants}</p>}
            </div>
            <VariantsEditor variants={form.variants} onChange={(v) => set("variants", v)} images={form.images} vat={vat} errors={variantErrors} />
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-4 text-[15px] font-bold text-ink">Tehniskie dati</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SAE viskozitāte" htmlFor="p-sae" hint="piem. 5W-30" error={errors.sae}>
                <input id="p-sae" className={inputCls} value={form.sae} onChange={(e) => set("sae", e.target.value)} />
              </Field>
              <Field label="ISO VG" htmlFor="p-iso" hint="piem. 46" error={errors.iso_vg}>
                <input id="p-iso" className={inputCls} value={form.iso_vg} onChange={(e) => set("iso_vg", e.target.value)} />
              </Field>
            </div>
            <div className="mt-4 space-y-4">
              <TagInput label="Specifikācijas" value={form.specs} onChange={(v) => set("specs", v)} placeholder="ACEA C3, API SP…" hint="Enter vai komats, lai pievienotu" />
              <TagInput label="Ražotāju apstiprinājumi (OEM)" value={form.oem_approvals} onChange={(v) => set("oem_approvals", v)} placeholder="VW 504 00, MB 229.51…" />
              <TagInput label="Atbilst prasībām (performance)" value={form.performance} onChange={(v) => set("performance", v)} placeholder="Ford WSS-M2C 917-A…" />
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-4 text-[15px] font-bold text-ink">Dokumenti</h2>
            <div className="space-y-4">
              <DocField label="Tehniskā datu lapa (TDS)" value={form.tds_url} onChange={(v) => set("tds_url", v)} folder={`${folder}/tds`} />
              <DocField label="Drošības datu lapa (SDS)" value={form.sds_url} onChange={(v) => set("sds_url", v)} folder={`${folder}/sds`} />
            </div>
          </section>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-36 xl:self-start">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-4 text-[15px] font-bold text-ink">Publicēšana</h2>
            <div className="space-y-3">
              <ToggleRow label="Aktīvs" hint="Redzams veikalā" checked={form.is_active} onChange={(v) => set("is_active", v)} />
              <ToggleRow label="Izcelts" hint="Rādīt sākumlapā" checked={form.is_featured} onChange={(v) => set("is_featured", v)} />
              <Field label="Secība" htmlFor="p-sort" hint="Mazāks skaitlis = augstāk sarakstā">
                <input id="p-sort" type="number" className={inputCls} value={form.sort} onChange={(e) => set("sort", Number(e.target.value))} />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-4 text-[15px] font-bold text-ink">Organizācija</h2>
            <div className="space-y-4">
              <Field label="Kategorija" htmlFor="p-cat" error={errors.category_id}>
                <select id="p-cat" className={selectCls} value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
                  <option value="">— bez kategorijas —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Slug (URL)"
                htmlFor="p-slug"
                error={errors.slug ?? (slugStatus === "taken" ? "Šāds slug jau ir aizņemts" : undefined)}
                hint={!isNew && form.slug !== initial.slug ? "Mainot slug, mainīsies produkta adrese (vecā saite vairs nedarbosies)." : "Ģenerējas no latviešu nosaukuma"}
                aside={
                  slugStatus === "checking" ? (
                    <Spinner className="h-3.5 w-3.5 text-muted" />
                  ) : slugStatus === "ok" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Pieejams" />
                  ) : slugStatus === "taken" ? (
                    <XCircle className="h-4 w-4 text-red-600" aria-label="Aizņemts" />
                  ) : null
                }
              >
                <input
                  id="p-slug"
                  className={cn(inputCls, "font-mono text-[13px]")}
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"));
                  }}
                  onBlur={() => set("slug", slugify(form.slug))}
                  aria-invalid={Boolean(errors.slug) || slugStatus === "taken"}
                />
              </Field>
              <Field label="Bāzes SKU" htmlFor="p-sku" error={errors.base_sku}>
                <input id="p-sku" className={cn(inputCls, "font-mono")} value={form.base_sku} onChange={(e) => set("base_sku", e.target.value)} />
              </Field>
              {form.legacy_slugs.length > 0 && (
                <div>
                  <p className="mb-1 text-[12px] font-semibold text-muted">Vecās WooCommerce adreses (301 pāradresācija)</p>
                  <ul className="space-y-0.5 font-mono text-[11px] text-muted">
                    {form.legacy_slugs.map((s) => (
                      <li key={s} className="truncate">
                        /product/{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {!isNew && (
            <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-card">
              <h2 className="mb-1 text-[15px] font-bold text-red-700">Bīstamā zona</h2>
              <p className="mb-3 text-[13px] text-muted">Dzēšanu nevar atsaukt.</p>
              <button type="button" className={btn("danger", "md", "w-full")} onClick={remove} disabled={deleting}>
                {deleting ? <Spinner /> : <Trash2 className="h-4 w-4" />} Dzēst produktu
              </button>
            </section>
          )}
        </aside>
      </div>
    </form>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3">
      <div>
        <p className="text-[13px] font-bold text-ink">{label}</p>
        <p className="text-[12px] text-muted">{hint}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function Counter({ value, max, soft }: { value: string; max: number; soft?: boolean }) {
  const n = value.length;
  return (
    <span
      className={cn(
        "text-[11px] font-bold tabular-nums",
        n === 0 ? "text-muted" : n > max ? (soft ? "text-brand-700" : "text-orange-600") : n >= max * 0.7 ? "text-emerald-600" : "text-muted",
      )}
      aria-live="polite"
    >
      {n}/{max}
    </span>
  );
}

function SnippetPreview({ title, description, url }: { title: string; description: string; url: string }) {
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold text-ink/80">Google priekšskatījums</p>
      <div className="rounded-xl border border-line bg-white p-4 font-[arial,sans-serif]">
        <div className="mb-1 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-navy-700 text-[10px] font-black text-brand-400">D</span>
          <div className="min-w-0 leading-tight">
            <p className="text-[13px] text-[#202124]">Divinol</p>
            <p className="truncate text-[12px] text-[#4d5156]">{url}</p>
          </div>
        </div>
        <p className="line-clamp-1 text-[19px] leading-snug text-[#1a0dab]">{clip(title, 62)}</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-[1.45] text-[#4d5156]">{description ? clip(description, 160) : "Meta apraksts nav norādīts — Google izvēlēsies tekstu no lapas."}</p>
      </div>
    </div>
  );
}

const TOOLS = [
  { icon: Pilcrow, label: "Rindkopa", before: "<p>", after: "</p>", ph: "Teksts" },
  { icon: Bold, label: "Treknraksts", before: "<strong>", after: "</strong>", ph: "teksts" },
  { icon: Heading3, label: "Apakšvirsraksts", before: "<h3>", after: "</h3>", ph: "Virsraksts" },
  { icon: List, label: "Saraksts", before: "<ul>\n  <li>", after: "</li>\n</ul>", ph: "Punkts" },
];

function DescriptionEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"split" | "edit" | "preview">("split");

  function wrap(before: string, after: string, placeholder = "") {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  }
  // Admin-authored HTML; strip scripts/handlers for the preview only.
  const safe = value.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+="[^"]*"/gi, "");


  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="p-desc" className="text-[13px] font-semibold text-ink/80">
          Apraksts (HTML)
        </label>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-line bg-white p-0.5">
            {TOOLS.map((t) => (
              <button key={t.label} type="button" onClick={() => wrap(t.before, t.after, t.ph)} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-slate-100 hover:text-ink" title={t.label} aria-label={t.label}>
                <t.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-line bg-white p-0.5 text-[12px] font-bold">
            {(
              [
                ["edit", "HTML"],
                ["split", "Abi"],
                ["preview", "Skats"],
              ] as const
            ).map(([m, l]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn("rounded-md px-2 py-1", mode === m ? "bg-navy-700 text-white" : "text-muted hover:text-ink")}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={cn("grid gap-3", mode === "split" && "lg:grid-cols-2")}>
        {mode !== "preview" && (
          <textarea
            id="p-desc"
            ref={ref}
            rows={14}
            className={cn(textareaCls, "font-mono text-[12.5px] leading-relaxed")}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
        )}
        {mode !== "edit" && (
          <div className="max-h-[420px] min-h-[120px] overflow-y-auto rounded-lg border border-dashed border-line bg-white p-4">
            {safe.trim() ? (
              <div className="prose-product" dangerouslySetInnerHTML={{ __html: safe }} />
            ) : (
              <p className="text-[13px] text-muted">Priekšskatījums parādīsies šeit.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
