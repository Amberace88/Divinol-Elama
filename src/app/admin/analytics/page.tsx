import Link from "next/link";
import {
  Activity,
  BarChart3,
  Clock,
  Eye,
  FileText,
  Globe2,
  Languages,
  Layers,
  LogOut,
  MapPin,
  Megaphone,
  Monitor,
  MousePointerClick,
  Package,
  Percent,
  Radio,
  Share2,
  ShieldCheck,
  Smartphone,
  Tablet,
  Users,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  countryName,
  DEVICE_LABEL,
  EVENT_LABEL,
  fmtDuration,
  loadTraffic,
  localeLabel,
  OTHER,
  ratios,
  sourceName,
  TRAFFIC_PERIODS,
} from "@/lib/admin/analytics";
import { deltaPct, fmtNumber, fmtPct } from "@/lib/admin/format";
import { sp, type SP } from "@/lib/admin/params";
import { errorMessage } from "@/lib/admin/server";
import { getProducts } from "@/lib/catalog";
import { KpiCard } from "@/components/admin/Kpi";
import { EmptyState, ErrorNote, PageHeader, Panel, Segmented } from "@/components/admin/ui";
import { BarList } from "@/components/admin/analytics/BarList";
import { Funnel } from "@/components/admin/analytics/Funnel";
import { LivePill } from "@/components/admin/analytics/LivePill";
import { TrafficChart } from "@/components/admin/analytics/TrafficChart";

export const metadata = { title: "Apmeklējums" };

function Iso({ code }: { code: string | null | undefined }) {
  return (
    <span className="mr-2 inline-flex h-5 min-w-7 items-center justify-center rounded-md bg-navy-700 px-1 align-middle font-mono text-[10.5px] font-bold text-white">
      {code ?? "??"}
    </span>
  );
}

const deviceIcon = { mobile: Smartphone, tablet: Tablet, desktop: Monitor } as const;

type ProductInfo = { name: string; id: string | null };

