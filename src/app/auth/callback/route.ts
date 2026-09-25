import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { safeNextPath } from "@/components/account/format";
import { deferEmail } from "@/lib/email/send";
import { notifyBusinessSignupIfNew } from "@/lib/email/notify";

export const dynamic = "force-dynamic";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function siteOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost && process.env.NODE_ENV !== "development") {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}

/**
 * Landing URL of Supabase e-mails (sign-up confirmation, magic link, password recovery, e-mail change).
 * Exchanges the PKCE `code` (or verifies `token_hash` + `type`) for a session and redirects to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = siteOrigin(request);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  let next = safeNextPath(searchParams.get("next"), "/account");
  if (type === "recovery" && !searchParams.get("next")) next = "/reset-password";

  const fail = () => NextResponse.redirect(`${origin}/login?error=auth`);

  if (!isSupabaseConfigured) return fail();
  if (searchParams.get("error") || searchParams.get("error_code")) return fail();

  try {
    const supabase = await createClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return fail();
    } else if (tokenHash && type && OTP_TYPES.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (error) return fail();
    } else {
      return fail();
    }
    // Confirmed business sign-up → B2B application notification to the shop (once, after the response).
    if (type !== "recovery") deferEmail("b2b signup", () => notifyBusinessSignupIfNew(supabase));
  } catch {
    return fail();
  }

  return NextResponse.redirect(`${origin}${next}`);
}
