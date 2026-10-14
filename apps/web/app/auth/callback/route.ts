import { NextResponse, type NextRequest } from "next/server";

import type { AuthError, EmailOtpType } from "@supabase/supabase-js";

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

export async function GET(request: NextRequest) {
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
