import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { readPublicFile } from "@/lib/runtime-files";

const FILE = "Divinol_lietosanas_pamaciba.pdf";
/** Unlisted static path (no index, not linked anywhere); the admin route streams it so the URL is never shown. */
const ASSET = `_docs/feeac8752603e216522b3239/${FILE}`;

/** Admin-only user manual (PDF): view inline or download with ?download=1. Served from an unlisted static path (works on Workers too). */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (session.status !== "ok") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const pdf = await readPublicFile(ASSET);
  if (!pdf) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        // ?download=1 → save as a file; otherwise open in the browser's PDF viewer
        "Content-Disposition": `${req.nextUrl.searchParams.has("download") ? "attachment" : "inline"}; filename="${FILE}"`,
        "Cache-Control": "private, no-store",
      },
    });
}
