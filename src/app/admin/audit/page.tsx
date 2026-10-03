import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Bot, LogIn, Minus, Pencil, Plus, ScrollText, Search, ShieldCheck, Tag, Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtDateTime, fmtRelative } from "@/lib/admin/format";
import { labelOf, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from "@/lib/admin/labels";
import {
  AUDIT_AREAS,
  deltaOf,
  entryLabel,
  fieldLabel,
  fmtValue,
  isAuditViewer,
  isMoneyField,
  snapshotFields,
  TABLE_LABEL,
  type AuditRow,
} from "@/lib/admin/audit";
import { ErrorNote, PageHeader, Pagination, Segmented, inputSm } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Darbību žurnāls" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;
const DAYS = [
  { v: "1", label: "Šodien" },
  { v: "7", label: "7 dienas" },
  { v: "30", label: "30 dienas" },
  { v: "all", label: "Viss" },
];

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const ACTION = {
  INSERT: { verb: "Pievienoja", icon: Plus, cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  UPDATE: { verb: "Mainīja", icon: Pencil, cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  DELETE: { verb: "Dzēsa", icon: Trash2, cls: "bg-red-50 text-red-700 ring-red-200" },
  VISIT: { verb: "Pieslēdzās", icon: LogIn, cls: "bg-slate-100 text-slate-600 ring-slate-200" },
} as const;

const PALETTE = ["bg-violet-600", "bg-amber-500", "bg-emerald-600", "bg-sky-600", "bg-rose-600", "bg-navy-700"];

const rigaDay = new Intl.DateTimeFormat("lv-LV", { timeZone: "Europe/Riga", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const rigaKey = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Riga", year: "numeric", month: "2-digit", day: "2-digit" });
const rigaTime = new Intl.DateTimeFormat("lv-LV", { timeZone: "Europe/Riga", hour: "2-digit", minute: "2-digit" });

/** Status-like values in Latvian. */
function valueText(table: string, path: string, v: unknown) {
  if (typeof v === "string") {
    if (table === "orders" && path === "status") return labelOf(ORDER_STATUS, v).label;
    if (table === "orders" && path === "payment_status") return labelOf(PAYMENT_STATUS, v).label;
    if (path === "payment_method") return PAYMENT_METHOD[v] ?? v;
  }
  return fmtValue(path, v);
}

/** Start (Riga midnight) of the period: today / last N days; null = everything. */
function sinceFor(days: string): Date | null {
  if (days === "all") return null;
  const d = new Date(Date.now() - (days === "1" ? 0 : Number(days) - 1) * 86_400_000);
  const key = rigaKey.format(d);
  const probe = new Date(`${key}T12:00:00Z`);
  const off = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Riga", timeZoneName: "shortOffset" }).formatToParts(probe).find((p) => p.type === "timeZoneName")?.value ?? "GMT+3";
  const h = Number(off.replace("GMT", "")) || 3;
  return new Date(new Date(`${key}T00:00:00Z`).getTime() - h * 3_600_000);
}

function recordHref(r: AuditRow, variantProduct: Map<string, string>) {
  if (r.action === "DELETE" || !r.record_id) return null;
  if (r.table_name === "products") return `/admin/products/${r.record_id}`;
  if (r.table_name === "product_variants") {
    const pid = variantProduct.get(r.record_id) ?? (typeof r.changes.product_id === "string" ? r.changes.product_id : null);
    return pid ? `/admin/products/${pid}` : null;
  }
  if (r.table_name === "orders") return `/admin/orders/${r.record_id}`;
  if (["order_items", "shipments", "invoices"].includes(r.table_name) && typeof r.changes.order_id === "string") return `/admin/orders/${r.changes.order_id}`;
  if (r.table_name === "profiles") return `/admin/customers/${r.record_id}`;
  if (r.table_name === "settings") return "/admin/settings";
  return null;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { supabase, user } = await requireAdmin();
  if (!isAuditViewer(user.email)) notFound();

  const sp = await searchParams;
  const who = one(sp.who) || "others";
  const area = one(sp.area);
  const days = DAYS.some((d) => d.v === one(sp.days)) ? one(sp.days) : "30";
  const q = one(sp.q).trim().slice(0, 80);
  const auto = one(sp.auto) === "1";
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const since = sinceFor(days);

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string> = { who, area, days, q, auto: auto ? "1" : "", page: "" };
    for (const [k, v] of Object.entries({ ...cur, ...patch })) if (v && !(k === "who" && v === "others") && !(k === "days" && v === "30")) p.set(k, v);
    const s = p.toString();
    return `/admin/audit${s ? `?${s}` : ""}`;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = (query: any, opts: { skipArea?: boolean } = {}) => {
    let x = query;
    if (who === "others") x = x.neq("actor_id", user.id);
    else if (who !== "all" && /^[0-9a-f-]{36}$/i.test(who)) x = x.eq("actor_id", who);
    if (!opts.skipArea && area && AUDIT_AREAS[area]) x = x.in("table_name", AUDIT_AREAS[area].tables);
    if (since) x = x.gte("at", since.toISOString());
    if (q) x = x.ilike("label", `%${q.replace(/[%_,()]/g, " ")}%`);
    if (!auto) x = x.eq("auto", false);
    return x;
  };

  const [list, admins, priceCount, totalCount, visitCount] = await Promise.all([
    filtered(supabase.from("audit_log").select("*", { count: "exact" }))
      .order("at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.rpc("audit_admins"),
    filtered(supabase.from("audit_log").select("id", { count: "exact", head: true }), { skipArea: true })
      .eq("table_name", "product_variants")
      .eq("action", "UPDATE")
      .not("changes->price_net", "is", null),
    filtered(supabase.from("audit_log").select("id", { count: "exact", head: true }), { skipArea: true }).neq("action", "VISIT"),
    filtered(supabase.from("audit_log").select("id", { count: "exact", head: true }), { skipArea: true }).eq("action", "VISIT"),
  ]);

  const rows = (list.data ?? []) as AuditRow[];
  const adminList = ((admins.data ?? []) as { id: string; email: string; full_name: string | null; last_sign_in_at: string | null }[]).filter(Boolean);
  const color = new Map(adminList.map((a, i) => [a.id, PALETTE[i % PALETTE.length]]));
  const nameOf = (id: string | null, email: string | null) => {
    const a = adminList.find((x) => x.id === id);
    const e = a?.email ?? email ?? "—";
    if (e === "elama@elama.lv") return a?.full_name || "Arnis (Elama)";
    if (id === user.id) return "Tu";
    return a?.full_name || e;
  };

  // variant → product for links
  const variantIds = [...new Set(rows.filter((r) => r.table_name === "product_variants" && r.record_id).map((r) => r.record_id as string))];
  const variantProduct = new Map<string, string>();
  if (variantIds.length) {
    const { data } = await supabase.from("product_variants").select("id, product_id").in("id", variantIds);
    for (const v of (data ?? []) as { id: string; product_id: string }[]) variantProduct.set(v.id, v.product_id);
  }

  // group by Riga day
  const groups: { key: string; title: string; rows: AuditRow[] }[] = [];
  for (const r of rows) {
    const key = rigaKey.format(new Date(r.at));
    let g = groups.find((x) => x.key === key);
    if (!g) {
      const t = rigaDay.format(new Date(r.at));
      g = { key, title: t.charAt(0).toUpperCase() + t.slice(1), rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }

  const missing = list.error && /audit_log|does not exist|schema cache/i.test(list.error.message);

  return (
    <>
      <PageHeader
        eyebrow="Tikai tev"
        title={
          <span className="flex items-center gap-2.5">
            <ScrollText className="h-6 w-6 text-navy-500" aria-hidden /> Darbību žurnāls
          </span>
        }
        description="Katra administratora darbība veikalā: kas, kad un ko tieši mainīja (bija → kļuva). Ierakstus nevar labot vai dzēst."
      />

      {missing ? (
        <ErrorNote message="Žurnāla tabula vēl nav izveidota datubāzē (migrācija 0016)." />
      ) : list.error ? (
        <ErrorNote message={list.error.message} />
      ) : null}

      {/* who + stats */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Darbības periodā" value={totalCount.count ?? 0} hint={who === "others" ? "bez tavām darbībām" : undefined} />
        <Stat label="Cenu izmaiņas" value={priceCount.count ?? 0} tone="amber" icon={Tag} href={href({ area: "prices" })} />
        <Stat label="Pieslēgšanās" value={visitCount.count ?? 0} icon={LogIn} href={href({ area: "visits" })} />
        <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Administratori</p>
          <ul className="mt-2 space-y-1.5">
            {adminList.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-[13px]">
                <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white", color.get(a.id))}>
                  {nameOf(a.id, a.email).slice(0, 1).toUpperCase()}
                </span>
                <Link href={href({ who: a.id })} className="min-w-0 flex-1 truncate font-semibold text-ink hover:text-navy-600">
                  {nameOf(a.id, a.email)}
                </Link>
                <span className="shrink-0 text-[12px] text-muted" title={a.last_sign_in_at ? `Pēdējā pieslēgšanās ${fmtDateTime(a.last_sign_in_at)}` : undefined}>
                  {a.last_sign_in_at ? fmtRelative(a.last_sign_in_at) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* filters */}
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-line bg-white p-3 shadow-card lg:flex-row lg:items-center">
        <Segmented items={DAYS.map((d) => ({ href: href({ days: d.v }), label: d.label, active: days === d.v }))} />
        <form action="/admin/audit" className="flex flex-1 flex-wrap items-center gap-2">
          {days !== "30" && <input type="hidden" name="days" value={days} />}
          <select name="who" defaultValue={who} className={cn(inputSm, "w-auto")} aria-label="Kas">
            <option value="others">Visi, izņemot mani</option>
            <option value="all">Visi</option>
            {adminList.map((a) => (
              <option key={a.id} value={a.id}>
                {nameOf(a.id, a.email)}
              </option>
            ))}
          </select>
          <select name="area" defaultValue={area} className={cn(inputSm, "w-auto")} aria-label="Sadaļa">
            <option value="">Visas sadaļas</option>
            {Object.entries(AUDIT_AREAS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <label className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input name="q" defaultValue={q} placeholder="Produkts, pasūtījums, klients…" className={cn(inputSm, "pl-8")} />
          </label>
          <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
            <input type="checkbox" name="auto" value="1" defaultChecked={auto} className="h-4 w-4 rounded border-line" /> Arī automātiskās
          </label>
          <button type="submit" className="h-9 rounded-lg bg-navy-700 px-3.5 text-[13px] font-bold text-white hover:bg-navy-800">
            Rādīt
          </button>
        </form>
      </div>

      {/* log */}
      {groups.length === 0 && !list.error ? (
        <div className="rounded-2xl border border-dashed border-navy-200 bg-white px-6 py-14 text-center">
          <ShieldCheck className="mx-auto h-9 w-9 text-navy-300" aria-hidden />
          <p className="mt-3 text-[15px] font-bold text-ink">Šajā periodā darbību nav</p>
          <p className="mt-1 text-[13px] text-muted">Žurnāls sāk rakstīt no brīža, kad tas tika ieslēgts. Pamēģini garāku periodu vai citu filtru.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="sticky top-0 z-10 -mx-1 mb-2 bg-canvas/90 px-1 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.1em] text-muted backdrop-blur">
                {g.title} <span className="font-semibold normal-case tracking-normal">· {g.rows.length}</span>
              </h2>
              <ol className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                {g.rows.map((r) => (
                  <Entry key={r.id} r={r} who={nameOf(r.actor_id, r.actor_email)} color={color.get(r.actor_id ?? "") ?? "bg-slate-500"} link={recordHref(r, variantProduct)} />
                ))}
              </ol>
            </section>
          ))}
          {(list.count ?? 0) > PAGE_SIZE && (
            <div className="rounded-2xl border border-line bg-white shadow-card">
              <Pagination page={page} total={list.count ?? 0} pageSize={PAGE_SIZE} href={(p) => href({ page: String(p) })} />
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "amber";
  icon?: typeof Tag;
  href?: string;
}) {
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {label}
      </p>
      <p className={cn("mt-1.5 text-[28px] font-extrabold tabular-nums tracking-[-0.02em]", tone === "amber" && value > 0 ? "text-amber-600" : "text-ink")}>{value}</p>
      {hint && <p className="text-[12px] text-muted">{hint}</p>}
    </>
  );
  const cls = "block rounded-2xl border border-line bg-white p-4 shadow-card";
  return href ? (
    <Link href={href} className={cn(cls, "transition hover:border-navy-300 hover:shadow-lift")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Entry({ r, who, color, link }: { r: AuditRow; who: string; color: string; link: string | null }) {
  const a = ACTION[r.action] ?? ACTION.UPDATE;
  const Icon = a.icon;
  const diff = r.action === "UPDATE" ? Object.entries(r.changes ?? {}) : [];
  const snap = r.action === "INSERT" || r.action === "DELETE" ? snapshotFields(r.changes ?? {}) : [];
  const price = diff.some(([k]) => isMoneyField(k));
  const shown = diff.slice(0, 8);
  const rest = diff.slice(8);

  return (
    <li className={cn("flex gap-3 border-b border-line/70 px-4 py-3.5 last:border-b-0 sm:px-5", price && "bg-amber-50/40")}>
      <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-extrabold text-white", color)} title={r.actor_email ?? undefined}>
        {who.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]">
          <span className="font-bold text-ink">{who}</span>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold ring-1 ring-inset", a.cls)}>
            <Icon className="h-3 w-3" aria-hidden />
            {a.verb}
          </span>
          {r.action !== "VISIT" && <span className="text-muted">{TABLE_LABEL[r.table_name] ?? r.table_name}</span>}
          {link ? (
            <Link href={link} className="inline-flex min-w-0 items-center gap-1 font-semibold text-navy-700 hover:underline">
              <span className="truncate">{entryLabel(r)}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </Link>
          ) : (
            <span className="min-w-0 truncate font-semibold text-ink">{r.action === "VISIT" ? "administrāciju" : entryLabel(r)}</span>
          )}
          {price && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-800">
              <Tag className="h-3 w-3" aria-hidden /> Cena
            </span>
          )}
          {r.auto && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600" title="Izmaiņa notika automātiski kādas citas darbības dēļ">
              <Bot className="h-3 w-3" aria-hidden /> automātiski
            </span>
          )}
          <time className="ml-auto shrink-0 text-[12px] tabular-nums text-muted" dateTime={r.at} title={fmtDateTime(r.at)}>
            {rigaTime.format(new Date(r.at))}
          </time>
        </div>

        {shown.length > 0 && (
          <dl className="mt-2 grid gap-1">
            {shown.map(([k, v]) => (
              <DiffRow key={k} table={r.table_name} path={k} pair={v} />
            ))}
            {rest.length > 0 && (
              <details className="text-[12.5px]">
                <summary className="cursor-pointer font-semibold text-navy-600">vēl {rest.length} lauki</summary>
                <div className="mt-1 grid gap-1">
                  {rest.map(([k, v]) => (
                    <DiffRow key={k} table={r.table_name} path={k} pair={v} />
                  ))}
                </div>
              </details>
            )}
          </dl>
        )}

        {snap.length > 0 && (
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-muted">
            {snap.map(([k, v]) => (
              <span key={k}>
                {fieldLabel(k)}: <span className="font-semibold text-ink">{valueText(r.table_name, k, v)}</span>
              </span>
            ))}
          </p>
        )}
      </div>
    </li>
  );
}

function DiffRow({ table, path, pair }: { table: string; path: string; pair: unknown }) {
  const [before, after] = Array.isArray(pair) && pair.length === 2 ? pair : [null, pair];
  const money = isMoneyField(path);
  const d = money ? deltaOf(before, after) : null;
  return (
    <div className="grid gap-x-3 text-[12.5px] sm:grid-cols-[220px_minmax(0,1fr)]">
      <dt className={cn("truncate font-semibold", money ? "text-amber-800" : "text-muted")} title={path}>
        {fieldLabel(path)}
      </dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="max-w-full break-words rounded bg-red-50 px-1.5 py-0.5 text-red-800 line-through decoration-red-300">{valueText(table, path, before)}</span>
        <ArrowRight className="h-3 w-3 shrink-0 text-muted" aria-hidden />
        <span className="max-w-full break-words rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800">{valueText(table, path, after)}</span>
        {d != null && Number.isFinite(d) && (
          <span className={cn("inline-flex items-center gap-0.5 text-[11.5px] font-bold tabular-nums", d > 0 ? "text-emerald-700" : "text-red-700")}>
            {d > 0 ? <Plus className="h-3 w-3" aria-hidden /> : <Minus className="h-3 w-3" aria-hidden />}
            {Math.abs(d).toFixed(1)}%
          </span>
        )}
      </dd>
    </div>
  );
}
