import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Refresh the Supabase auth session (keeps cookies fresh) and copy cookies onto the response. */
async function withSession(request: NextRequest, response: NextResponse) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return { response, user: null };
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasAuthCookie) return { response, user: null };
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  return { response, user: data.user };
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin panel: not localized, requires a session (role is verified again in the admin layout).
  if (pathname.startsWith("/admin")) {
    const { response, user } = await withSession(request, NextResponse.next());
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return response;
  }

  const response = intl(request);
  const { response: res } = await withSession(request, response);
  return res;
}

export const config = {
  // Skip Next internals, API routes, static files and metadata files.
  matcher: ["/((?!api|auth|_next|_vercel|media|.*\\..*).*)"],
};
