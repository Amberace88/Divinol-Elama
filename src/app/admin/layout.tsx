import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope/wght.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { getAdminSession } from "@/lib/admin/auth";
import { AdminShell, type AdminCounts } from "@/components/admin/AdminShell";
import { NoAccess } from "@/components/admin/NoAccess";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Administrācija", template: "%s · ELAMA admin" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#0a1122",
  width: "device-width",
  initialScale: 1,
};

async function loadCounts(supabase: Extract<Awaited<ReturnType<typeof getAdminSession>>, { status: "ok" }>["supabase"]): Promise<AdminCounts> {
  try {
    const [o, b, i] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["new", "confirmed", "processing"]),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("b2b_status", "pending"),
      supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    ]);
    return { openOrders: o.count ?? 0, b2bPending: b.count ?? 0, newInquiries: i.count ?? 0 };
  } catch {
    return { openOrders: 0, b2bPending: 0, newInquiries: 0 };
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (session.status === "anonymous") redirect("/login?next=/admin");

  let body: React.ReactNode;
  if (session.status === "ok") {
    const [counts, cookieStore] = await Promise.all([loadCounts(session.supabase), cookies()]);
    body = (
      <AdminShell
        counts={counts}
        user={{ name: session.profile.full_name ?? "", email: session.profile.email }}
        initialCollapsed={cookieStore.get("admin_sidebar")?.value === "1"}
      >
        {children}
      </AdminShell>
    );
  } else {
    body = <NoAccess reason={session.status} />;
  }

  return (
    <html lang="lv" className="h-full">
      <body className="min-h-full bg-canvas antialiased">
        {body}
        <Toaster position="top-right" richColors closeButton toastOptions={{ className: "font-sans" }} />
      </body>
    </html>
  );
}
