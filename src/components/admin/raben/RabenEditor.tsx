"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookUser,
  Box,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  CopyPlus,
  ExternalLink,
  Factory,
  FlaskConical,
  Layers,
  Mail,
  MapPin,
  PackageCheck,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  Trash2,
  Truck,
  Undo2,
  Warehouse,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  COUNTRY_NAMES,
  GOODS_CHARACTER,
  MYRABEN_URL,
  RABEN_DIRECTION,
  RABEN_STATUS,
  UNIT_ORDER,
  UNIT_PRESETS,
  lvDate,
  partyContact,
  partyLines,
  rabenPlainText,
  rabenTotals,
  sameParty,
  toParty,
  unitFromPreset,
  type GoodsCharacter,
  type RabenAddress,
  type RabenDirection,
  type RabenForm,
  type RabenParty,
  type RabenStatus,
  type RabenUnit,
  type RabenUnitType,
} from "@/lib/admin/raben";
import {
  deleteRabenOrder,
  duplicateRabenOrder,
  saveRabenAddress,
  saveRabenOrder,
  setRabenStatus,
  type RabenOrderPayload,
} from "@/lib/admin/actions/raben";
import { cn } from "@/lib/utils";
import { Field, Spinner, Switch, useActionRunner, useConfirm } from "../client-ui";
import { btn, inputCls, selectCls, textareaCls } from "../styles";
import { CopyButton, CopyRow, PartyForm, copyText, partyErrors } from "./parts";

type Meta = {
  id: string;
  number: string;
  status: RabenStatus;
  raben_number: string | null;
  cost_net: number | null;
  submitted_at: string | null;
  delivered_at: string | null;
};


const STEPS: { title: string; hint: string; icon: LucideIcon }[] = [
  { title: "Maršruts", hint: "No kurienes un uz kurieni", icon: MapPin },
  { title: "Krava", hint: "Paletes, svars, izmēri", icon: Box },
  { title: "Datumi", hint: "Iekraušana un piegāde", icon: CalendarDays },
  { title: "Pārbaude", hint: "Ievadīšana myRaben", icon: ClipboardCheck },
];

const statusTone: Record<RabenStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  ready: "bg-brand-50 text-brand-800 ring-brand-200",
  submitted: "bg-sky-50 text-sky-700 ring-sky-200",
  in_transit: "bg-violet-50 text-violet-700 ring-violet-200",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
};

const numOr = (v: string, fallback = 0) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};
const fmtKg = (n: number) => new Intl.NumberFormat("lv-LV", { maximumFractionDigits: 1 }).format(n);
const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

function findAddress(list: RabenAddress[], re: RegExp) {
  return list.find((a) => re.test(`${a.label ?? ""} ${a.name}`));
}
const stripAddress = (a: RabenAddress): RabenParty => toParty(a);