async function productInfo(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  slugs: string[],
): Promise<Map<string, ProductInfo>> {
  const out = new Map<string, ProductInfo>();
  if (slugs.length === 0) return out;
  const [db, catalog] = await Promise.all([
    supabase.from("products").select("id, slug, i18n").in("slug", slugs),
    getProducts().catch(() => []),
  ]);
  for (const p of catalog) {
    if (slugs.includes(p.slug)) out.set(p.slug, { name: p.i18n.lv?.name ?? p.i18n.en?.name ?? p.slug, id: p.id ?? null });
  }
  for (const p of (db.data ?? []) as { id: string; slug: string; i18n: Record<string, { name?: string }> | null }[]) {
    const prev = out.get(p.slug);
    out.set(p.slug, { name: prev?.name ?? p.i18n?.lv?.name ?? p.i18n?.en?.name ?? p.slug, id: p.id });
  }
  return out;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = await searchParams;
  const days = TRAFFIC_PERIODS.find((p) => String(p.days) === sp(params, "days"))?.days ?? 30;
  const { supabase } = await requireAdmin();

  const { traffic, error } = await loadTraffic(supabase, days);
  const products = await productInfo(supabase, (traffic?.products ?? []).map((p) => p.slug));

  const cur = ratios(traffic?.totals);
  const prev = ratios(traffic?.previous);
  const periodLabel = TRAFFIC_PERIODS.find((p) => p.days === days)?.label ?? "";
  const hasData = cur.pageviews > 0 || prev.pageviews > 0;
  const f = traffic?.funnel;
  const directSessions = traffic?.sources.find((s) => !s.source)?.sessions ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Analītika"
        title="Apmeklējums"
        description={`Vietnes apmeklējuma statistika par pēdējām ${days === 365 ? "12 mēnešiem" : `${days} dienām`} salīdzinājumā ar iepriekšējo periodu.`}
        actions={
          <>
            <LivePill initial={traffic?.realtime.visitors ?? 0} />
            <Segmented items={TRAFFIC_PERIODS.map((p) => ({ href: `/admin/analytics?days=${p.days}`, label: p.label, active: p.days === days }))} />
          </>
        }
      />

      {error && (
        <div className="mb-5">
          <ErrorNote message={errorMessage(error)} />
        </div>
      )}

      {!error && !hasData && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-brand-300 bg-brand-50 px-4 py-3.5 text-[13px] text-ink">
          <Radio className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
          <p>
            <strong className="font-bold">Statistika tiek vākta.</strong> Vietne ir jauna — dati parādīsies šeit, tiklīdz veikalu apmeklēs pirmie
            apmeklētāji. Jūsu pašu apmeklējumi no <span className="font-mono text-[12px]">localhost</span> netiek skaitīti.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard accent label="Unikālie apmeklētāji" value={fmtNumber(cur.visitors)} delta={deltaPct(cur.visitors, prev.visitors)} hint={periodLabel} icon={Users} />
        <KpiCard label="Lapu skatījumi" value={fmtNumber(cur.pageviews)} delta={deltaPct(cur.pageviews, prev.pageviews)} hint="vs iepr. periods" icon={Eye} />
        <KpiCard label="Apmeklējumi" value={fmtNumber(cur.sessions)} delta={deltaPct(cur.sessions, prev.sessions)} hint="sesijas" icon={Activity} />
        <KpiCard
          label="Lapas/apmeklējumā"
          value={fmtNumber(cur.pagesPerSession, 2)}
          delta={deltaPct(cur.pagesPerSession, prev.pagesPerSession)}
          hint="vidēji"
          icon={Layers}
        />
        <KpiCard label="Vid. ilgums" value={fmtDuration(cur.avgDuration)} delta={deltaPct(cur.avgDuration, prev.avgDuration)} hint="apmeklējumam" icon={Clock} />
        <KpiCard
          label="Atlēcienu līmenis"
          value={fmtPct(cur.bounceRate, 1)}
          delta={deltaPct(cur.bounceRate, prev.bounceRate)}
          invertDelta
          hint="1 lapa apmeklējumā"
          icon={LogOut}
        />
        <KpiCard
          label="Konversija"
          value={fmtPct(cur.conversion, 2)}
          delta={deltaPct(cur.conversion, prev.conversion)}
          hint={`${fmtNumber(cur.orders)} pasūt. / apmekl.`}
          icon={Percent}
        />
        <KpiCard label="Pasūtījumi" value={fmtNumber(cur.orders)} delta={deltaPct(cur.orders, prev.orders)} hint="vs iepr. periods" icon={MousePointerClick} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Apmeklētāji un lapu skatījumi" description="Unikālie apmeklētāji (līnija) un lapu skatījumi (stabiņi)">
          {traffic && traffic.series.some((s) => s.pageviews > 0) ? (
            <TrafficChart series={traffic.series} days={days} />
          ) : (
            <EmptyState icon={BarChart3} title="Šajā periodā apmeklējumu nav" description="Kad vietni sāks apmeklēt, šeit redzēsiet apmeklējuma dinamiku pa dienām." />
          )}
        </Panel>
        <Panel title="Tagad vietnē" description="Apmeklētāji pēdējās 5 minūtēs" bodyClassName="p-0">
          <BarList
            head={["Lapa", "Apmekl."]}
            rows={(traffic?.realtime.pages ?? []).map((p) => ({ key: p.path, label: <span className="font-mono text-[12px]">{p.path}</span>, value: p.visitors }))}
            empty={{ icon: Radio, title: "Pašlaik neviena", description: "Šeit redzēsiet lapas, kuras apmeklētāji skatās tieši tagad." }}
          />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Pārdošanas piltuve" description="Apmeklējumi, kuros sasniegts katrs solis">
          <Funnel
            steps={[
              { label: "Apmeklējumi", value: f?.sessions ?? 0 },
              { label: "Produkta skatījumi", value: f?.product_views ?? 0 },
              { label: "Pievienots grozam", value: f?.add_to_cart ?? 0 },
              { label: "Noformēšana", value: f?.begin_checkout ?? 0 },
              { label: "Pasūtījumi", value: Math.max(f?.purchase ?? 0, f?.orders ?? 0), hint: "no pasūtījumu datiem" },
            ]}
          />
        </Panel>
        <Panel title="Avoti" description="No kurienes nāk apmeklējumi (pirmā lapa)" bodyClassName="p-0">
          <BarList
            head={["Avots", "Apmekl.", "Apmeklētāji"]}
            rows={(traffic?.sources ?? []).map((s) => {
              const name = sourceName(s.source);
              return {
                key: s.source ?? "__direct",
                label: s.source ? (
                  <>
                    {name ?? s.source}
                    {name && <span className="ml-2 text-[12px] font-normal text-muted">{s.source}</span>}
                  </>
                ) : (
                  <span>
                    Tiešie apmeklējumi <span className="text-[12px] font-normal text-muted">/ nav zināms</span>
                  </span>
                ),
                value: s.sessions,
                extra: [s.visitors],
              };
            })}
            share
            empty={{ icon: Share2, title: "Avotu vēl nav", description: "Meklētāji, sociālie tīkli un citas vietnes, no kurām atnāk apmeklētāji." }}
          />
          {directSessions > 0 && (
            <p className="border-t border-line/70 px-5 py-2.5 text-[12px] text-muted">
              Tiešie — adrese ievadīta pašrocīgi, grāmatzīme vai lietotne, kas nenodod avotu.
            </p>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Populārākās lapas" description="Pēc lapu skatījumiem" bodyClassName="p-0">
          <BarList
            head={["Lapa", "Skatīj.", "Apmekl.", "Ieejas"]}
            rows={(traffic?.pages ?? []).map((p) => ({
              key: p.path,
              label: (
                <a href={p.path} target="_blank" rel="noreferrer" className="font-mono text-[12px] hover:text-navy-600 hover:underline">
                  {p.path}
                </a>
              ),
              value: p.pageviews,
              extra: [p.visitors, p.entries],
            }))}
            empty={{ icon: FileText, title: "Lapu skatījumu vēl nav", description: "Visvairāk apmeklētās vietnes lapas parādīsies šeit." }}
          />
        </Panel>
        <Panel
          title="Populārākie produkti"
          description="Produktu lapu skatījumi un pievienošana grozam"
          bodyClassName="p-0"
          actions={
            <Link href="/admin/products" className="text-[12px] font-bold text-navy-600 hover:underline">
              Produkti →
            </Link>
          }
        >
          <BarList
            head={["Produkts", "Skatīj.", "Apmekl.", "Grozā"]}
            rows={(traffic?.products ?? []).map((p) => {
              const info = products.get(p.slug);
              return {
                key: p.slug,
                label: info?.id ? (
                  <Link href={`/admin/products/${info.id}`} className="hover:text-navy-600 hover:underline">
                    {info.name}
                  </Link>
                ) : (
                  <span>
                    {info?.name ?? p.slug}
                    {!info && <span className="ml-2 text-[12px] font-normal text-muted">(nav katalogā)</span>}
                  </span>
                ),
                value: p.views,
                extra: [p.visitors, p.add_to_cart],
              };
            })}
            empty={{ icon: Package, title: "Produktu skatījumu vēl nav", description: "Šeit redzēsiet, kuri produkti interesē visvairāk un cik bieži tos liek grozā." }}
          />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Valstis" description="Unikālie apmeklētāji pēc valsts" bodyClassName="p-0">
          <BarList
            head={["Valsts", "Apmekl.", "Skatīj."]}
            rows={(traffic?.countries ?? []).map((c) => ({
              key: c.country ?? "__none",
              label: (
                <>
                  <Iso code={c.country} />
                  {countryName(c.country)}
                </>
              ),
              value: c.visitors,
              extra: [c.pageviews],
            }))}
            share
            empty={{ icon: Globe2, title: "Valstu datu vēl nav", description: "Valsts tiek noteikta pēc Netlify ģeolokācijas; IP adreses netiek saglabātas." }}
          />
        </Panel>
        <Panel title="Pilsētas" description="Top 10 pēc unikālajiem apmeklētājiem" bodyClassName="p-0">
          <BarList
            head={["Pilsēta", "Apmekl."]}
            rows={(traffic?.cities ?? []).map((c) => ({
              key: `${c.country}-${c.city}`,
              label: (
                <>
                  <Iso code={c.country} />
                  {c.city}
                </>
              ),
              value: c.visitors,
            }))}
            empty={{ icon: MapPin, title: "Pilsētu datu vēl nav", description: "Aptuvenā pilsēta pēc Netlify ģeolokācijas." }}
          />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Ierīces" bodyClassName="p-0">
          <BarList
            head={["Ierīce", "Apmekl."]}
            rows={(traffic?.devices ?? []).map((d) => {
              const Icon = deviceIcon[(d.name ?? "") as keyof typeof deviceIcon] ?? Monitor;
              return {
                key: d.name ?? "__none",
                label: (
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-4 w-4 text-navy-500" aria-hidden />
                    {DEVICE_LABEL[d.name ?? ""] ?? "Nezināma"}
                  </span>
                ),
                value: d.visitors,
              };
            })}
            share
            empty={{ icon: Smartphone, title: "Vēl nav datu" }}
          />
        </Panel>
        <Panel title="Pārlūki" bodyClassName="p-0">
          <BarList
            head={["Pārlūks", "Apmekl."]}
            rows={(traffic?.browsers ?? []).map((b) => ({ key: b.name ?? "__none", label: OTHER(b.name), value: b.visitors }))}
            share
            empty={{ icon: Globe2, title: "Vēl nav datu" }}
          />
        </Panel>
        <Panel title="Operētājsistēmas" bodyClassName="p-0">
          <BarList
            head={["OS", "Apmekl."]}
            rows={(traffic?.os ?? []).map((o) => ({ key: o.name ?? "__none", label: OTHER(o.name), value: o.visitors }))}
            share
            empty={{ icon: Monitor, title: "Vēl nav datu" }}
          />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Kampaņas" description="UTM parametri (pirmā lapa)" bodyClassName="p-0">
          <BarList
            head={["Kampaņa", "Apmekl."]}
            rows={(traffic?.campaigns ?? []).map((c, i) => ({
              key: `${c.source}-${c.medium}-${c.campaign}-${i}`,
              label: (
                <span title={[c.source, c.medium, c.campaign].filter(Boolean).join(" / ")}>
                  {c.campaign ?? c.source ?? "—"}
                  <span className="ml-2 text-[12px] font-normal text-muted">{[c.source, c.medium].filter(Boolean).join(" / ")}</span>
                </span>
              ),
              value: c.sessions,
            }))}
            empty={{
              icon: Megaphone,
              title: "Kampaņu vēl nav",
              description: "Pievienojiet saitēm ?utm_source=…&utm_campaign=…, lai redzētu reklāmu un e-pastu rezultātus.",
            }}
          />
        </Panel>
        <Panel title="Valodas" description="Vietnes valodas versija" bodyClassName="p-0">
          <BarList
            head={["Valoda", "Apmekl.", "Skatīj."]}
            rows={(traffic?.locales ?? []).map((l) => ({
              key: l.name ?? "__none",
              label: (
                <>
                  <span className="mr-2 inline-flex h-5 min-w-7 items-center justify-center rounded-md bg-navy-50 px-1 align-middle font-mono text-[10.5px] font-bold uppercase text-navy-700">
                    {l.name ?? "?"}
                  </span>
                  {localeLabel(l.name)}
                </>
              ),
              value: l.visitors,
              extra: [l.pageviews],
            }))}
            empty={{ icon: Languages, title: "Vēl nav datu" }}
          />
        </Panel>
        <Panel title="Notikumi" description="Darbības vietnē" bodyClassName="p-0">
          <BarList
            head={["Notikums", "Reizes", "Apmekl."]}
            rows={(traffic?.events ?? []).map((e) => ({ key: e.name, label: EVENT_LABEL[e.name] ?? e.name, value: e.count, extra: [e.visitors] }))}
            empty={{
              icon: MousePointerClick,
              title: "Notikumu vēl nav",
              description: "Pievienošana grozam, noformēšana, PDF katalogu lejupielādes, zvani un citas darbības.",
            }}
          />
        </Panel>
      </div>

      <p className="mt-6 flex items-start gap-2 text-[12px] text-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
        Privātumu saudzējoša pirmās puses analītika bez sīkdatnēm: IP adreses netiek saglabātas, apmeklētāja identifikators mainās katru dienu, dati
        tiek glabāti 13 mēnešus. Unikālie apmeklētāji ilgākos periodos tiek skaitīti pa dienām.
      </p>
    </>
  );
}
