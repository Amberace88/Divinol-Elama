import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type AdminProfile = { id: string; email: string; full_name: string | null; role: string };
type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AdminSession =
  | { status: "unconfigured" }
  | { status: "anonymous" }
  | { status: "forbidden"; user: User }
  | { status: "ok"; supabase: Supabase; user: User; profile: AdminProfile };

/** Loads the current user + profile once per request and checks the admin role. */
export const getAdminSession = cache(async (): Promise<AdminSession> => {
  if (!isSupabaseConfigured) return { status: "unconfigured" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "anonymous" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle<AdminProfile>();
  if (!profile || profile.role !== "admin") return { status: "forbidden", user };
  return { status: "ok", supabase, user, profile };
});

export class AdminAuthError extends Error {
  constructor() {
    super("Nav piekļuves: nepieciešamas administratora tiesības.");
    this.name = "AdminAuthError";
  }
}

/** Use at the top of every Server Action / route handler. Throws when the caller is not an admin. */
export async function requireAdmin() {
  const session = await getAdminSession();
  if (session.status !== "ok") throw new AdminAuthError();
  return session;
}
