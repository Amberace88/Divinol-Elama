import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";

const noStore = { "Cache-Control": "no-store" };

/** Visitors active in the last 5 minutes + their current pages (admin only, polled by <LivePill>). */
export async function GET() {
  const session = await getAdminSession();
  if (session.status !== "ok") return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });

  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data, error } = await session.supabase
    .from("analytics_events")
    .select("visitor_id, path, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return NextResponse.json({ visitors: 0, pages: [] }, { headers: noStore });

  // Latest page per visitor (rows are newest first).
  const current = new Map<string, string | null>();
  for (const r of (data ?? []) as { visitor_id: string; path: string | null }[]) {
    if (!current.has(r.visitor_id)) current.set(r.visitor_id, r.path);
  }
  const byPath = new Map<string, number>();
  for (const p of current.values()) if (p) byPath.set(p, (byPath.get(p) ?? 0) + 1);
  const pages = [...byPath.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path, visitors]) => ({ path, visitors }));

  return NextResponse.json({ visitors: current.size, pages }, { headers: noStore });
}