export function RabenEditor({
  initial,
  meta,
  addresses: initialAddresses,
  linkedOrder,
  initialStep = 0,
}: {
  initial: RabenForm;
  meta: Meta | null;
  addresses: RabenAddress[];
  linkedOrder: { id: string; number: string } | null;
  initialStep?: number;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const confirm = useConfirm();
  const { run, pending } = useActionRunner();

  const [form, setForm] = useState<RabenForm>(initial);
  const [addresses, setAddresses] = useState(initialAddresses);
  const [sameLoading, setSameLoading] = useState(() => !initial.loading.name || sameParty(initial.shipper, initial.loading));
  const [sameUnloading, setSameUnloading] = useState(() => !initial.unloading.name || sameParty(initial.consignee, initial.unloading));
  const [step, setStep] = useState(Math.min(3, Math.max(0, initialStep)));
  const [dir, setDir] = useState(1);
  const [tried, setTried] = useState<Record<number, boolean>>({});
  const [savedSnap, setSavedSnap] = useState(() => {
    const sl = !initial.loading.name || sameParty(initial.shipper, initial.loading);
    const su = !initial.unloading.name || sameParty(initial.consignee, initial.unloading);
    return JSON.stringify({ ...initial, loading: sl ? initial.shipper : initial.loading, unloading: su ? initial.consignee : initial.unloading });
  });

  const locked = !!meta && ["submitted", "in_transit", "delivered"].includes(meta.status);

  // effective parties ("same as" toggles)
  const eff: RabenForm = useMemo(
    () => ({ ...form, loading: sameLoading ? form.shipper : form.loading, unloading: sameUnloading ? form.consignee : form.unloading }),
    [form, sameLoading, sameUnloading],
  );
  const snap = JSON.stringify(eff);
  const dirty = !meta || snap !== savedSnap;
  const changed = snap !== savedSnap;
  const totals = rabenTotals(form.units);

  useEffect(() => {
    if (!changed) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [changed]);

  const set = <K extends keyof RabenForm>(k: K, v: RabenForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  // ── validation per step ──
  const partyOk = (p: RabenParty) => Object.keys(partyErrors(p)).length === 0;
  const stepProblems = useMemo(() => {
    const route: string[] = [];
    if (!partyOk(eff.shipper)) route.push("Nosūtītājs nav pilnībā aizpildīts");
    if (!partyOk(eff.loading)) route.push("Iekraušanas vieta nav pilnībā aizpildīta");
    if (!partyOk(eff.consignee)) route.push("Preču saņēmējs nav pilnībā aizpildīts");
    if (!partyOk(eff.unloading)) route.push("Izkraušanas vieta nav pilnībā aizpildīta");
    const cargo: string[] = [];
    if (!eff.units.length) cargo.push("Nav pievienota neviena kravas vienība");
    eff.units.forEach((u, i) => {
      if (!(u.qty >= 1)) cargo.push(`${i + 1}. vienībai norādiet skaitu`);
      if (!(u.weight_kg > 0)) cargo.push(`${i + 1}. vienībai norādiet svaru`);
      if (!(u.length_cm > 0 && u.width_cm > 0 && u.height_cm > 0)) cargo.push(`${i + 1}. vienībai norādiet izmērus`);
    });
    const dates: string[] = [];
    if (!eff.loading_date) dates.push("Norādiet iekraušanas datumu");
    if (eff.loading_from && eff.loading_to && eff.loading_from >= eff.loading_to) dates.push("Laika logā “no” jābūt pirms “līdz”");
    if (eff.delivery_date && eff.loading_date && eff.delivery_date < eff.loading_date) dates.push("Piegādes datums ir pirms iekraušanas");
    return [route, cargo, dates, [] as string[]];
  }, [eff]);
  const allProblems = stepProblems.slice(0, 3).flat();

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setStep(to);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };
  const next = () => {
    if (stepProblems[step].length) {
      setTried((t) => ({ ...t, [step]: true }));
      return;
    }
    go(Math.min(3, step + 1));
  };

  const payload = (): RabenOrderPayload => ({
    direction: eff.direction,
    order_id: eff.order_id,
    shipper: eff.shipper,
    loading: eff.loading,
    consignee: eff.consignee,
    unloading: eff.unloading,
    goods_character: eff.goods_character,
    limited_quantity: eff.limited_quantity,
    units: eff.units.map((u) => ({ ...u, qty: Math.round(u.qty) })),
    loading_date: eff.loading_date,
    loading_from: eff.loading_from,
    loading_to: eff.loading_to,
    delivery_date: eff.delivery_date,
    reference: eff.reference,
    cargo_value: eff.cargo_value,
    notes: eff.notes,
  });

  const save = (markReady: boolean) => {
    if (markReady && allProblems.length) {
      setTried({ 0: true, 1: true, 2: true });
      const first = stepProblems.findIndex((p) => p.length);
      if (first >= 0 && first !== step) go(first);
      return;
    }
    const snapNow = snap;
    run(() => saveRabenOrder(meta?.id ?? null, payload(), markReady), {
      loading: "Saglabā…",
      onSuccess: (d) => {
        setSavedSnap(snapNow);
        if (!meta) router.replace(`/admin/raben/${d.id}?step=3`);
        else {
          if (markReady) go(3);
          router.refresh();
        }
      },
    });
  };

  const changeStatus = (status: RabenStatus, extra?: { raben_number?: string | null; cost_net?: number | null }) => {
    if (!meta) return;
    run(() => setRabenStatus(meta.id, status, extra), { loading: "Atjaunina…", onSuccess: () => router.refresh() });
  };

  // ── quick routes ──
  const zg = findAddress(addresses, /zeller/i);
  const wh = findAddress(addresses, /btg|noliktav/i);
  const applyRoute = (direction: RabenDirection) => {
    setForm((f) => {
      const n = { ...f, direction };
      if (direction === "inbound" && zg && wh) {
        n.shipper = stripAddress(zg);
        n.loading = stripAddress(zg);
        n.consignee = stripAddress(wh);
        n.unloading = stripAddress(wh);
      } else if (direction === "outbound" && wh) {
        n.shipper = stripAddress(wh);
        n.loading = stripAddress(wh);
        if (sameParty(f.consignee, wh) || (zg && sameParty(f.consignee, zg))) {
          n.consignee = toParty(null);
          n.unloading = toParty(null);
        }
      } else if (direction === "return" && zg && wh) {
        n.shipper = stripAddress(wh);
        n.loading = stripAddress(wh);
        n.consignee = stripAddress(zg);
        n.unloading = stripAddress(zg);
      }
      return n;
    });
    if (direction !== "other") {
      setSameLoading(true);
      setSameUnloading(true);
    }
  };

  const onAddressSaved = (a: RabenAddress) => setAddresses((l) => (l.some((x) => x.id === a.id) ? l.map((x) => (x.id === a.id ? a : x)) : [...l, a]));

  const header = (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {meta && (
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ring-1 ring-inset", statusTone[meta.status])}>
          {RABEN_STATUS[meta.status].label}
        </span>
      )}
      {linkedOrder && (
        <Link href={`/admin/orders/${linkedOrder.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-2.5 py-1 text-[12px] font-bold text-navy-700 ring-1 ring-inset ring-navy-100 hover:bg-navy-100">
          <ClipboardList className="h-3.5 w-3.5" aria-hidden /> Pasūtījums {linkedOrder.number}
        </Link>
      )}
      <AnimatePresence>
        {changed && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-[12px] font-bold text-orange-700 ring-1 ring-inset ring-orange-200"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" aria-hidden /> Nesaglabātas izmaiņas
          </motion.span>
        )}
      </AnimatePresence>
      <div className="ml-auto flex flex-wrap gap-2">
        {meta && (
          <button
            type="button"
            className={btn("outline", "sm")}
            disabled={pending}
            onClick={() => run(() => duplicateRabenOrder(meta.id), { loading: "Kopē…", onSuccess: (d) => router.push(`/admin/raben/${d.id}`) })}
            title="Izveidot jaunu melnrakstu ar tām pašām adresēm un kravu"
          >
            <CopyPlus className="h-3.5 w-3.5" /> Kopēt kā jaunu
          </button>
        )}
        {meta && ["draft", "ready", "cancelled"].includes(meta.status) && (
          <button
            type="button"
            className={btn("ghost", "sm", "text-red-600 hover:bg-red-50")}
            disabled={pending}
            onClick={async () => {
              if (!(await confirm({ title: `Dzēst ${meta.number}?`, description: "Raben pasūtījums tiks neatgriezeniski dzēsts.", confirmLabel: "Dzēst", danger: true }))) return;
              run(() => deleteRabenOrder(meta.id), { loading: "Dzēš…", onSuccess: () => router.replace("/admin/raben") });
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Dzēst
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {header}

      {locked && step !== 3 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Šis pasūtījums jau ir iesniegts Raben. Izmaiņas šeit <b>netiek automātiski nosūtītas uz myRaben</b> — ja kaut ko maināt, izlabojiet to arī myRaben vai
            sazinieties ar Raben.
          </p>
        </div>
      )}

      {/* stepper */}
      <ol className="mb-6 grid grid-cols-4 gap-1.5 rounded-2xl border border-line bg-white p-1.5 shadow-card sm:gap-2">
        {STEPS.map((s, i) => {
          const done = i < 3 ? stepProblems[i].length === 0 : false;
          const active = step === i;
          const warn = i < 3 && tried[i] && stepProblems[i].length > 0;
          return (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "relative flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition sm:px-3 sm:py-2.5",
                  active ? "text-white" : "text-ink hover:bg-navy-50/70",
                )}
              >
                {active && (
                  <motion.span layoutId="raben-step" className="absolute inset-0 rounded-xl bg-navy-700 shadow-lift" transition={{ type: "spring", stiffness: 450, damping: 38 }} aria-hidden />
                )}
                <span
                  className={cn(
                    "relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-extrabold ring-2 transition",
                    active
                      ? "bg-brand-400 text-navy-900 ring-brand-300"
                      : warn
                        ? "bg-orange-50 text-orange-600 ring-orange-200"
                        : done
                          ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                          : "bg-slate-50 text-muted ring-line",
                  )}
                >
                  {!active && done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : !active && warn ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                </span>
                <span className="relative hidden min-w-0 sm:block">
                  <span className="block truncate text-[13.5px] font-bold">{s.title}</span>
                  <span className={cn("block truncate text-[11.5px]", active ? "text-white/65" : "text-muted")}>{s.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="-mt-4 mb-4 text-center text-[13px] font-bold text-ink sm:hidden">
        {step + 1}. solis — {STEPS[step].title}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {tried[step] && stepProblems[step].length > 0 && (
            <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-[13px] text-orange-900" role="alert">
              <p className="mb-1 flex items-center gap-2 font-bold">
                <AlertTriangle className="h-4 w-4" aria-hidden /> Lūdzu, papildiniet:
              </p>
              <ul className="ml-6 list-disc space-y-0.5">
                {stepProblems[step].map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -28 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {step === 0 && (
                <RouteStep
                  form={form}
                  set={set}
                  addresses={addresses}
                  onAddressSaved={onAddressSaved}
                  applyRoute={applyRoute}
                  hasPresets={!!(zg && wh)}
                  sameLoading={sameLoading}
                  setSameLoading={setSameLoading}
                  sameUnloading={sameUnloading}
                  setSameUnloading={setSameUnloading}
                  showErrors={!!tried[0]}
                />
              )}
              {step === 1 && <CargoStep form={form} set={set} showErrors={!!tried[1]} />}
              {step === 2 && <DatesStep form={form} set={set} />}
              {step === 3 && (
                <SummaryStep
                  form={eff}
                  meta={meta}
                  sameLoading={sameLoading}
                  sameUnloading={sameUnloading}
                  problems={allProblems}
                  dirty={dirty}
                  pending={pending}
                  onFix={() => go(stepProblems.findIndex((p) => p.length))}
                  onSaveReady={() => save(true)}
                  onStatus={changeStatus}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* footer navigation */}
          <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex items-center gap-2 border-t border-line bg-white/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:shadow-card">
            <button type="button" className={btn("outline")} onClick={() => go(Math.max(0, step - 1))} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Atpakaļ</span>
            </button>
            <button type="button" className={btn("ghost")} onClick={() => save(false)} disabled={pending || (!dirty && !!meta)}>
              {pending ? <Spinner /> : <Save className="h-4 w-4" />}
              <span className="hidden sm:inline">{meta ? "Saglabāt izmaiņas" : "Saglabāt melnrakstu"}</span>
              <span className="sm:hidden">Saglabāt</span>
            </button>
            <div className="ml-auto" />
            {step < 3 ? (
              <button type="button" className={btn("dark")} onClick={next}>
                Tālāk <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              (!meta || meta.status === "draft") && (
                <button type="button" className={btn("primary")} onClick={() => save(true)} disabled={pending}>
                  <ClipboardCheck className="h-4 w-4" /> Saglabāt — gatavs myRaben
                </button>
              )
            )}
          </div>
        </div>

        {/* live summary */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-3">
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
              <div className="relative bg-navy-700 px-4 py-3 text-white">
                <div className="absolute inset-y-0 right-0 w-24 bg-[repeating-linear-gradient(-45deg,transparent_0_8px,rgb(255_193_14/0.18)_8px_16px)]" aria-hidden />
                <p className="relative text-[11px] font-bold uppercase tracking-[0.12em] text-white/60">{meta?.number ?? "Jauns pasūtījums"}</p>
                <p className="relative text-[15px] font-extrabold">{RABEN_DIRECTION[form.direction].label}</p>
              </div>
              <div className="space-y-3 p-4 text-[13px]">
                <RouteLine from={eff.loading} to={eff.unloading} />
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Vienības" value={String(totals.pieces)} />
                  <Stat label="Svars" value={`${fmtKg(totals.weight)} kg`} />
                  <Stat label="Palešu vietas" value={String(totals.places)} />
                  <Stat label="LDM" value={String(totals.ldm)} />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-muted">Iekraušana</span>
                  <span className="font-bold text-ink">{lvDate(form.loading_date) || "—"}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-muted">Prece</span>
                  <span className="font-bold text-ink">
                    {GOODS_CHARACTER[form.goods_character]}
                    {form.limited_quantity ? " · LQ" : ""}
                  </span>
                </div>
              </div>
            </div>
            <a href={MYRABEN_URL} target="_blank" rel="noreferrer" className={btn("outline", "md", "w-full")}>
              <ExternalLink className="h-4 w-4" /> Atvērt myRaben
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <p className="text-[15px] font-extrabold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function RouteLine({ from, to }: { from: RabenParty; to: RabenParty }) {
  const place = (p: RabenParty) => (p.city ? `${p.city}${p.country && p.country !== "LV" ? `, ${p.country}` : ""}` : "—");
  return (
    <div className="flex items-stretch gap-3">
      <div className="flex flex-col items-center py-1">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-navy-600 bg-white" aria-hidden />
        <span className="my-0.5 w-px flex-1 border-l-2 border-dashed border-navy-200" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-brand-400 ring-2 ring-brand-200" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-[11px] font-semibold text-muted">Iekraušana</p>
          <p className="truncate font-bold text-ink">{from.name || "—"}</p>
          <p className="truncate text-[12px] text-muted">{place(from)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-muted">Izkraušana</p>
          <p className="truncate font-bold text-ink">{to.name || "—"}</p>
          <p className="truncate text-[12px] text-muted">{place(to)}</p>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── step 1 — route ─────────────────────────
function RouteStep({
  form,
  set,
  addresses,
  onAddressSaved,
  applyRoute,
  hasPresets,
  sameLoading,
  setSameLoading,
  sameUnloading,
  setSameUnloading,
  showErrors,
}: {
  form: RabenForm;
  set: <K extends keyof RabenForm>(k: K, v: RabenForm[K]) => void;
  addresses: RabenAddress[];
  onAddressSaved: (a: RabenAddress) => void;
  applyRoute: (d: RabenDirection) => void;
  hasPresets: boolean;
  sameLoading: boolean;
  setSameLoading: (v: boolean) => void;
  sameUnloading: boolean;
  setSameUnloading: (v: boolean) => void;
  showErrors: boolean;
}) {
  const routes: { id: RabenDirection; title: string; hint: string; icon: LucideIcon }[] = [
    { id: "inbound", title: "Zeller+Gmelin → noliktava", hint: "Ienākošā krava no Vācijas", icon: Factory },
    { id: "outbound", title: "Noliktava → klients", hint: "Krava klientam", icon: Warehouse },
    { id: "return", title: "Noliktava → Zeller+Gmelin", hint: "Atgriešana ražotājam", icon: Undo2 },
    { id: "other", title: "Cits maršruts", hint: "Adreses izvēlos pats", icon: MapPin },
  ];
  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-1 text-[16px] font-extrabold text-ink">Kurp brauc krava?</h2>
        <p className="mb-3 text-[13px] text-muted">Izvēlieties maršrutu — adreses aizpildīsies automātiski. Tās vienmēr var nomainīt zemāk.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {routes.map((r) => {
            const active = form.direction === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => applyRoute(r.id)}
                disabled={!hasPresets && r.id !== "other" && r.id !== "outbound"}
                aria-pressed={active}
                className={cn(
                  "group relative flex items-start gap-3 rounded-2xl border bg-white p-3.5 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lift disabled:opacity-50",
                  active ? "border-navy-600 ring-2 ring-navy-600" : "border-line hover:border-navy-300",
                )}
              >
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl transition", active ? "bg-navy-700 text-brand-400" : "bg-navy-50 text-navy-600")}>
                  <r.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 pr-6">
                  <span className="block text-[13.5px] font-bold leading-snug text-ink">{r.title}</span>
                  <span className="block text-[12px] text-muted">{r.hint}</span>
                </span>
                {active && (
                  <span className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <PartyCard
          n={1}
          title="Nosūtītājs"
          hint="Kas sūta kravu (juridiski)"
          value={form.shipper}
          onChange={(p) => set("shipper", p)}
          addresses={addresses}
          onAddressSaved={onAddressSaved}
          showErrors={showErrors}
        />
        <PartyCard
          n={2}
          title="Iekraušanas vieta"
          hint="Kur Raben paņems kravu"
          value={sameLoading ? form.shipper : form.loading}
          onChange={(p) => set("loading", p)}
          addresses={addresses}
          onAddressSaved={onAddressSaved}
          same={{ label: "Tā pati adrese kā nosūtītājam", checked: sameLoading, onChange: (v) => {
            setSameLoading(v);
            if (!v) set("loading", form.shipper);
          } }}
          showErrors={showErrors}
        />
        <PartyCard
          n={3}
          title="Preču saņēmējs"
          hint="Kam krava ir adresēta"
          value={form.consignee}
          onChange={(p) => set("consignee", p)}
          addresses={addresses}
          onAddressSaved={onAddressSaved}
          showErrors={showErrors}
        />
        <PartyCard
          n={4}
          title="Izkraušanas vieta"
          hint="Kur kravu izkraus"
          value={sameUnloading ? form.consignee : form.unloading}
          onChange={(p) => set("unloading", p)}
          addresses={addresses}
          onAddressSaved={onAddressSaved}
          same={{ label: "Tā pati adrese kā saņēmējam", checked: sameUnloading, onChange: (v) => {
            setSameUnloading(v);
            if (!v) set("unloading", form.consignee);
          } }}
          showErrors={showErrors}
        />
      </div>
    </div>
  );
}

function PartyCard({
  n,
  title,
  hint,
  value,
  onChange,
  addresses,
  onAddressSaved,
  same,
  showErrors,
}: {
  n: number;
  title: string;
  hint: string;
  value: RabenParty;
  onChange: (p: RabenParty) => void;
  addresses: RabenAddress[];
  onAddressSaved: (a: RabenAddress) => void;
  same?: { label: string; checked: boolean; onChange: (v: boolean) => void };
  showErrors: boolean;
}) {
  const { run, pending } = useActionRunner();
  const errors = partyErrors(value);
  const complete = Object.keys(errors).length === 0;
  const [editing, setEditing] = useState(!complete && !same?.checked);
  const match = addresses.find((a) => sameParty(a, value));
  const isSame = !!same?.checked;
  const showForm = !isSame && (editing || partyLines(value).length === 0);

  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border bg-white shadow-card transition",
        showErrors && !complete ? "border-orange-300 ring-2 ring-orange-100" : "border-line",
      )}
    >
      <header className="flex items-center gap-3 border-b border-line/80 px-4 py-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy-700 text-[12px] font-extrabold text-brand-400">{n}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14.5px] font-bold text-ink">{title}</h3>
          <p className="text-[12px] text-muted">{hint}</p>
        </div>
        {complete ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-label="Aizpildīts" />
        ) : (
          <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700 ring-1 ring-inset ring-orange-200">Jāaizpilda</span>
        )}
      </header>

      <div className="flex-1 space-y-3 p-4">
        {same && (
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
            <span className="text-[13px] font-semibold text-ink">{same.label}</span>
            <Switch checked={same.checked} onChange={same.onChange} label={same.label} size="sm" />
          </label>
        )}

        {!isSame && (
          <div className="flex items-center gap-2">
            <BookUser className="h-4 w-4 shrink-0 text-navy-500" aria-hidden />
            <select
              className={cn(selectCls, "h-9 text-[13px]")}
              value={match?.id ?? ""}
              onChange={(e) => {
                const a = addresses.find((x) => x.id === e.target.value);
                if (a) {
                  onChange(toParty(a));
                  setEditing(false);
                }
              }}
              aria-label={`${title}: izvēlēties no adrešu grāmatas`}
            >
              <option value="">{match ? "" : "Izvēlēties no adrešu grāmatas…"}</option>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label || a.name} — {a.city}
                </option>
              ))}
            </select>
          </div>
        )}

        {!showForm ? (
          <div className={cn("rounded-xl border border-dashed px-3.5 py-3", isSame ? "border-line bg-slate-50/60" : "border-navy-200 bg-navy-50/30")}>
            {partyLines(value).length ? (
              <>
                {partyLines(value).map((l, i) => (
                  <p key={i} className={cn("text-[13px]", i === 0 ? "font-bold text-ink" : "text-ink/80")}>
                    {l}
                  </p>
                ))}
                {partyContact(value) && <p className="mt-1 text-[12px] text-muted">{partyContact(value)}</p>}
              </>
            ) : (
              <p className="text-[13px] text-muted">Adrese vēl nav norādīta.</p>
            )}
          </div>
        ) : (
          <PartyForm
            value={value}
            onChange={(p) => {
              setEditing(true);
              onChange(p);
            }}
            errors={showErrors ? errors : undefined}
          />
        )}
      </div>

      {!isSame && (
        <footer className="flex flex-wrap items-center gap-2 border-t border-line/80 px-4 py-2.5">
          {showForm ? (
            <button type="button" className={btn("dark", "sm")} onClick={() => setEditing(false)} disabled={!complete}>
              <Check className="h-3.5 w-3.5" /> Gatavs
            </button>
          ) : (
            <button type="button" className={btn("outline", "sm")} onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Labot
            </button>
          )}
          {!showForm && (
            <button type="button" className={btn("ghost", "sm")} onClick={() => { onChange(toParty(null)); setEditing(true); }}>
              <Plus className="h-3.5 w-3.5" /> Jauna adrese
            </button>
          )}
          {complete && !match && (
            <button
              type="button"
              className={btn("ghost", "sm", "ml-auto")}
              disabled={pending}
              onClick={() =>
                run(() => saveRabenAddress(null, { ...value, label: value.name, notes: null }), {
                  loading: "Saglabā adresi…",
                  onSuccess: (a) => onAddressSaved(a),
                })
              }
            >
              <BookUser className="h-3.5 w-3.5" /> Saglabāt adrešu grāmatā
            </button>
          )}
          {match && <span className="ml-auto text-[11.5px] font-semibold text-emerald-700">✓ No adrešu grāmatas</span>}
        </footer>
      )}
    </section>
  );
}

// ───────────────────────── step 2 — cargo ─────────────────────────
function CargoStep({ form, set, showErrors }: { form: RabenForm; set: <K extends keyof RabenForm>(k: K, v: RabenForm[K]) => void; showErrors: boolean }) {
  const totals = rabenTotals(form.units);
  const update = (i: number, patch: Partial<RabenUnit>) => set("units", form.units.map((u, j) => (j === i ? { ...u, ...patch } : u)));
  const add = (t: RabenUnitType) => set("units", [...form.units, unitFromPreset(t)]);
  const remove = (i: number) => set("units", form.units.filter((_, j) => j !== i));

  const chars: { id: GoodsCharacter; hint: string; icon: LucideIcon }[] = [
    { id: "chemical", hint: "Eļļas, smērvielas, tehniskie šķidrumi", icon: FlaskConical },
    { id: "neutral", hint: "Parastas preces bez smaržas/noplūdes riska", icon: Box },
    { id: "food", hint: "Pārtika vai ar to saistītas preces", icon: PackageCheck },
    { id: "adr", hint: "Bīstamā krava ar ADR dokumentiem", icon: AlertTriangle },
  ];

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-1 text-[16px] font-extrabold text-ink">Kas tiek sūtīts?</h2>
        <p className="mb-3 text-[13px] text-muted">Nospiediet uz iepakojuma veida, lai to pievienotu. Izmēri un svars ieliekas automātiski — pārbaudiet un izlabojiet, ja vajag.</p>
        <div className="flex flex-wrap gap-2">
          {UNIT_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => add(t)}
              className="group inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-left shadow-card transition hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-lift active:scale-[0.98]"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-400/90 text-navy-900 transition group-hover:bg-brand-400">
                <Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden />
              </span>
              <span>
                <span className="block text-[13px] font-bold leading-tight text-ink">{UNIT_PRESETS[t].label}</span>
                <span className="block text-[11px] text-muted">{UNIT_PRESETS[t].hint}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <AnimatePresence initial={false}>
          {form.units.map((u, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
              className={cn(
                "rounded-2xl border bg-white p-4 shadow-card",
                showErrors && (!(u.qty >= 1) || !(u.weight_kg > 0)) ? "border-orange-300" : "border-line",
              )}
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-navy-700 text-brand-400">
                  <Layers className="h-4 w-4" aria-hidden />
                </span>
                <select
                  className={cn(selectCls, "h-9 max-w-[240px] font-bold")}
                  value={u.type}
                  aria-label="Iepakojuma veids"
                  onChange={(e) => {
                    const t = e.target.value as RabenUnitType;
                    const p = UNIT_PRESETS[t];
                    update(i, { type: t, length_cm: p.l, width_cm: p.w, height_cm: p.h, weight_kg: p.kg });
                  }}
                >
                  {UNIT_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {UNIT_PRESETS[t].label}
                    </option>
                  ))}
                </select>
                <span className="hidden text-[12px] text-muted sm:inline">
                  Kopā: <b className="text-ink">{fmtKg(u.qty * u.weight_kg)} kg</b>
                </span>
                <button type="button" onClick={() => remove(i)} className={btn("ghost", "sm", "ml-auto text-red-600 hover:bg-red-50")} aria-label={`Noņemt ${i + 1}. vienību`}>
                  <X className="h-4 w-4" /> <span className="hidden sm:inline">Noņemt</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                <Field label="Skaits (gab.)" className="sm:col-span-1">
                  <Stepper value={u.qty} onChange={(v) => update(i, { qty: v })} />
                </Field>
                <Field label="Svars 1 gab. (kg)" className="sm:col-span-1" hint="ar iepakojumu">
                  <input className={cn(inputCls, "tabular-nums")} inputMode="decimal" value={u.weight_kg || ""} onChange={(e) => update(i, { weight_kg: numOr(e.target.value) })} />
                </Field>
                <Field label="Izmēri: garums × platums × augstums (cm)" className="col-span-2 sm:col-span-3">
                  <div className="flex items-center gap-1.5">
                    {(["length_cm", "width_cm", "height_cm"] as const).map((k, j) => (
                      <span key={k} className="contents">
                        {j > 0 && <span className="text-muted">×</span>}
                        <input
                          className={cn(inputCls, "px-2 text-center tabular-nums")}
                          inputMode="numeric"
                          aria-label={k === "length_cm" ? "Garums cm" : k === "width_cm" ? "Platums cm" : "Augstums cm"}
                          value={u[k] || ""}
                          onChange={(e) => update(i, { [k]: numOr(e.target.value) } as Partial<RabenUnit>)}
                        />
                      </span>
                    ))}
                  </div>
                </Field>
                <Field label="Var kraut virsū" className="col-span-2 sm:col-span-1">
                  <div className="flex h-10 items-center gap-2">
                    <Switch checked={u.stackable} onChange={(v) => update(i, { stackable: v })} label="Var kraut virsū" />
                    <span className="text-[13px] font-semibold text-ink">{u.stackable ? "Jā" : "Nē"}</span>
                  </div>
                </Field>
                <Field label="Saturs (ko satur)" className="col-span-2 sm:col-span-6">
                  <input className={inputCls} value={u.description} onChange={(e) => update(i, { description: e.target.value })} placeholder="piem. Motoreļļa 20 L kannās, 32 gab." />
                </Field>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!form.units.length && (
          <div className="rounded-2xl border-2 border-dashed border-line px-6 py-10 text-center">
            <Box className="mx-auto mb-2 h-7 w-7 text-navy-300" aria-hidden />
            <p className="text-[14px] font-bold text-ink">Krava vēl nav pievienota</p>
            <p className="text-[13px] text-muted">Augstāk izvēlieties, piemēram, „EUR palete”.</p>
          </div>
        )}
      </section>

      {form.units.length > 0 && (
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-navy-700 p-3 text-white sm:grid-cols-4">
          {[
            ["Vienības", String(totals.pieces)],
            ["Kopējais svars", `${fmtKg(totals.weight)} kg`],
            ["Palešu vietas", String(totals.places)],
            ["Kravas metri (LDM)", String(totals.ldm)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-white/[0.06] px-3 py-2">
              <p className="text-[11px] font-semibold text-white/60">{l}</p>
              <p className="text-[18px] font-extrabold tabular-nums text-brand-300">{v}</p>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-line bg-white p-4 shadow-card">
        <h3 className="mb-1 text-[14.5px] font-bold text-ink">Preču raksturojums</h3>
        <p className="mb-3 text-[12.5px] text-muted">Tas pats lauks, kas myRaben. Divinol eļļām parasti — „Ķīmiskā vide”.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {chars.map((c) => {
            const active = form.goods_character === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={active}
                onClick={() => set("goods_character", c.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                  active ? "border-navy-600 bg-navy-50/60 ring-2 ring-navy-600" : "border-line hover:border-navy-300",
                )}
              >
                <c.icon className={cn("h-5 w-5 shrink-0", active ? "text-navy-700" : "text-muted")} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-bold text-ink">{GOODS_CHARACTER[c.id]}</span>
                  <span className="block text-[11.5px] text-muted">{c.hint}</span>
                </span>
                <span className={cn("ml-auto grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", active ? "border-navy-700 bg-navy-700" : "border-line")}>
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
              </button>
            );
          })}
        </div>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3">
          <span>
            <span className="block text-[13.5px] font-semibold text-ink">Satur bīstamo kravu ierobežotos daudzumos (LQ)</span>
            <span className="block text-[12px] text-muted">Ieslēdziet tikai tad, ja produkta SDS norādīts ADR ar „LQ” marķējumu.</span>
          </span>
          <Switch checked={form.limited_quantity} onChange={(v) => set("limited_quantity", v)} label="Ierobežoti daudzumi (LQ)" />
        </label>
      </section>
    </div>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex h-10 items-stretch overflow-hidden rounded-lg border border-line bg-white focus-within:border-navy-400 focus-within:ring-4 focus-within:ring-navy-100">
      <button type="button" className="w-9 shrink-0 text-[16px] font-bold text-navy-700 hover:bg-navy-50 disabled:opacity-30" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="Mazāk">
        −
      </button>
      <input
        className="w-full min-w-0 border-x border-line text-center text-[14px] font-bold tabular-nums outline-none"
        inputMode="numeric"
        value={value || ""}
        onChange={(e) => onChange(Math.max(0, Math.min(99, Math.round(numOr(e.target.value)))))}
        aria-label="Skaits"
      />
      <button type="button" className="w-9 shrink-0 text-[16px] font-bold text-navy-700 hover:bg-navy-50" onClick={() => onChange(Math.min(99, value + 1))} aria-label="Vairāk">
        +
      </button>
    </div>
  );
}

// ───────────────────────── step 3 — dates ─────────────────────────
function DatesStep({ form, set }: { form: RabenForm; set: <K extends keyof RabenForm>(k: K, v: RabenForm[K]) => void }) {
  const windows: [string, string, string][] = [
    ["08:00", "12:00", "Rīts"],
    ["12:00", "16:00", "Pēcpusdiena"],
    ["08:00", "16:00", "Visa diena"],
  ];
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
        <h2 className="mb-1 text-[16px] font-extrabold text-ink">Kad paņemt kravu?</h2>
        <p className="mb-4 text-[13px] text-muted">Raben parasti paņem kravu nākamajā darba dienā. Laika logs — kad iekraušanas vietā kāds būs uz vietas.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Iekraušanas datums" htmlFor="rb-ld">
            <input id="rb-ld" type="date" className={inputCls} value={form.loading_date ?? ""} onChange={(e) => set("loading_date", e.target.value || null)} />
          </Field>
          <Field label="Laiks no" htmlFor="rb-lf">
            <input id="rb-lf" type="time" step={900} className={inputCls} value={hhmm(form.loading_from)} onChange={(e) => set("loading_from", e.target.value || null)} />
          </Field>
          <Field label="Laiks līdz" htmlFor="rb-lt">
            <input id="rb-lt" type="time" step={900} className={inputCls} value={hhmm(form.loading_to)} onChange={(e) => set("loading_to", e.target.value || null)} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {windows.map(([a, b, l]) => {
            const active = hhmm(form.loading_from) === a && hhmm(form.loading_to) === b;
            return (
              <button
                key={l}
                type="button"
                onClick={() => {
                  set("loading_from", a);
                  set("loading_to", b);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12.5px] font-bold transition",
                  active ? "border-navy-700 bg-navy-700 text-white" : "border-line bg-white text-navy-700 hover:border-navy-300",
                )}
              >
                {l} · {a}–{b}
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Vēlamais piegādes datums" htmlFor="rb-dd" hint="Nav obligāts">
            <input id="rb-dd" type="date" className={inputCls} min={form.loading_date ?? undefined} value={form.delivery_date ?? ""} onChange={(e) => set("delivery_date", e.target.value || null)} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
        <h2 className="mb-1 text-[16px] font-extrabold text-ink">Papildu informācija</h2>
        <p className="mb-4 text-[13px] text-muted">Šie lauki nav obligāti, bet palīdz vēlāk atrast sūtījumu.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Klienta pasūtījuma Nr. / atsauce" htmlFor="rb-ref" hint="Parādīsies Raben dokumentos">
            <input id="rb-ref" className={inputCls} value={form.reference ?? ""} onChange={(e) => set("reference", e.target.value || null)} placeholder="piem. DIV-2026-0012" />
          </Field>
          <Field label="Kravas vērtība (EUR)" htmlFor="rb-val" hint="Apdrošināšanai, ja vajag">
            <input
              id="rb-val"
              className={cn(inputCls, "tabular-nums")}
              inputMode="decimal"
              value={form.cargo_value ?? ""}
              onChange={(e) => set("cargo_value", e.target.value.trim() ? numOr(e.target.value) : null)}
            />
          </Field>
          <Field label="Piezīmes šoferim / Raben" htmlFor="rb-notes" className="sm:col-span-2">
            <textarea
              id="rb-notes"
              rows={3}
              className={textareaCls}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value || null)}
              placeholder="piem. Iebraukšana no Ventspils ielas, zvanīt 30 min iepriekš. Nepieciešama hidrauliskā pacēlāja platforma."
            />
          </Field>
        </div>
      </section>
    </div>
  );
}

// ───────────────────────── step 4 — summary / myRaben ─────────────────────────
function SummaryStep({
  form,
  meta,
  sameLoading,
  sameUnloading,
  problems,
  dirty,
  pending,
  onFix,
  onSaveReady,
  onStatus,
}: {
  form: RabenForm;
  meta: Meta | null;
  sameLoading: boolean;
  sameUnloading: boolean;
  problems: string[];
  dirty: boolean;
  pending: boolean;
  onFix: () => void;
  onSaveReady: () => void;
  onStatus: (s: RabenStatus, extra?: { raben_number?: string | null; cost_net?: number | null }) => void;
}) {
  const confirm = useConfirm();
  const totals = rabenTotals(form.units);
  const text = rabenPlainText({ ...form, number: meta?.number });
  const [rabenNo, setRabenNo] = useState(meta?.raben_number ?? "");
  const [cost, setCost] = useState(meta?.cost_net != null ? String(meta.cost_net) : "");
  const status = meta?.status ?? "draft";
  const costVal = cost.trim() ? numOr(cost, NaN) : null;

  const partyRows = (p: RabenParty) => (
    <>
      <CopyRow label="Uzņēmums / nosaukums" value={p.name} />
      <CopyRow label="Iela, māja" value={p.street} />
      <CopyRow label="Pasta indekss" value={p.postal_code} mono />
      <CopyRow label="Pilsēta" value={p.city} />
      <CopyRow label="Valsts" value={p.country ? `${COUNTRY_NAMES[p.country] ?? p.country} (${p.country})` : ""} />
      {p.vat_no ? <CopyRow label="PVN Nr." value={p.vat_no} mono /> : null}
      {p.contact_name ? <CopyRow label="Kontaktpersona" value={p.contact_name} /> : null}
      {p.phone ? <CopyRow label="Tālrunis" value={p.phone} mono /> : null}
      {p.email ? <CopyRow label="E-pasts" value={p.email} /> : null}
    </>
  );

  return (
    <div className="space-y-5">
      {problems.length > 0 ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-[13px] text-orange-900">
          <p className="mb-1 flex items-center gap-2 text-[14px] font-bold">
            <AlertTriangle className="h-4 w-4" aria-hidden /> Vēl jāpapildina ({problems.length})
          </p>
          <ul className="mb-3 ml-6 list-disc space-y-0.5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <button type="button" onClick={onFix} className={btn("dark", "sm")}>
            Papildināt <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <StatusPanel
          status={status}
          meta={meta}
          dirty={dirty}
          pending={pending}
          rabenNo={rabenNo}
          setRabenNo={setRabenNo}
          cost={cost}
          setCost={setCost}
          onSaveReady={onSaveReady}
          onSubmitted={() => onStatus("submitted", { raben_number: rabenNo, cost_net: Number.isFinite(costVal as number) ? costVal : null })}
          onSaveNumbers={() => onStatus(status, { raben_number: rabenNo, cost_net: Number.isFinite(costVal as number) ? costVal : null })}
          onStatus={onStatus}
          onCancel={async () => {
            if (!(await confirm({ title: "Atcelt Raben pasūtījumu?", description: "Ja tas jau ir iesniegts myRaben, atceliet to arī tur vai piezvaniet Raben.", confirmLabel: "Atcelt pasūtījumu", danger: true }))) return;
            onStatus("cancelled");
          }}
        />
      )}

      {/* how-to */}
      <section className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-[16px] font-extrabold text-ink">Ievadīšana myRaben</h2>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" className={btn("outline", "sm")} onClick={() => copyText(text, "Viss pasūtījums nokopēts")}>
              <ClipboardList className="h-3.5 w-3.5" /> Kopēt visu tekstu
            </button>
            <a className={btn("outline", "sm")} href={`mailto:?subject=${encodeURIComponent(`Raben transporta pasūtījums${meta ? " " + meta.number : ""}`)}&body=${encodeURIComponent(text)}`}>
              <Mail className="h-3.5 w-3.5" /> Sūtīt e-pastā
            </a>
            <a className={btn("primary", "sm")} href={MYRABEN_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> Atvērt myRaben
            </a>
          </div>
        </div>
        <ol className="grid gap-2 text-[13px] sm:grid-cols-3">
          {[
            ["Atveriet myRaben", "Pogā „Atvērt myRaben” → myOrder → „Jauns sūtījums”."],
            ["Pārkopējiet laukus", "Katram laukam zemāk ir kopēšanas poga — secība ir tāda pati kā myRaben."],
            ["Ierakstiet Raben Nr.", "Pēc apstiprināšanas ierakstiet Raben sūtījuma numuru augšā un atzīmējiet „Iesniegts”."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3 rounded-xl bg-slate-50 p-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-400 text-[12px] font-extrabold text-navy-900">{i + 1}</span>
              <span>
                <span className="block font-bold text-ink">{t}</span>
                <span className="text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <CopyPanel title="1. Nosūtītājs" icon={Send} whole={partyLines(form.shipper).concat(partyContact(form.shipper) || []).join("\n")}>
        {partyRows(form.shipper)}
      </CopyPanel>
      <CopyPanel title="2. Iekraušanas vieta" icon={Warehouse} whole={partyLines(form.loading).concat(partyContact(form.loading) || []).join("\n")}>
        {sameLoading ? <SameNote text="Tā pati kā nosūtītājam — myRaben atstājiet noklusēto vai izvēlieties to pašu adresi." /> : partyRows(form.loading)}
      </CopyPanel>
      <CopyPanel title="3. Preču saņēmējs" icon={PackageCheck} whole={partyLines(form.consignee).concat(partyContact(form.consignee) || []).join("\n")}>
        {partyRows(form.consignee)}
      </CopyPanel>
      <CopyPanel title="4. Izkraušanas vieta" icon={MapPin} whole={partyLines(form.unloading).concat(partyContact(form.unloading) || []).join("\n")}>
        {sameUnloading ? <SameNote text="Tā pati kā saņēmējam — myRaben izvēlieties to pašu adresi." /> : partyRows(form.unloading)}
      </CopyPanel>

      <CopyPanel title="5. Preču raksturojums" icon={FlaskConical}>
        <CopyRow label="Preču raksturojums" value={GOODS_CHARACTER[form.goods_character]} />
        <CopyRow label="Bīstamā krava ierobežotos daudzumos (LQ)" value={form.limited_quantity ? "Jā — ieslēgt" : "Nē — atstāt izslēgtu"} />
      </CopyPanel>

      <CopyPanel title="6. Krava" icon={Truck}>
        {form.units.map((u, i) => (
          <div key={i} className="mb-3 rounded-xl border border-line/80 px-3 last:mb-0">
            <p className="border-b border-line/60 py-2 text-[12px] font-extrabold uppercase tracking-[0.08em] text-navy-600">
              {i + 1}. pozīcija
            </p>
            <CopyRow label="Iepakojuma veids" value={UNIT_PRESETS[u.type].label} />
            <CopyRow label="Skaits" value={u.qty} mono />
            <CopyRow label="Svars kopā (kg)" value={Math.round(u.qty * u.weight_kg * 10) / 10} mono />
            <CopyRow label="Garums (cm)" value={u.length_cm} mono />
            <CopyRow label="Platums (cm)" value={u.width_cm} mono />
            <CopyRow label="Augstums (cm)" value={u.height_cm} mono />
            <CopyRow label="Var kraut virsū" value={u.stackable ? "Jā" : "Nē"} />
            {u.description ? <CopyRow label="Saturs" value={u.description} /> : null}
          </div>
        ))}
        <p className="mt-2 rounded-lg bg-navy-50 px-3 py-2 text-[12.5px] font-semibold text-navy-800">
          Kopā: {totals.pieces} vien. · {fmtKg(totals.weight)} kg · {totals.places} palešu vietas · {totals.ldm} LDM · {totals.volume} m³
        </p>
      </CopyPanel>

      <CopyPanel title="7. Datumi un atsauces" icon={CalendarDays}>
        <CopyRow label="Iekraušanas datums" value={lvDate(form.loading_date)} mono />
        <CopyRow label="Laiks no" value={hhmm(form.loading_from)} mono />
        <CopyRow label="Laiks līdz" value={hhmm(form.loading_to)} mono />
        {form.delivery_date ? <CopyRow label="Piegādes datums" value={lvDate(form.delivery_date)} mono /> : null}
        {form.reference ? <CopyRow label="Klienta pasūtījuma Nr." value={form.reference} /> : null}
        {form.cargo_value != null ? <CopyRow label="Kravas vērtība (EUR)" value={form.cargo_value} mono /> : null}
        {form.notes ? <CopyRow label="Piezīmes" value={form.notes} /> : null}
      </CopyPanel>
    </div>
  );
}

function SameNote({ text }: { text: string }) {
  return <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] text-muted">{text}</p>;
}

function CopyPanel({ title, icon: Icon, children, whole }: { title: string; icon: LucideIcon; children: React.ReactNode; whole?: string }) {
  return (
    <section className="rounded-2xl border border-line bg-white shadow-card">
      <header className="flex items-center gap-2.5 border-b border-line/80 px-4 py-3">
        <Icon className="h-4 w-4 text-navy-500" aria-hidden />
        <h3 className="flex-1 text-[14.5px] font-bold text-ink">{title}</h3>
        {whole && (
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
            Visa adrese <CopyButton value={whole} label="Kopēt visu adresi" />
          </span>
        )}
      </header>
      <div className="px-4 py-1.5">{children}</div>
    </section>
  );
}

function StatusPanel({
  status,
  meta,
  dirty,
  pending,
  rabenNo,
  setRabenNo,
  cost,
  setCost,
  onSaveReady,
  onSubmitted,
  onSaveNumbers,
  onStatus,
  onCancel,
}: {
  status: RabenStatus;
  meta: Meta | null;
  dirty: boolean;
  pending: boolean;
  rabenNo: string;
  setRabenNo: (v: string) => void;
  cost: string;
  setCost: (v: string) => void;
  onSaveReady: () => void;
  onSubmitted: () => void;
  onSaveNumbers: () => void;
  onStatus: (s: RabenStatus) => void;
  onCancel: () => void;
}) {
  const flow: RabenStatus[] = ["ready", "submitted", "in_transit", "delivered"];
  const idx = flow.indexOf(status);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="h-1 bg-[repeating-linear-gradient(-45deg,var(--color-brand-400)_0_10px,var(--color-navy-700)_10px_20px)]" aria-hidden />
      <div className="p-4 sm:p-5">
        {/* progress */}
        <ol className="mb-5 flex items-center">
          {flow.map((s, i) => {
            const done = status !== "cancelled" && idx >= i;
            return (
              <li key={s} className={cn("flex items-center", i < flow.length - 1 && "flex-1")}>
                <span className="flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-full text-[12px] font-extrabold ring-2 transition",
                      done ? "bg-emerald-500 text-white ring-emerald-200" : "bg-white text-muted ring-line",
                      status === s && "ring-4 ring-emerald-200",
                    )}
                  >
                    {done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : i + 1}
                  </span>
                  <span className={cn("whitespace-nowrap text-[11px] font-bold", done ? "text-emerald-700" : "text-muted")}>{RABEN_STATUS[s].label.replace(" iesniegšanai", "").replace(" Raben", "")}</span>
                </span>
                {i < flow.length - 1 && <span className={cn("mx-1 mb-5 h-0.5 flex-1 rounded", idx > i && status !== "cancelled" ? "bg-emerald-400" : "bg-line")} aria-hidden />}
              </li>
            );
          })}
        </ol>

        {status === "cancelled" && (
          <div className="mb-4 flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-800">
            <X className="h-4 w-4" aria-hidden /> <span className="flex-1 font-semibold">Pasūtījums ir atcelts.</span>
            <button type="button" className={btn("outline", "sm")} disabled={pending} onClick={() => onStatus("draft")}>
              <RotateCcw className="h-3.5 w-3.5" /> Atjaunot kā melnrakstu
            </button>
          </div>
        )}

        {(!meta || status === "draft") && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-[15px] font-extrabold text-ink">Viss aizpildīts ✓</p>
              <p className="text-[13px] text-muted">Saglabājiet — pasūtījums būs gatavs ievadīšanai myRaben.</p>
            </div>
            <button type="button" className={btn("primary", "md", "h-11 px-5 text-[14px]")} onClick={onSaveReady} disabled={pending}>
              {pending ? <Spinner /> : <ClipboardCheck className="h-4 w-4" />} Saglabāt — gatavs myRaben
            </button>
          </div>
        )}

        {meta && status !== "draft" && status !== "cancelled" && (
          <div className="space-y-4">
            {dirty && (
              <p className="rounded-lg bg-orange-50 px-3 py-2 text-[12.5px] font-semibold text-orange-800">Ir nesaglabātas izmaiņas — nospiediet „Saglabāt izmaiņas” apakšā.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
              <Field label="Raben sūtījuma numurs" htmlFor="rb-no" hint="No myRaben pēc apstiprināšanas">
                <input id="rb-no" className={cn(inputCls, "font-bold tabular-nums")} value={rabenNo} onChange={(e) => setRabenNo(e.target.value)} placeholder="piem. 12345678" />
              </Field>
              <Field label="Transporta cena bez PVN" htmlFor="rb-cost" hint="EUR, nav obligāti">
                <input id="rb-cost" className={cn(inputCls, "tabular-nums")} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
              </Field>
              {status !== "ready" && (
                <button
                  type="button"
                  className={btn("outline", "md", "mb-[22px] h-10")}
                  disabled={pending || (rabenNo === (meta.raben_number ?? "") && cost === (meta.cost_net != null ? String(meta.cost_net) : ""))}
                  onClick={onSaveNumbers}
                >
                  <Save className="h-4 w-4" /> Saglabāt
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {status === "ready" && (
                <button type="button" className={btn("primary", "md", "h-11 px-5 text-[14px]")} disabled={pending} onClick={onSubmitted}>
                  <Send className="h-4 w-4" /> Esmu ievadījis myRaben — atzīmēt kā iesniegtu
                </button>
              )}
              {status === "submitted" && (
                <button type="button" className={btn("dark", "md", "h-11 px-5")} disabled={pending} onClick={() => onStatus("in_transit")}>
                  <Truck className="h-4 w-4" /> Krava paņemta — ceļā
                </button>
              )}
              {(status === "submitted" || status === "in_transit") && (
                <button type="button" className={btn("primary", "md", "h-11 px-5")} disabled={pending} onClick={() => onStatus("delivered")}>
                  <PackageCheck className="h-4 w-4" /> Piegādāts
                </button>
              )}
              {status === "delivered" && (
                <p className="flex items-center gap-2 text-[14px] font-bold text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" aria-hidden /> Krava piegādāta
                </p>
              )}
              <div className="ml-auto flex gap-2">
                {status === "ready" && (
                  <button type="button" className={btn("ghost", "sm")} disabled={pending} onClick={() => onStatus("draft")}>
                    <Undo2 className="h-3.5 w-3.5" /> Atpakaļ uz melnrakstu
                  </button>
                )}
                {status !== "delivered" && (
                  <button type="button" className={btn("ghost", "sm", "text-red-600 hover:bg-red-50")} disabled={pending} onClick={onCancel}>
                    <X className="h-3.5 w-3.5" /> Atcelt
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
