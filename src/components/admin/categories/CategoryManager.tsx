"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { motion } from "motion/react";
import { ChevronDown, ChevronUp, FolderPlus, GripVertical, ImagePlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCategory, reorderCategories, saveCategory, setCategoryActive } from "@/lib/admin/actions/categories";
import { CATEGORY_ICONS, LANG_LABEL, LANGS, type Lang } from "@/lib/admin/labels";
import { SLUG_RE, type CategoryPayload } from "@/lib/admin/schemas";
import { IMAGE_TYPES, uploadToBucket } from "@/lib/admin/upload";
import { cn, slugify } from "@/lib/utils";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Drawer, Field, Spinner, Switch, useActionRunner, useConfirm } from "../client-ui";
import { btn, inputCls, textareaCls } from "../styles";
import { imgUnoptimized } from "../Thumb";
import { EmptyState } from "../ui";

type I18n = Partial<Record<Lang, { name: string; description: string; seo_text?: string }>>;
export type CategoryItem = { id: string; slug: string; icon: string; image: string | null; sort: number; is_active: boolean; i18n: I18n; products: number };

const ICON_LABEL: Record<string, string> = {
  car: "Auto",
  truck: "Kravas auto",
  bike: "Moto",
  cog: "Transmisija",
  gauge: "Hidraulika",
  factory: "Industrija",
  droplets: "Eļļa / smērvielas",
  spray: "Aerosoli",
  snowflake: "Sezona",
  hardhat: "Būvniecība",
};

type Draft = {
  id: string | null;
  slug: string;
  icon: string;
  image: string;
  is_active: boolean;
  i18n: Record<Lang, { name: string; description: string; seo_text?: string }>;
};

function toDraft(c: CategoryItem | null): Draft {
  const i18n = Object.fromEntries(
    LANGS.map((l) => [
      l,
      { name: c?.i18n[l]?.name ?? "", description: c?.i18n[l]?.description ?? "", ...(c?.i18n[l]?.seo_text ? { seo_text: c.i18n[l]!.seo_text } : {}) },
    ]),
  ) as Draft["i18n"];
  return { id: c?.id ?? null, slug: c?.slug ?? "", icon: c?.icon ?? "droplets", image: c?.image ?? "", is_active: c?.is_active ?? true, i18n };
}

