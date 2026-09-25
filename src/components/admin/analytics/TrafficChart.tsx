"use client";

import { useMemo } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtMonth, fmtNumber, fmtShortDate } from "@/lib/admin/format";

const NAVY = "#1e2d51";
const BRAND = "#ffc10e";

type Point = { day: string; visitors: number; pageviews: number };
type Bucket = "day" | "week" | "month";

function bucketKey(day: string, bucket: Bucket) {
  if (bucket === "day") return day;
  if (bucket === "month") return `${day.slice(0, 7)}-01`;
  const d = new Date(`${day.slice(0, 10)}T12:00:00Z`);
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
  const vis = payload.find((p) => p.dataKey === "visitors")?.value ?? 0;
  const pv = payload.find((p) => p.dataKey === "pageviews")?.value ?? 0;
  const title = bucket === "month" ? fmtMonth(label) : bucket === "week" ? `Nedēļa no ${fmtShortDate(label)}` : fmtShortDate(label);
  return (
    <div className="rounded-xl border border-line bg-white/95 px-3.5 py-2.5 text-[12px] shadow-lift backdrop-blur">
      <p className="mb-1.5 font-bold text-ink">{title}</p>
      <p className="flex items-center gap-2 text-muted">
        <span className="h-2 w-2 rounded-full" style={{ background: NAVY }} /> Apmeklētāji:
        <span className="ml-auto pl-3 font-bold tabular-nums text-ink">{fmtNumber(vis)}</span>
      </p>
      <p className="flex items-center gap-2 text-muted">
        <span className="h-2 w-2 rounded-sm" style={{ background: BRAND }} /> Lapu skatījumi:
        <span className="ml-auto pl-3 font-bold tabular-nums text-ink">{fmtNumber(pv)}</span>
      </p>
    </div>
  );
}

/** Daily visitors (area) and page views (bars); weeks/months for long periods. */
export function TrafficChart({ series, days }: { series: Point[]; days: number }) {
  const bucket: Bucket = days > 120 ? "month" : days > 45 ? "week" : "day";
  const data = useMemo(() => {
    const map = new Map<string, Point>();
    for (const p of series) {
      const k = bucketKey(String(p.day), bucket);
      const cur = map.get(k) ?? { day: k, visitors: 0, pageviews: 0 };
      cur.visitors += Number(p.visitors) || 0;
      cur.pageviews += Number(p.pageviews) || 0;
      map.set(k, cur);
    }
    return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [series, bucket]);

  return (
    <div className="h-[280px] w-full sm:h-[320px]" role="img" aria-label="Apmeklētāju un lapu skatījumu diagramma">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="visFill" x1="0" y1="0" x2="0" y2="1">
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
          <YAxis yAxisId="vis" tickLine={false} axisLine={false} width={40} allowDecimals={false} tick={{ fontSize: 11, fill: "#5b6475" }} />
          <YAxis yAxisId="pv" orientation="right" tickLine={false} axisLine={false} width={36} allowDecimals={false} tick={{ fontSize: 11, fill: "#5b6475" }} />
          <Tooltip content={<ChartTooltip bucket={bucket} />} cursor={{ fill: "rgb(30 45 81 / 0.04)" }} />
          <Bar yAxisId="pv" dataKey="pageviews" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Area
            yAxisId="vis"
            type="monotone"
            dataKey="visitors"
            stroke={NAVY}
            strokeWidth={2.25}
            fill="url(#visFill)"
            activeDot={{ r: 4, fill: BRAND, stroke: NAVY, strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
