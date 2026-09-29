import Link from "next/link";
import { BookUser, ExternalLink, Factory, Plus, Truck } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/admin/format";
import { sp, withParams, type SP } from "@/lib/admin/params";
import { errorMessage } from "@/lib/admin/server";
import { MYRABEN_URL, RABEN_DIRECTION, RABEN_STATUS, lvDate, rabenTotals, type RabenOrder, type RabenAddress, type RabenStatus } from "@/lib/admin/raben";
import { EmptyState, ErrorNote, PageHeader, Pill, Segmented, TableWrap, td, th, trHover } from "@/components/admin/ui";
import { btn } from "@/components/admin/styles";
import { AddressBook } from "@/components/admin/raben/AddressBook";
import { cn } from "@/lib/utils";

export const metadata = { title: "Raben kravas" };

const FILTERS: { id: string; label: string; statuses: RabenStatus[] | null }[] = [
  { id: "active", label: "Aktīvie", statuses: ["draft", "ready", "submitted", "in_transit"] },
  { id: "todo", label: "Jāievada myRaben", statuses: ["ready"] },
  { id: "done", label: "Piegādātie", statuses: ["delivered"] },
  { id: "all", label: "Visi", statuses: null },
];

export default async function RabenPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = await searchParams;
  const tab = sp(params, "tab") === "addresses" ? "addresses" : "orders";
  const filter = FILTERS.find((f) => f.id === sp(params, "f")) ?? FILTERS[0];
  const { supabase } = await requireAdmin();

  const url = (o: Record<string, string | null>) => `/admin/raben${withParams(params, o)}`;

  let q = supabase
    .from("raben_orders")
    .select("id, number, status, direction, order_id, shipper, loading, consignee, unloading, units, loading_date, raben_number, cost_net, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter.statuses) q = q.in("status", filter.statuses);
  const [listRes, addrRes, { data: counts }] = await Promise.all([
    tab === "orders" ? q : Promise.resolve({ data: [], error: null }),
    supabase.from("raben_addresses").select("*").order("sort").order("label"),
    supabase.from("raben_orders").select("status"),
  ]);
  const rows = (listRes.data ?? []) as Pick<RabenOrder, "id" | "number" | "status" | "direction" | "order_id" | "shipper" | "loading" | "consignee" | "unloading" | "units" | "loading_date" | "raben_number" | "cost_net" | "created_at">[];
  const addresses = (addrRes.data ?? []) as RabenAddress[];
  const statusCount = (s: RabenStatus[] | null) => ((counts ?? []) as { status: RabenStatus }[]).filter((r) => !s || s.includes(r.status)).length;

  return (
    <>
      <PageHeader
        title="Raben kravas"
        description="Palešu un kravu pasūtījumi Raben: sagatavojiet šeit ar dažiem klikšķiem, pēc tam pārkopējiet uz myRaben."
        actions={
          <>
            <a href={MYRABEN_URL} target="_blank" rel="noreferrer" className={btn("outline")}>
              <ExternalLink className="h-4 w-4" /> myRaben
            </a>
            <Link href="/admin/raben/new" className={btn("primary")}>
              <Plus className="h-4 w-4" /> Jauns Raben pasūtījums
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          items={[
            { href: url({ tab: null, f: null }), label: "Pasūtījumi", active: tab === "orders" },
            { href: url({ tab: "addresses", f: null }), label: `Adrešu grāmata (${addresses.length})`, active: tab === "addresses" },
          ]}
        />
      </div>

      {tab === "addresses" ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <AddressBook addresses={addresses} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="flex flex-wrap gap-1.5 border-b border-line/80 px-4 py-3">
            {FILTERS.map((f) => {
              const n = statusCount(f.statuses);
              const active = f.id === filter.id;
              return (
                <Link
                  key={f.id}
                  href={url({ f: f.id === "active" ? null : f.id })}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition",
                    active ? "bg-navy-700 text-white" : "bg-slate-100 text-ink hover:bg-slate-200",
                  )}
                >
                  {f.label}
                  <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-white/15" : f.id === "todo" && n ? "bg-brand-400 text-navy-900" : "bg-white text-muted")}>{n}</span>
                </Link>
              );
            })}
          </div>
          {listRes.error ? (
            <div className="p-5">
              <ErrorNote message={errorMessage(listRes.error)} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Truck}
              title={filter.id === "active" ? "Nav aktīvu Raben pasūtījumu" : "Nekas nav atrasts"}
              description="Izveidojiet jaunu pasūtījumu — maršruts Zeller+Gmelin → noliktava ir sagatavots ar vienu klikšķi."
              action={
                <Link href="/admin/raben/new" className={btn("primary")}>
                  <Plus className="h-4 w-4" /> Jauns Raben pasūtījums
                </Link>
              }
            />
          ) : (
            <TableWrap className="rounded-none border-0 shadow-none">
              <thead>
                <tr>
                  <th className={th}>Nr.</th>
                  <th className={th}>Maršruts</th>
                  <th className={th}>Krava</th>
                  <th className={th}>Iekraušana</th>
                  <th className={th}>Raben Nr.</th>
                  <th className={th}>Statuss</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const t = rabenTotals(r.units ?? []);
                  const st = RABEN_STATUS[r.status];
                  return (
                    <tr key={r.id} className={cn(trHover, "relative")}>
                      <td className={td}>
                        <Link href={`/admin/raben/${r.id}`} className="font-bold text-navy-700 after:absolute after:inset-0 hover:underline">
                          {r.number}
                        </Link>
                        <p className="text-[12px] text-muted">{RABEN_DIRECTION[r.direction]?.label}</p>
                      </td>
                      <td className={td}>
                        <div className="flex items-center gap-2 text-[13px]">
                          {r.direction === "inbound" && <Factory className="h-4 w-4 shrink-0 text-navy-400" aria-hidden />}
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-ink">
                              {r.loading?.city || "—"} → {r.unloading?.city || "—"}
                            </span>
                            <span className="block max-w-[260px] truncate text-[12px] text-muted">{r.consignee?.name || "saņēmējs nav norādīts"}</span>
                          </span>
                        </div>
                      </td>
                      <td className={cn(td, "whitespace-nowrap text-[13px] tabular-nums")}>
                        <span className="font-semibold text-ink">{t.pieces} vien.</span> · {fmtNumber(t.weight)} kg
                        <p className="text-[12px] text-muted">{t.places} palešu vietas</p>
                      </td>
                      <td className={cn(td, "whitespace-nowrap text-[13px]")}>{lvDate(r.loading_date) || "—"}</td>
                      <td className={cn(td, "text-[13px] tabular-nums")}>
                        {r.raben_number ?? <span className="text-muted">—</span>}
                        {r.cost_net != null && <p className="text-[12px] text-muted">{fmtMoney(r.cost_net)}</p>}
                      </td>
                      <td className={td}>
                        <Pill tone={st.tone}>{st.label}</Pill>
                        <p className="mt-0.5 text-[11.5px] text-muted">{fmtDate(r.created_at)}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </div>
      )}

      <p className="mt-4 flex items-start gap-2 text-[12.5px] text-muted">
        <BookUser className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Raben nepiedāvā publisku API, tāpēc pasūtījums myRaben tiek ievadīts ar kopēšanas pogām. Ja Raben piešķirs API/EDI piekļuvi, iesniegšanu var automatizēt.
      </p>
    </>
  );
}