export function CategoryManager({ categories }: { categories: CategoryItem[] }) {
  const [order, setOrder] = useState(categories);
  const [prevProp, setPrevProp] = useState(categories);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startReorder] = useTransition();
  const { run, pending } = useActionRunner();
  const confirm = useConfirm();

  // Sync with fresh server data after mutations.
  if (prevProp !== categories) {
    setPrevProp(categories);
    setOrder(categories);
  }

  function persist(next: CategoryItem[]) {
    const before = order;
    setOrder(next);
    startReorder(async () => {
      const res = await reorderCategories(next.map((c) => c.id));
      if (res.ok) toast.success("Secība saglabāta");
      else {
        toast.error(res.error);
        setOrder(before);
      }
    });
  }
  function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    persist(next);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" className={btn("primary")} onClick={() => setDraft(toDraft(null))}>
          <FolderPlus className="h-4 w-4" /> Jauna kategorija
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        {order.length === 0 ? (
          <EmptyState icon={FolderPlus} title="Kategoriju vēl nav" description="Izveidojiet kategoriju vai importējiet sākotnējo katalogu sadaļā „Produkti”." />
        ) : (
          <ul className="divide-y divide-line/70" aria-label="Kategorijas (velciet, lai mainītu secību)">
            {order.map((c, i) => (
              <motion.li layout key={c.id} className="bg-white">
                {/* Native HTML5 drag handlers live on a plain element (motion reserves onDragStart/onDragEnd for its own gestures). */}
                <div
                  draggable
                  onDragStart={() => setDragId(c.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!dragId || dragId === c.id) return;
                    const from = order.findIndex((x) => x.id === dragId);
                    const next = [...order];
                    const [it] = next.splice(from, 1);
                    next.splice(i, 0, it);
                    setDragId(null);
                    persist(next);
                  }}
                  onDragEnd={() => setDragId(null)}
                  className={cn("flex items-center gap-3 bg-white px-3 py-3 sm:px-5", dragId === c.id && "opacity-40", !c.is_active && "bg-slate-50")}
                >
                  <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-slate-300 sm:block" aria-hidden />
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="rounded p-0.5 text-muted hover:bg-slate-100 disabled:opacity-30"
                      aria-label={`Pārvietot ${c.i18n.lv?.name ?? c.slug} uz augšu`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === order.length - 1}
                      className="rounded p-0.5 text-muted hover:bg-slate-100 disabled:opacity-30"
                      aria-label={`Pārvietot ${c.i18n.lv?.name ?? c.slug} uz leju`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 -skew-x-6 place-items-center rounded-xl bg-navy-700 text-brand-400">
                    <CategoryIcon name={c.icon} className="h-5 w-5 skew-x-6" />
                  </span>
                  {c.image ? (
                    <Image
                      src={c.image}
                      alt=""
                      width={80}
                      height={80}
                      unoptimized={imgUnoptimized(c.image)}
                      className="hidden h-10 w-10 rounded-lg object-contain ring-1 ring-line sm:block"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">{c.i18n.lv?.name ?? c.slug}</p>
                    <p className="truncate text-[12px] text-muted">
                      <span className="font-mono">/{c.slug}</span> · {c.products} produkti · {LANGS.filter((l) => c.i18n[l]?.name).length}/5 valodas
                    </p>
                  </div>
                  <Switch
                    size="sm"
                    checked={c.is_active}
                    label={`${c.i18n.lv?.name ?? c.slug}: aktīva`}
                    onChange={(v) => {
                      setOrder((o) => o.map((x) => (x.id === c.id ? { ...x, is_active: v } : x)));
                      run(() => setCategoryActive(c.id, v), { onError: () => setOrder((o) => o.map((x) => (x.id === c.id ? { ...x, is_active: !v } : x))) });
                    }}
                  />
                  <button type="button" className={btn("ghost", "sm")} onClick={() => setDraft(toDraft(c))} aria-label={`Rediģēt ${c.i18n.lv?.name ?? c.slug}`}>
                    <Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Rediģēt</span>
                  </button>
                  <button
                    type="button"
                    className={btn("ghost", "sm", "text-red-600 hover:bg-red-50")}
                    aria-label={`Dzēst ${c.i18n.lv?.name ?? c.slug}`}
                    disabled={pending}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: `Dzēst kategoriju „${c.i18n.lv?.name ?? c.slug}”?`,
                          description: c.products
                            ? `${c.products} produkti paliks bez kategorijas (tie netiks dzēsti). Apsveriet kategorijas paslēpšanu.`
                            : "Kategorijā nav produktu.",
                          confirmLabel: "Dzēst",
                          danger: true,
                        })
                      )
                        run(() => deleteCategory(c.id));
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
      <CategoryDrawer draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}

function CategoryDrawer({ draft, onClose }: { draft: Draft | null; onClose: () => void }) {
  return (
    <Drawer open={Boolean(draft)} onClose={onClose} title={draft?.id ? "Rediģēt kategoriju" : "Jauna kategorija"} width="max-w-2xl">
      {draft && <CategoryForm key={draft.id ?? "new"} initial={draft} onDone={onClose} />}
    </Drawer>
  );
}

function CategoryForm({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const [d, setD] = useState(initial);
  const [lang, setLang] = useState<Lang>("lv");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { run, pending } = useActionRunner();

  const setText = (key: "name" | "description", v: string) =>
    setD((x) => {
      const next = { ...x, i18n: { ...x.i18n, [lang]: { ...x.i18n[lang], [key]: v } } };
      if (lang === "lv" && key === "name" && !slugTouched) next.slug = slugify(v);
      return next;
    });

  async function upload(file: File) {
    if (!IMAGE_TYPES.includes(file.type)) return toast.error("Neatbalstīts attēla formāts");
    setUploading(true);
    try {
      const { url } = await uploadToBucket("product-images", `categories/${d.slug || "jauna"}`, file);
      setD((x) => ({ ...x, image: url }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Augšupielāde neizdevās");
    } finally {
      setUploading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!d.i18n.lv.name.trim()) errs["i18n.lv.name"] = "Latviešu nosaukums ir obligāts";
    if (!SLUG_RE.test(d.slug)) errs.slug = "Atļauti tikai mazie latīņu burti, cipari un domuzīmes";
    setErrors(errs);
    if (errs["i18n.lv.name"]) setLang("lv");
    if (Object.keys(errs).length) return;
    const i18n = Object.fromEntries(LANGS.filter((l) => l === "lv" || d.i18n[l].name.trim()).map((l) => [l, d.i18n[l]]));
    run(() => saveCategory({ id: d.id, slug: d.slug, icon: d.icon as CategoryPayload["icon"], image: d.image, is_active: d.is_active, i18n }), {
      onSuccess: () => onDone(),
      onError: (_e, fe) => fe && setErrors(fe),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field label="Slug (URL)" htmlFor="c-slug" error={errors.slug} hint="/katalogs/…">
          <input
            id="c-slug"
            className={cn(inputCls, "font-mono text-[13px]")}
            value={d.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setD({ ...d, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") });
            }}
            onBlur={() => setD((x) => ({ ...x, slug: slugify(x.slug) }))}
          />
        </Field>
        <div className="flex items-center gap-2.5 pt-6">
          <Switch checked={d.is_active} onChange={(v) => setD({ ...d, is_active: v })} label="Aktīva" />
          <span className="text-[13px] font-semibold text-ink">Aktīva</span>
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold text-ink/80">Ikona</legend>
        <div className="grid grid-cols-5 gap-2">
          {CATEGORY_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setD({ ...d, icon: ic })}
              aria-pressed={d.icon === ic}
              title={ICON_LABEL[ic]}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[10.5px] font-semibold transition",
                d.icon === ic ? "border-navy-700 bg-navy-700 text-brand-400" : "border-line text-muted hover:border-navy-300 hover:text-navy-700",
              )}
            >
              <CategoryIcon name={ic} className="h-5 w-5" />
              <span className={d.icon === ic ? "text-white" : ""}>{ICON_LABEL[ic]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="Attēls" htmlFor="c-img" hint="Produkta foto kategorijas kartītei">
        <div className="flex items-center gap-3">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-slate-50">
            {d.image ? (
              <Image src={d.image} alt="" fill sizes="64px" unoptimized={imgUnoptimized(d.image)} className="object-contain p-1" />
            ) : (
              <ImagePlus className="h-5 w-5 text-slate-300" />
            )}
          </div>
          <input
            id="c-img"
            className={cn(inputCls, "text-[13px]")}
            value={d.image}
            onChange={(e) => setD({ ...d, image: e.target.value })}
            placeholder="/media/… vai https://…"
          />
          <button type="button" className={btn("outline")} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Spinner /> : <ImagePlus className="h-4 w-4" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </div>
      </Field>

      <div className="rounded-xl border border-line">
        <div role="tablist" aria-label="Valodas" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-3 pt-2">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lang === l}
              onClick={() => setLang(l)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-2.5 pb-2 pt-1 text-[12px] font-bold uppercase",
                lang === l ? "border-navy-700 text-navy-700" : "border-transparent text-muted hover:text-ink",
              )}
              title={LANG_LABEL[l]}
            >
              {l}
              <span className={cn("h-1.5 w-1.5 rounded-full", d.i18n[l].name ? "bg-emerald-500" : "bg-slate-300")} />
            </button>
          ))}
        </div>
        <div className="space-y-4 p-4" role="tabpanel">
          <Field label={`Nosaukums (${LANG_LABEL[lang]})${lang === "lv" ? " *" : ""}`} htmlFor="c-name" error={errors[`i18n.${lang}.name`]}>
            <input id="c-name" className={inputCls} value={d.i18n[lang].name} onChange={(e) => setText("name", e.target.value)} />
          </Field>
          <Field label="Apraksts" htmlFor="c-desc" hint="Rādīts kategorijas lapā un meta aprakstā">
            <textarea id="c-desc" rows={4} className={textareaCls} value={d.i18n[lang].description} onChange={(e) => setText("description", e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" className={btn("outline")} onClick={onDone}>
          Atcelt
        </button>
        <button type="submit" className={btn("dark")} disabled={pending}>
          {pending && <Spinner />} Saglabāt
        </button>
      </div>
    </form>
  );
}
