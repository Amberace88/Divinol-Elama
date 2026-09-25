"use client";

import { useMemo } from "react";
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtMoney, fmtMoneyCompact, fmtMonth, fmtNumber, fmtShortDate } from "@/lib/admin/format";
import { MARKET } from "@/lib/admin/labels";

const NAVY = "#1e2d51";
const NAVY_300 = "#8095c1";
const BRAND = "#ffc10e";

type Point = { day: string; revenue: number; orders: number };
type Bucket = "day" | "week" | "month";

function bucketKey(day: string, bucket: Bucket) {
  if (bucket === "day") return day;
  const d = new Date(`${day.slice(0, 10)}T12:00:00Z`);
  if (bucket === "month") return `${day.slice(0, 7)}-01`;
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function ChartTooltip({
  active,
  payload,
  label,
  bucket,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number | string }[];
  label?: string;
  bucket: Bucket;
}) {
  if (!active || !payload?.length || !label) return null;
  const rev = payload.find((p) => p.dataKey === "revenue")?.value ?? 0;
  const ord = payload.find((p) => p.dataKey === "orders")?.value ?? 0;
  const title = bucket === "month" ? fmtMonth(label) : bucket === "week" ? `Nedēļa no ${fmtShortDate(label)}` : fmtShortDate(label);
  return (
    <div className="rounded-xl border border-line bg-white/95 px-3.5 py-2.5 text-[12px] shadow-lift backdrop-blur">
      <p className="mb-1.5 font-bold text-ink">{title}</p>
      <p className="flex items-center gap-2 text-muted">
        <span className="h-2 w-2 rounded-full" style={{ background: NAVY }} /> Apgrozījums:
        <span className="ml-auto pl-3 font-bold tabular-nums text-ink">{fmtMoney(rev)}</span>
      </p>
      <p className="flex items-center gap-2 text-muted">
        <span className="h-2 w-2 rounded-sm" style={{ background: BRAND }} /> Pasūtījumi:
        <span className="ml-auto pl-3 font-bold tabular-nums text-ink">{fmtNumber(ord)}</span>
      </p>
    </div>
  );
}

export function RevenueChart({ series, days }: { series: Point[]; days: number }) {
  const bucket: Bucket = days > 120 ? "month" : days > 45 ? "week" : "day";
  const data = useMemo(() => {
    const map = new Map<string, Point>();
    for (const p of series) {
      const k = bucketKey(String(p.day), bucket);
      const cur = map.get(k) ?? { day: k, revenue: 0, orders: 0 };
      cur.revenue += Number(p.revenue) || 0;
      cur.orders += Number(p.orders) || 0;
      map.set(k, cur);
    }
    return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [series, bucket]);

  return (
    <div className="h-[280px] w-full sm:h-[320px]" role="img" aria-label="Apgrozījuma un pasūtījumu diagramma">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={NAVY} stopOpacity={0.28} />
              <stop offset="100%" stopColor={NAVY} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e3e7ef" strokeDasharray="3 4" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#5b6475" }}
            tickFormatter={(v: string) => (bucket === "month" ? fmtMonth(v) : fmtShortDate(v))}
            minTickGap={24}
          />
          <YAxis
            yAxisId="rev"
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fontSize: 11, fill: "#5b6475" }}
            tickFormatter={(v: number) => fmtMoneyCompact(v)}
          />
          <YAxis yAxisId="ord" orientation="right" tickLine={false} axisLine={false} width={28} allowDecimals={false} tick={{ fontSize: 11, fill: "#5b6475" }} />
          <Tooltip content={<ChartTooltip bucket={bucket} />} cursor={{ fill: "rgb(30 45 81 / 0.04)" }} />
          <Bar yAxisId="ord" dataKey="orders" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Area
            yAxisId="rev"
            type="monotone"
            dataKey="revenue"
            stroke={NAVY}
            strokeWidth={2.25}
            fill="url(#revFill)"
            activeDot={{ r: 4, fill: BRAND, stroke: NAVY, strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const MARKET_COLORS: Record<string, string> = { LV: NAVY, EE: BRAND, LT: NAVY_300 };

export function MarketDonut({ byMarket }: { byMarket: Record<string, number> }) {
  const data = ["LV", "EE", "LT"].map((m) => ({ market: m, value: Number(byMarket[m] ?? 0) }));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative h-[170px] w-[170px] shrink-0" role="img" aria-label="Pārdošana pa tirgiem">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total ? data : [{ market: "—", value: 1 }]}
              dataKey="value"
              nameKey="market"
              innerRadius={56}
              outerRadius={80}
              paddingAngle={total ? 3 : 0}
              stroke="none"
              isAnimationActive
            >
              {(total ? data : [{ market: "—" }]).map((d) => (
                <Cell key={d.market} fill={total ? MARKET_COLORS[d.market] : "#e3e7ef"} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Kopā</p>
            <p className="text-[15px] font-extrabold tabular-nums text-ink">{fmtMoneyCompact(total)}</p>
          </div>
        </div>
      </div>
      <ul className="w-full space-y-2.5 text-[13px]">
        {data.map((d) => (
          <li key={d.market} className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 -skew-x-12 rounded-[3px]" style={{ background: MARKET_COLORS[d.market] }} aria-hidden />
            <span className="font-semibold text-ink">{MARKET[d.market]}</span>
            <span className="ml-auto tabular-nums text-muted">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            <span className="w-24 text-right font-bold tabular-nums text-ink">{fmtMoney(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
