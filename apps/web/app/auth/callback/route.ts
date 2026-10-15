import { NextResponse, type NextRequest } from "next/server";

import type { AuthError, EmailOtpType } from "@supabase/supabase-js";

import { TERMS_PENDING_COOKIE, readPendingTermsVersion } from "@/lib/auth/termsPendingCookie";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT_PATH = "/dashboard";
const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function resolveNext(next: string | null, origin: string) {
  const fallback = new URL(DEFAULT_NEXT_PATH, origin);
  if (next === null || !next.startsWith("/")) {
    return fallback;
  }

  // The URL parser drops tabs and newlines, so "/\t/host" would resolve to another origin.
  const target = new URL(next, origin);

  return target.origin === origin ? target : fallback;
}

// The `accept_terms` function is called here and not through `acceptTerms` in the api-client package,
// because that package only exports one entry point, which pulls React hooks into this route.
// The sign-up page leaves the version in a cookie before it sends someone to Google. A failure to
// record it must not stop the sign-in. The accept-to-continue screen asks again if it was missed.
async function recordPendingTermsAcceptance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  request: NextRequest,
) {
  const version = readPendingTermsVersion(request.cookies.get(TERMS_PENDING_COOKIE)?.value);
  if (version === null) {
    return;
  }

  try {
    const { error } = await supabase.rpc("accept_terms", { p_version: version });
    if (error) {
      console.error("Could not record the Terms acceptance", error);
    }
  } catch (error) {
    console.error("Could not record the Terms acceptance", error);
  }
}

async function completeSignIn(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const failureRedirect = NextResponse.redirect(new URL("/login?error=callback", origin));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const emailOtpType = EMAIL_OTP_TYPES.find((type) => type === searchParams.get("type"));

  if (!code && !(tokenHash && emailOtpType)) {
    return failureRedirect;
  }

  const supabase = await createClient();
  let error: AuthError | null;
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
    if (!error) {
      await recordPendingTermsAcceptance(supabase, request);
    }
  } else if (tokenHash && emailOtpType) {
    ({ error } = await supabase.auth.verifyOtp({ type: emailOtpType, token_hash: tokenHash }));
  } else {
    return failureRedirect;
  }

  if (error) {
    return failureRedirect;
  }

  return NextResponse.redirect(resolveNext(searchParams.get("next"), origin));
}

export async function GET(request: NextRequest) {
  const response = await completeSignIn(request);
  // The cookie is good for one sign-in only, whatever came of it.
  response.cookies.delete(TERMS_PENDING_COOKIE);

  return response;
}
