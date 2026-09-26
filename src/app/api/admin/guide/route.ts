import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";

const FILE = "Divinol_lietosanas_pamaciba.pdf";

/** Admin-only user manual (PDF). Kept outside /public so it isn't reachable without an admin session. */
export async function GET() {
  const session = await getAdminSession();
  if (session.status !== "ok") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const pdf = await readFile(path.join(process.cwd(), "private", "docs", FILE));
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${FILE}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
